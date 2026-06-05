const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query } = require('../../config/db');
const logger = require('../../config/logger');

function signToken(userId, rol) {
    return jwt.sign(
        { sub: userId, rol },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h', issuer: 'simgp-tachira' }
    );
}

async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await query(
        'SELECT id, nombre, email, password_hash, rol, activo FROM core.usuarios WHERE email = $1',
        [email.toLowerCase().trim()]
    );

    if (!rows.length) {
        // Tiempo constante para evitar enumeración de usuarios
        await bcrypt.compare(password, '$2a$12$invalidhashfortiming00000000000000000000000000');
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = rows[0];
    if (!user.activo) return res.status(401).json({ error: 'Cuenta desactivada' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        logger.warn('Intento de login fallido', { email, ip: req.ip });
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = signToken(user.id, user.rol);
    logger.info('Login exitoso', { email: user.email, rol: user.rol });

    res.json({
        token,
        user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
        expires_in: process.env.JWT_EXPIRES_IN || '8h',
    });
}

async function me(req, res) {
    res.json({ user: req.user });
}

async function cambiarPassword(req, res) {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo) return res.status(400).json({ error: 'Faltan campos' });
    if (password_nuevo.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

    const { rows } = await query('SELECT password_hash FROM core.usuarios WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(password_nuevo, 12);
    await query('UPDATE core.usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    logger.info('Password cambiado', { user: req.user.email });
    res.json({ ok: true, mensaje: 'Contraseña actualizada' });
}

async function crearUsuario(req, res) {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos requeridos' });

    const hash = await bcrypt.hash(password, 12);
    try {
        const { rows } = await query(`
            INSERT INTO core.usuarios (nombre, email, password_hash, rol)
            VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol
        `, [nombre, email.toLowerCase(), hash, rol || 'monitor']);
        logger.info('Usuario creado', { email, rol, by: req.user.email });
        res.status(201).json({ ok: true, user: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' });
        throw err;
    }
}

async function listarUsuarios(_req, res) {
    const { rows } = await query(
        'SELECT id, nombre, email, rol, activo, ultimo_acceso, created_at FROM core.usuarios ORDER BY created_at DESC'
    );
    res.json({ ok: true, data: rows });
}

async function toggleUsuario(req, res) {
    const { rows } = await query(
        'UPDATE core.usuarios SET activo = NOT activo WHERE id = $1 RETURNING activo',
        [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, activo: rows[0].activo });
}

module.exports = { login, me, cambiarPassword, crearUsuario, listarUsuarios, toggleUsuario };
