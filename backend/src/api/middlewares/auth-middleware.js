const jwt    = require('jsonwebtoken');
const { query } = require('../../config/db');
const logger = require('../../config/logger');

const PERMISOS_ROL = {
    super_admin: ['*'],
    admin:       ['dashboard:read','etl:run','entidades:write','usuarios:read','alertas:write'],
    analista:    ['dashboard:read','reportes:write','alertas:read'],
    monitor:     ['dashboard:read','alertas:read'],
    api_client:  ['dashboard:read'],
};

async function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return res.status(401).json({ error: 'Token requerido' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const { rows } = await query(
            'SELECT id, nombre, email, rol, permisos, activo FROM core.usuarios WHERE id = $1',
            [payload.sub]
        );
        if (!rows.length || !rows[0].activo) {
            return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
        }
        req.user = rows[0];
        // Actualizar último acceso (sin await para no bloquear)
        query('UPDATE core.usuarios SET ultimo_acceso = NOW() WHERE id = $1', [payload.sub]).catch(() => {});
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado' });
        logger.warn('Token inválido', { error: err.message, ip: req.ip });
        return res.status(401).json({ error: 'Token inválido' });
    }
}

function requirePermiso(permiso) {
    return (req, res, next) => {
        const permisos = PERMISOS_ROL[req.user?.rol] || [];
        if (permisos.includes('*') || permisos.includes(permiso)) return next();
        logger.warn('Acceso denegado', { user: req.user?.email, permiso, path: req.path });
        return res.status(403).json({ error: 'Permisos insuficientes' });
    };
}

function requireRol(...roles) {
    return (req, res, next) => {
        if (roles.includes(req.user?.rol)) return next();
        return res.status(403).json({ error: `Se requiere rol: ${roles.join(' o ')}` });
    };
}

module.exports = { authMiddleware, requirePermiso, requireRol };
