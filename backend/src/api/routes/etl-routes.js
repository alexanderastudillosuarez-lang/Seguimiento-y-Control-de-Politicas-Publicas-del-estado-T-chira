const express = require('express');
const router  = express.Router();
const logger  = require('../../config/logger');
const { ejecutarPipeline } = require('../../etl/pipeline');
const { query } = require('../../config/db');

// Ejecutar pipeline manualmente
router.post('/run', async (req, res) => {
    const { plataformas } = req.body;
    logger.info('Pipeline ejecutado manualmente', { plataformas });
    ejecutarPipeline({ plataformas }).catch(err =>
        logger.error('Error en pipeline manual', { error: err.message })
    );
    res.json({ mensaje: 'Pipeline iniciado en segundo plano' });
});

// Estado de los últimos jobs
router.get('/jobs', async (_req, res) => {
    try {
        const { rows } = await query(`
            SELECT j.*, f.plataforma, f.handle, e.nombre as entidad
            FROM etl.jobs j
            LEFT JOIN core.fuentes f ON f.id = j.fuente_id
            LEFT JOIN core.entidades e ON e.id = f.entidad_id
            ORDER BY j.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Estadísticas del pipeline
router.get('/stats', async (_req, res) => {
    try {
        const { rows } = await query(`
            SELECT
                plataforma,
                COUNT(*)                                           AS total_jobs,
                SUM(items_nuevos)                                  AS total_nuevos,
                SUM(items_procesados)                              AS total_procesados,
                ROUND(AVG(duracion_ms)::numeric, 0)                AS duracion_promedio_ms,
                SUM(CASE WHEN estado='fallido' THEN 1 ELSE 0 END)  AS jobs_fallidos,
                MAX(completado_en)                                 AS ultima_ejecucion
            FROM etl.jobs j
            LEFT JOIN core.fuentes f ON f.id = j.fuente_id
            WHERE j.created_at > NOW() - INTERVAL '24 hours'
            GROUP BY plataforma
            ORDER BY total_nuevos DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
