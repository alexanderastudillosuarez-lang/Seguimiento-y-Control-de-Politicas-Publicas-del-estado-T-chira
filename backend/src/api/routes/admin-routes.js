const express = require('express');
const router  = express.Router();
const { query }   = require('../../config/db');
const { authMiddleware, requireRol, requirePermiso } = require('../middlewares/auth-middleware');

// Todas las rutas admin requieren autenticación
router.use(authMiddleware);

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

/* ── ENTIDADES ────────────────────────────────────────────── */
router.get('/entidades', wrap(async (_req, res) => {
    const { rows } = await query(`
        SELECT e.*, m.nombre AS municipio_nombre,
               COUNT(f.id) AS total_fuentes
        FROM core.entidades e
        LEFT JOIN core.municipios m ON m.id = e.municipio_id
        LEFT JOIN core.fuentes f ON f.entidad_id = e.id
        GROUP BY e.id, m.nombre ORDER BY e.nombre
    `);
    res.json({ ok: true, data: rows });
}));

router.post('/entidades', requireRol('super_admin','admin'), wrap(async (req, res) => {
    const { nombre, nombre_corto, tipo, nivel, municipio_id, titular, cargo_titular, sitio_web, redes_sociales } = req.body;
    const { rows } = await query(`
        INSERT INTO core.entidades (nombre, nombre_corto, tipo, nivel, municipio_id, titular, cargo_titular, sitio_web, redes_sociales)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [nombre, nombre_corto, tipo, nivel, municipio_id || null, titular, cargo_titular, sitio_web, JSON.stringify(redes_sociales || {})]);
    res.status(201).json({ ok: true, data: rows[0] });
}));

router.put('/entidades/:id', requireRol('super_admin','admin'), wrap(async (req, res) => {
    const { nombre, nombre_corto, titular, cargo_titular, sitio_web, redes_sociales, activo } = req.body;
    const { rows } = await query(`
        UPDATE core.entidades SET
            nombre        = COALESCE($1, nombre),
            nombre_corto  = COALESCE($2, nombre_corto),
            titular       = COALESCE($3, titular),
            cargo_titular = COALESCE($4, cargo_titular),
            sitio_web     = COALESCE($5, sitio_web),
            redes_sociales = COALESCE($6::jsonb, redes_sociales),
            activo        = COALESCE($7, activo),
            updated_at    = NOW()
        WHERE id = $8 RETURNING *
    `, [nombre, nombre_corto, titular, cargo_titular, sitio_web,
        redes_sociales ? JSON.stringify(redes_sociales) : null, activo, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Entidad no encontrada' });
    res.json({ ok: true, data: rows[0] });
}));

/* ── FUENTES ──────────────────────────────────────────────── */
router.get('/fuentes', wrap(async (_req, res) => {
    const { rows } = await query(`
        SELECT f.*, e.nombre_corto AS entidad
        FROM core.fuentes f
        JOIN core.entidades e ON e.id = f.entidad_id
        ORDER BY f.plataforma, e.nombre_corto
    `);
    res.json({ ok: true, data: rows });
}));

router.post('/fuentes', requireRol('super_admin','admin'), wrap(async (req, res) => {
    const { entidad_id, plataforma, handle, url, intervalo_sync, config } = req.body;
    const { rows } = await query(`
        INSERT INTO core.fuentes (entidad_id, plataforma, handle, url, intervalo_sync, config)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [entidad_id, plataforma, handle, url, intervalo_sync || 30, JSON.stringify(config || {})]);
    res.status(201).json({ ok: true, data: rows[0] });
}));

router.patch('/fuentes/:id/toggle', requireRol('super_admin','admin'), wrap(async (req, res) => {
    const { rows } = await query(
        'UPDATE core.fuentes SET activa = NOT activa WHERE id = $1 RETURNING activa',
        [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fuente no encontrada' });
    res.json({ ok: true, activa: rows[0].activa });
}));

router.delete('/fuentes/:id', requireRol('super_admin'), wrap(async (req, res) => {
    await query('DELETE FROM core.fuentes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
}));

/* ── ALERTAS ──────────────────────────────────────────────── */
router.get('/alertas', wrap(async (req, res) => {
    const { rows } = await query(`
        SELECT a.*, e.nombre_corto AS entidad
        FROM alertas.alertas a
        LEFT JOIN core.entidades e ON e.id = a.entidad_id
        ORDER BY a.generada_en DESC LIMIT 100
    `);
    res.json({ ok: true, data: rows });
}));

router.patch('/alertas/:id/leer', wrap(async (req, res) => {
    await query('UPDATE alertas.alertas SET leida = true WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
}));

router.patch('/alertas/:id/resolver', wrap(async (req, res) => {
    await query(
        'UPDATE alertas.alertas SET resuelta = true, resuelta_en = NOW(), resuelta_por = $1 WHERE id = $2',
        [req.user.id, req.params.id]
    );
    res.json({ ok: true });
}));

/* ── ESTADÍSTICAS ADMIN ───────────────────────────────────── */
router.get('/stats', requireRol('super_admin','admin'), wrap(async (_req, res) => {
    const [entidades, fuentes, publicaciones, alertas, jobs] = await Promise.all([
        query('SELECT COUNT(*) FROM core.entidades WHERE activo = true'),
        query('SELECT COUNT(*) FROM core.fuentes WHERE activa = true'),
        query('SELECT COUNT(*) FROM contenido.publicaciones WHERE publicado_en >= NOW() - INTERVAL\'24h\''),
        query('SELECT COUNT(*) FROM alertas.alertas WHERE leida = false'),
        query("SELECT COUNT(*) FROM etl.jobs WHERE estado='en_proceso'"),
    ]);
    res.json({
        ok: true,
        data: {
            entidades_activas:      parseInt(entidades.rows[0].count),
            fuentes_activas:        parseInt(fuentes.rows[0].count),
            publicaciones_24h:      parseInt(publicaciones.rows[0].count),
            alertas_no_leidas:      parseInt(alertas.rows[0].count),
            jobs_en_proceso:        parseInt(jobs.rows[0].count),
        },
    });
}));

/* ── AUDIT LOG ────────────────────────────────────────────── */
router.get('/audit', requireRol('super_admin'), wrap(async (_req, res) => {
    const { rows } = await query(`
        SELECT a.*, u.nombre AS usuario_nombre
        FROM audit.log a
        LEFT JOIN core.usuarios u ON u.id = a.usuario_id
        ORDER BY a.created_at DESC LIMIT 200
    `);
    res.json({ ok: true, data: rows });
}));

module.exports = router;
