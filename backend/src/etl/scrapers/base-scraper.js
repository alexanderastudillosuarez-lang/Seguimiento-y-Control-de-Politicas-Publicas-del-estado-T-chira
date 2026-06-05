const crypto  = require('crypto');
const { query } = require('../../config/db');
const { clasificar } = require('../../services/ai/classifier');
const logger = require('../../config/logger');

class BaseScraper {
    constructor(nombre, plataforma) {
        this.nombre     = nombre;
        this.plataforma = plataforma;
        this.jobId      = null;
        this.stats      = { procesados: 0, nuevos: 0, errores: 0 };
    }

    hashContenido(texto) {
        return crypto.createHash('sha256').update(texto || '').digest('hex');
    }

    async existePublicacion(hash) {
        const { rows } = await query(
            'SELECT id FROM contenido.publicaciones WHERE hash_contenido = $1',
            [hash]
        );
        return rows.length > 0;
    }

    async guardarPublicacion(datos) {
        const hash = this.hashContenido(datos.contenido_raw || datos.url_original || '');

        if (await this.existePublicacion(hash)) {
            logger.debug('Publicación duplicada ignorada', { hash: hash.substring(0, 12) });
            return null;
        }

        // Clasificar con IA
        const ia = await clasificar(datos.contenido_limpio || datos.contenido_raw || '');

        const { rows } = await query(`
            INSERT INTO contenido.publicaciones (
                entidad_id, fuente_id, plataforma, id_externo, url_original,
                contenido_raw, contenido_limpio, resumen_ia, idioma,
                likes, comentarios, compartidos, vistas, alcance_estimado,
                sentiment_score, sentiment_label, temas, entidades_mencionadas,
                hash_contenido, publicado_en, procesado_ia
            ) VALUES (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,
                $10,$11,$12,$13,$14,
                $15,$16,$17,$18,
                $19,$20,$21
            )
            RETURNING id
        `, [
            datos.entidad_id, datos.fuente_id, this.plataforma,
            datos.id_externo  || null,
            datos.url_original || null,
            datos.contenido_raw   || null,
            datos.contenido_limpio || datos.contenido_raw || null,
            ia.resumen || null,
            'es',
            datos.likes         || 0,
            datos.comentarios   || 0,
            datos.compartidos   || 0,
            datos.vistas        || 0,
            datos.alcance_estimado || 0,
            ia.sentiment_score  || 0,
            ia.sentiment_label  || 'neutro',
            JSON.stringify(ia.palabras_clave || []),
            JSON.stringify([ia.organismo, ia.municipio].filter(Boolean)),
            hash,
            datos.publicado_en  || new Date(),
            true,
        ]);

        const pubId = rows[0].id;

        // Guardar metadatos de seguimiento en tabla extendida
        await this.guardarMetadatos(pubId, ia, datos);

        this.stats.nuevos++;
        logger.info('Publicación guardada', {
            id: pubId, plataforma: this.plataforma,
            categoria: ia.categoria, municipio: ia.municipio,
        });
        return pubId;
    }

    async guardarMetadatos(publicacionId, ia, datosOriginales) {
        await query(`
            INSERT INTO contenido.metadatos_seguimiento (
                publicacion_id, categoria, subcategoria, municipio,
                organismo, tipo_actividad, obra, inversion,
                beneficiarios, sector_afectado, lat, lng,
                problema_social, motor_ia, confianza_ia, raw_ia
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
            )
            ON CONFLICT (publicacion_id) DO UPDATE SET
                categoria      = EXCLUDED.categoria,
                municipio      = EXCLUDED.municipio,
                updated_at     = NOW()
        `, [
            publicacionId,
            ia.categoria        || 'otro',
            ia.subcategoria     || null,
            ia.municipio        || null,
            ia.organismo        || null,
            ia.tipo_actividad   || 'otro',
            ia.obra             || null,
            ia.inversion        || null,
            ia.beneficiarios    || null,
            ia.sector_afectado  || null,
            ia.coordenadas?.lat || null,
            ia.coordenadas?.lng || null,
            ia.problema_social  || null,
            ia.motor_ia         || 'fallback',
            ia.confianza        || 0,
            JSON.stringify(ia),
        ]);
    }

    async iniciarJob(fuenteId) {
        const { rows } = await query(`
            INSERT INTO etl.jobs (fuente_id, tipo, estado, iniciado_en)
            VALUES ($1, $2, 'en_proceso', NOW())
            RETURNING id
        `, [fuenteId, this.plataforma]);
        this.jobId = rows[0].id;
        return this.jobId;
    }

    async finalizarJob(estado = 'completado', errorMsg = null) {
        if (!this.jobId) return;
        await query(`
            UPDATE etl.jobs SET
                estado           = $1,
                items_procesados = $2,
                items_nuevos     = $3,
                items_error      = $4,
                error_msg        = $5,
                completado_en    = NOW(),
                duracion_ms      = EXTRACT(EPOCH FROM (NOW() - iniciado_en)) * 1000
            WHERE id = $6
        `, [estado, this.stats.procesados, this.stats.nuevos, this.stats.errores, errorMsg, this.jobId]);
    }

    async log(nivel, mensaje, metadata = {}) {
        if (this.jobId) {
            await query(
                'INSERT INTO etl.logs (job_id, nivel, mensaje, metadata) VALUES ($1,$2,$3,$4)',
                [this.jobId, nivel, mensaje, JSON.stringify(metadata)]
            ).catch(() => {});
        }
        logger[nivel]?.(mensaje, { scraper: this.nombre, ...metadata });
    }

    async getFuentes() {
        const { rows } = await query(`
            SELECT f.*, e.id as entidad_id, e.nombre as entidad_nombre
            FROM core.fuentes f
            JOIN core.entidades e ON e.id = f.entidad_id
            WHERE f.plataforma = $1 AND f.activa = true
        `, [this.plataforma]);
        return rows;
    }

    // Subclases implementan este método
    async scrapearFuente(fuente) {
        throw new Error('scrapearFuente() debe ser implementado por cada scraper');
    }

    async ejecutar() {
        const fuentes = await this.getFuentes();
        logger.info(`[${this.nombre}] Iniciando — ${fuentes.length} fuentes activas`);

        for (const fuente of fuentes) {
            await this.iniciarJob(fuente.id);
            try {
                await this.scrapearFuente(fuente);
                await this.finalizarJob('completado');
                await query(
                    'UPDATE core.fuentes SET ultima_sync = NOW() WHERE id = $1',
                    [fuente.id]
                );
            } catch (err) {
                this.stats.errores++;
                logger.error(`[${this.nombre}] Error en fuente ${fuente.handle}`, { error: err.message });
                await this.finalizarJob('fallido', err.message);
            }
        }

        logger.info(`[${this.nombre}] Completado`, this.stats);
        return this.stats;
    }
}

module.exports = BaseScraper;
