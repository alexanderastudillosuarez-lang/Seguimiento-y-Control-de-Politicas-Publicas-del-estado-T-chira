/**
 * Pipeline ETL central — orquesta todos los scrapers
 * Ejecuta en paralelo controlado y registra métricas globales
 */
const InstagramScraper = require('./scrapers/instagram-scraper');
const FacebookScraper  = require('./scrapers/facebook-scraper');
const TwitterScraper   = require('./scrapers/twitter-scraper');
const TikTokScraper    = require('./scrapers/tiktok-scraper');
const TelegramScraper  = require('./scrapers/telegram-scraper');
const NoticiasScraper  = require('./scrapers/noticias-scraper');
const logger           = require('../config/logger');
const { query }        = require('../config/db');

const SCRAPERS = [
    { clase: InstagramScraper, nombre: 'Instagram' },
    { clase: FacebookScraper,  nombre: 'Facebook'  },
    { clase: TwitterScraper,   nombre: 'Twitter'   },
    { clase: TikTokScraper,    nombre: 'TikTok'    },
    { clase: TelegramScraper,  nombre: 'Telegram'  },
    { clase: NoticiasScraper,  nombre: 'Noticias'  },
];

async function ejecutarPipeline(opciones = {}) {
    const inicio    = Date.now();
    const plataformas = opciones.plataformas || SCRAPERS.map(s => s.nombre);
    const resultados  = {};

    logger.info('═══ PIPELINE ETL INICIADO ═══', {
        plataformas,
        hora: new Date().toISOString(),
    });

    const scrapersFiltrados = SCRAPERS.filter(s => plataformas.includes(s.nombre));

    // Ejecutar con concurrencia controlada (máx 3 en paralelo)
    const concurrencia = opciones.concurrencia || 3;
    for (let i = 0; i < scrapersFiltrados.length; i += concurrencia) {
        const lote = scrapersFiltrados.slice(i, i + concurrencia);
        const promesas = lote.map(async ({ clase, nombre }) => {
            const scraper = new clase();
            try {
                const stats = await scraper.ejecutar();
                resultados[nombre] = { estado: 'ok', ...stats };
            } catch (err) {
                logger.error(`Pipeline: scraper ${nombre} falló`, { error: err.message });
                resultados[nombre] = { estado: 'error', error: err.message };
            }
        });
        await Promise.all(promesas);
    }

    const duracion = Date.now() - inicio;
    const totalNuevos    = Object.values(resultados).reduce((s, r) => s + (r.nuevos    || 0), 0);
    const totalProcesados = Object.values(resultados).reduce((s, r) => s + (r.procesados || 0), 0);
    const totalErrores   = Object.values(resultados).reduce((s, r) => s + (r.errores   || 0), 0);

    // Actualizar snapshots diarios para todas las entidades activas
    if (totalNuevos > 0) {
        await actualizarSnapshots();
    }

    const resumen = {
        duracion_ms:      duracion,
        total_procesados: totalProcesados,
        total_nuevos:     totalNuevos,
        total_errores:    totalErrores,
        por_plataforma:   resultados,
        completado_en:    new Date().toISOString(),
    };

    logger.info('═══ PIPELINE ETL COMPLETADO ═══', resumen);
    return resumen;
}

async function actualizarSnapshots() {
    try {
        const { rows: entidades } = await query(
            "SELECT id FROM core.entidades WHERE activo = true"
        );
        const hoy = new Date().toISOString().split('T')[0];
        for (const { id } of entidades) {
            await query('SELECT metricas.calcular_snapshot($1, $2)', [id, hoy]);
        }
        logger.info('Snapshots diarios actualizados', { entidades: entidades.length });
    } catch (err) {
        logger.error('Error actualizando snapshots', { error: err.message });
    }
}

module.exports = { ejecutarPipeline };
