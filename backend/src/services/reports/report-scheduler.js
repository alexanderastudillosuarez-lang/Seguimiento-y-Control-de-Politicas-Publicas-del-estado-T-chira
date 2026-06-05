/**
 * Scheduler de reportes automáticos
 * Genera y guarda reportes PDF/Excel cada semana y mes
 */
const cron      = require('node-cron');
const path      = require('path');
const fs        = require('fs');
const logger    = require('../../config/logger');
const { generarExcelCompleto } = require('./excel-generator');
const { query } = require('../../config/db');
const { notificar } = require('../notifications/notificador');

const REPORTS_DIR = path.join(__dirname, '../../../../reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

function formatFecha(d) { return d.toISOString().split('T')[0]; }

async function guardarRegistroReporte(titulo, tipo, archivo, parametros) {
    await query(`
        INSERT INTO reportes.reportes (titulo, tipo, parametros, estado, archivo_url, generado_en)
        VALUES ($1, $2, $3, 'completado', $4, NOW())
    `, [titulo, tipo, JSON.stringify(parametros), archivo]).catch(e =>
        logger.warn('[ReportScheduler] No se pudo guardar registro', { error: e.message })
    );
}

async function generarReporteSemanal() {
    const hasta  = new Date();
    const desde  = new Date(hasta);
    desde.setDate(desde.getDate() - 7);

    const filtros  = { desde: formatFecha(desde), hasta: formatFecha(hasta) };
    const filename = `reporte-semanal-${filtros.desde}-${filtros.hasta}.xlsx`;
    const filepath = path.join(REPORTS_DIR, filename);

    try {
        logger.info('[ReportScheduler] Generando reporte semanal...');
        const wb = await generarExcelCompleto(filtros);
        await wb.xlsx.writeFile(filepath);
        await guardarRegistroReporte(
            `Reporte Semanal ${filtros.desde} — ${filtros.hasta}`,
            'resumen_ejecutivo', `/reports/${filename}`, filtros
        );
        logger.info('[ReportScheduler] Reporte semanal generado', { file: filename });

        await notificar({
            tipo:      'reporte-generado',
            severidad: 'info',
            titulo:    'Reporte semanal disponible',
            mensaje:   `Período: ${filtros.desde} al ${filtros.hasta}`,
        });
    } catch (err) {
        logger.error('[ReportScheduler] Error generando reporte semanal', { error: err.message });
    }
}

async function generarReporteMensual() {
    const hasta  = new Date();
    const desde  = new Date(hasta.getFullYear(), hasta.getMonth(), 1);

    const filtros  = { desde: formatFecha(desde), hasta: formatFecha(hasta) };
    const filename = `reporte-mensual-${hasta.getFullYear()}-${String(hasta.getMonth()+1).padStart(2,'0')}.xlsx`;
    const filepath = path.join(REPORTS_DIR, filename);

    try {
        logger.info('[ReportScheduler] Generando reporte mensual...');
        const wb = await generarExcelCompleto(filtros);
        await wb.xlsx.writeFile(filepath);
        await guardarRegistroReporte(
            `Reporte Mensual ${hasta.toLocaleString('es-VE', { month:'long', year:'numeric' })}`,
            'comparativo', `/reports/${filename}`, filtros
        );
        logger.info('[ReportScheduler] Reporte mensual generado', { file: filename });
    } catch (err) {
        logger.error('[ReportScheduler] Error generando reporte mensual', { error: err.message });
    }
}

function initReportScheduler() {
    // Reporte semanal — Lunes 7:00 AM Venezuela
    cron.schedule('0 7 * * 1', generarReporteSemanal, { timezone: 'America/Caracas' });

    // Reporte mensual — Día 1 de cada mes 8:00 AM
    cron.schedule('0 8 1 * *', generarReporteMensual, { timezone: 'America/Caracas' });

    logger.info('[ReportScheduler] Iniciado — Semanal (Lun 7am) · Mensual (Día 1, 8am)');
}

module.exports = { initReportScheduler, generarReporteSemanal, generarReporteMensual };
