/**
 * Motor de alertas — evalúa reglas contra métricas en tiempo real
 * y dispara notificaciones por WebSocket, Telegram y correo.
 */
const { query }   = require('../../config/db');
const logger      = require('../../config/logger');
const { notificar } = require('./notificador');

// Reglas built-in que se evalúan en cada ciclo ETL
const REGLAS_BUILTIN = [
    {
        id:          'sentiment-negativo',
        nombre:      'Sentimiento muy negativo detectado',
        severidad:   'alta',
        evaluar:     async () => {
            const { rows } = await query(`
                SELECT COUNT(*) AS total
                FROM contenido.publicaciones
                WHERE sentiment_label IN ('negativo','muy_negativo')
                  AND publicado_en >= NOW() - INTERVAL '1 hour'
            `);
            return parseInt(rows[0].total) >= 10
                ? { disparada: true, valor: rows[0].total, msg: `${rows[0].total} publicaciones negativas en la última hora` }
                : { disparada: false };
        },
    },
    {
        id:          'inactividad-entidad',
        nombre:      'Entidad sin actividad en 48 horas',
        severidad:   'media',
        evaluar:     async () => {
            const { rows } = await query(`
                SELECT e.nombre_corto, MAX(p.publicado_en) AS ultima
                FROM core.entidades e
                LEFT JOIN contenido.publicaciones p ON p.entidad_id = e.id
                WHERE e.activo = true AND e.tipo = 'gobernacion'
                GROUP BY e.nombre_corto
                HAVING MAX(p.publicado_en) < NOW() - INTERVAL '48 hours'
                    OR MAX(p.publicado_en) IS NULL
            `);
            return rows.length > 0
                ? { disparada: true, valor: rows.length, msg: `${rows.map(r=>r.nombre_corto).join(', ')} sin actividad` }
                : { disparada: false };
        },
    },
    {
        id:          'pico-publicaciones',
        nombre:      'Pico inusual de publicaciones',
        severidad:   'info',
        evaluar:     async () => {
            const { rows } = await query(`
                SELECT COUNT(*) AS ultima_hora,
                       (SELECT COUNT(*)/24.0 FROM contenido.publicaciones
                        WHERE publicado_en >= NOW() - INTERVAL '7 days') AS promedio_hora
                FROM contenido.publicaciones
                WHERE publicado_en >= NOW() - INTERVAL '1 hour'
            `);
            const actual   = parseFloat(rows[0].ultima_hora);
            const promedio = parseFloat(rows[0].promedio_hora) || 1;
            return actual > promedio * 3
                ? { disparada: true, valor: actual, msg: `${actual} publicaciones en 1h (promedio: ${promedio.toFixed(1)})` }
                : { disparada: false };
        },
    },
    {
        id:          'municipio-sin-obras',
        nombre:      'Más de 15 días sin obras inauguradas',
        severidad:   'media',
        evaluar:     async () => {
            const { rows } = await query(`
                SELECT COUNT(*) AS total
                FROM contenido.metadatos_seguimiento m
                JOIN contenido.publicaciones p ON p.id = m.publicacion_id
                WHERE m.tipo_actividad = 'inauguración'
                  AND p.publicado_en >= NOW() - INTERVAL '15 days'
            `);
            return parseInt(rows[0].total) === 0
                ? { disparada: true, valor: 0, msg: 'Sin obras inauguradas en los últimos 15 días' }
                : { disparada: false };
        },
    },
];

async function yaNotificadaHoy(reglaId) {
    const { rows } = await query(`
        SELECT id FROM alertas.alertas
        WHERE tipo = $1 AND generada_en >= NOW() - INTERVAL '6 hours'
        LIMIT 1
    `, [reglaId]);
    return rows.length > 0;
}

async function guardarAlerta(reglaId, nombre, severidad, mensaje) {
    const { rows } = await query(`
        INSERT INTO alertas.alertas (tipo, severidad, titulo, mensaje)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `, [reglaId, severidad, nombre, mensaje]);
    return rows[0].id;
}

async function evaluarReglas() {
    logger.debug('[AlertEngine] Evaluando reglas...');

    for (const regla of REGLAS_BUILTIN) {
        try {
            if (await yaNotificadaHoy(regla.id)) continue;

            const resultado = await regla.evaluar();
            if (!resultado.disparada) continue;

            const alertaId = await guardarAlerta(regla.id, regla.nombre, regla.severidad, resultado.msg);
            logger.warn(`[AlertEngine] Alerta disparada: ${regla.nombre}`, { valor: resultado.valor });

            await notificar({
                id:        alertaId,
                tipo:      regla.id,
                severidad: regla.severidad,
                titulo:    regla.nombre,
                mensaje:   resultado.msg,
            });
        } catch (err) {
            logger.error(`[AlertEngine] Error evaluando regla ${regla.id}`, { error: err.message });
        }
    }
}

module.exports = { evaluarReglas };
