/**
 * Scheduler ETL — Cron jobs para recolección automática
 * Actualización cada 15 minutos con intervalos diferenciados por plataforma
 */
const cron   = require('node-cron');
const logger = require('../../config/logger');
const { ejecutarPipeline } = require('../pipeline');

let enEjecucion = false;

// Cada 15 minutos — todas las plataformas
cron.schedule('*/15 * * * *', async () => {
    if (enEjecucion) {
        logger.warn('[Scheduler] Pipeline ya en ejecución — omitiendo ciclo');
        return;
    }
    enEjecucion = true;
    logger.info('[Scheduler] Iniciando ciclo completo (cada 15 min)');
    try {
        await ejecutarPipeline();
    } catch (err) {
        logger.error('[Scheduler] Error en ciclo completo', { error: err.message });
    } finally {
        enEjecucion = false;
    }
}, { timezone: 'America/Caracas' });

// Cada 5 minutos — solo Telegram (más tiempo real)
cron.schedule('*/5 * * * *', async () => {
    logger.debug('[Scheduler] Ciclo Telegram (cada 5 min)');
    await ejecutarPipeline({ plataformas: ['Telegram'] }).catch(err =>
        logger.error('[Scheduler] Error Telegram', { error: err.message })
    );
}, { timezone: 'America/Caracas' });

// Cada hora — Noticias web (menos frecuente)
cron.schedule('0 * * * *', async () => {
    logger.info('[Scheduler] Ciclo Noticias (cada hora)');
    await ejecutarPipeline({ plataformas: ['Noticias'] }).catch(err =>
        logger.error('[Scheduler] Error Noticias', { error: err.message })
    );
}, { timezone: 'America/Caracas' });

// Snapshots diarios consolidados — 23:55 hora Venezuela
cron.schedule('55 23 * * *', async () => {
    logger.info('[Scheduler] Generando snapshots de cierre del día');
    const { pool } = require('../../config/db');
    const client = await pool.connect();
    try {
        const hoy = new Date().toISOString().split('T')[0];
        await client.query(`
            SELECT metricas.calcular_snapshot(id, $1)
            FROM core.entidades WHERE activo = true
        `, [hoy]);
        logger.info('[Scheduler] Snapshots diarios completados');
    } catch (err) {
        logger.error('[Scheduler] Error en snapshots diarios', { error: err.message });
    } finally {
        client.release();
    }
}, { timezone: 'America/Caracas' });

logger.info('✅ ETL Scheduler iniciado', {
    ciclos: ['Completo: cada 15 min', 'Telegram: cada 5 min', 'Noticias: cada hora'],
    zona_horaria: 'America/Caracas',
});
