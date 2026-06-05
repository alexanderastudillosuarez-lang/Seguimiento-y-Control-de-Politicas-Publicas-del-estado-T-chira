const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const ctrl    = require('../controllers/auth-controller');
const { authMiddleware, requireRol } = require('../middlewares/auth-middleware');

const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
    skipSuccessfulRequests: true,
});

router.post('/login',            loginLimit, wrapAsync(ctrl.login));
router.get('/me',                authMiddleware, wrapAsync(ctrl.me));
router.put('/cambiar-password',  authMiddleware, wrapAsync(ctrl.cambiarPassword));

// Gestión de usuarios — solo admin y super_admin
router.post('/usuarios',         authMiddleware, requireRol('super_admin','admin'), wrapAsync(ctrl.crearUsuario));
router.get('/usuarios',          authMiddleware, requireRol('super_admin','admin'), wrapAsync(ctrl.listarUsuarios));
router.patch('/usuarios/:id/toggle', authMiddleware, requireRol('super_admin'), wrapAsync(ctrl.toggleUsuario));

function wrapAsync(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

module.exports = router;
