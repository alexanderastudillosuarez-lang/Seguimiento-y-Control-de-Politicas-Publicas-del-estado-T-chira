const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const { query }  = require('../../config/db');
const { authMiddleware, requirePermiso } = require('../middlewares/auth-middleware');
const { generarPDFEjecutivo }   = require('../../services/reports/pdf-generator');
const { generarExcelCompleto }  = require('../../services/reports/excel-generator');
const { getComparativaPeriodos, getSerieTemporalDiaria } = require('../../services/reports/queries');
const { generarReporteSemanal, generarReporteMensual }   = require('../../services/reports/report-scheduler');
const logger = require('../../config/logger');

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ── Exportar PDF ejecutivo ─────────────────────────────────
router.get('/exportar/pdf', authMiddleware, wrap(async (req, res) => {
    const filtros = {
        desde: req.query.desde || null,
        hasta: req.query.hasta || null,
    };
    logger.info('Exportando PDF', { user: req.user.email, filtros });

    const ts       = new Date().toISOString().split('T')[0];
    const filename = `SIMGP-Tachira-${ts}.pdf`;

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const pdfStream = await generarPDFEjecutivo(filtros);
    pdfStream.pipe(res);
}));

// ── Exportar Excel completo ────────────────────────────────
router.get('/exportar/excel', authMiddleware, wrap(async (req, res) => {
    const filtros = {
        desde:     req.query.desde     || null,
        hasta:     req.query.hasta     || null,
        municipio: req.query.municipio || null,
        categoria: req.query.categoria || null,
    };
    logger.info('Exportando Excel', { user: req.user.email, filtros });

    const ts       = new Date().toISOString().split('T')[0];
    const filename = `SIMGP-Tachira-${ts}.xlsx`;

    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const wb = await generarExcelCompleto(filtros);
    await wb.xlsx.write(res);
    res.end();
}));

// ── Comparativa entre dos períodos ────────────────────────
router.get('/comparativa', authMiddleware, wrap(async (req, res) => {
    const { p1desde, p1hasta, p2desde, p2hasta } = req.query;
    if (!p1desde || !p1hasta || !p2desde || !p2hasta) {
        return res.status(400).json({ error: 'Se requieren p1desde, p1hasta, p2desde, p2hasta' });
    }
    const data = await getComparativaPeriodos(p1desde, p1hasta, p2desde, p2hasta);
    res.json({ ok: true, data });
}));

// ── Serie temporal ─────────────────────────────────────────
router.get('/serie-temporal', authMiddleware, wrap(async (req, res) => {
    const { desde, hasta, agrupacion } = req.query;
    const data = await getSerieTemporalDiaria(desde, hasta, agrupacion || 'day');
    res.json({ ok: true, data });
}));

// ── Historial de reportes generados ───────────────────────
router.get('/historial', authMiddleware, wrap(async (_req, res) => {
    const { rows } = await query(`
        SELECT r.*, u.nombre AS generado_por_nombre
        FROM reportes.reportes r
        LEFT JOIN core.usuarios u ON u.id = r.generado_por
        ORDER BY r.generado_en DESC
        LIMIT 50
    `);
    res.json({ ok: true, data: rows });
}));

// ── Generar reporte bajo demanda ───────────────────────────
router.post('/generar', authMiddleware, requirePermiso('reportes:write'), wrap(async (req, res) => {
    const { tipo } = req.body;
    if (tipo === 'semanal') {
        generarReporteSemanal().catch(e => logger.error('Error reporte semanal', { error: e.message }));
    } else if (tipo === 'mensual') {
        generarReporteMensual().catch(e => logger.error('Error reporte mensual', { error: e.message }));
    } else {
        return res.status(400).json({ error: 'Tipo inválido. Usa: semanal | mensual' });
    }
    res.json({ ok: true, mensaje: `Reporte ${tipo} iniciado en segundo plano` });
}));

// ── Descargar reporte del historial ───────────────────────
router.get('/descargar/:filename', authMiddleware, (req, res) => {
    const filepath = path.join(__dirname, '../../../../reports', req.params.filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.download(filepath);
});

module.exports = router;
