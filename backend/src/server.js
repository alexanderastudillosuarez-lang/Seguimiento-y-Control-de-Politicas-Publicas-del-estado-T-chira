require('dotenv').config();
const http        = require('http');
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const logger      = require('./config/logger');
const { validateEnv } = require('./config/env');
const { pool }    = require('./config/db');

validateEnv();

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

// ── Seguridad y middlewares ────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Demasiadas solicitudes, intenta más tarde' },
    skip: req => req.path === '/health',
}));

// ── Logging de requests ────────────────────────────────────
app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
    next();
});

// ── Health check ───────────────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'conectada', version: '1.0.0', timestamp: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', db: 'desconectada' });
    }
});

// ── Rutas API ──────────────────────────────────────────────
app.use('/api/v1/auth',      require('./api/routes/auth-routes'));
app.use('/api/v1/etl',       require('./api/routes/etl-routes'));
app.use('/api/v1/dashboard', require('./api/routes/dashboard-routes'));
app.use('/api/v1/admin',     require('./api/routes/admin-routes'));

// ── Frontend estático ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, '../../frontend/views/admin/index.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '../../frontend/login.html')));
app.get('*',      (_req, res) => res.sendFile(path.join(__dirname, '../../frontend/index.html')));

// ── 404 y error handler ────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
    logger.error('Error no manejado', { error: err.message, stack: err.stack?.split('\n')[0] });
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Iniciar servidor ───────────────────────────────────────
server.listen(PORT, async () => {
    logger.info(`🚀 SIMGP-Táchira corriendo en puerto ${PORT}`);
    logger.info(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);

    // WebSocket server
    const { initWebSocketServer } = require('./services/notifications/websocket-server');
    initWebSocketServer(server);
    logger.info('   WebSocket iniciado en /ws');

    // Scheduler ETL
    if (process.env.ETL_ENABLED !== 'false') {
        require('./etl/schedulers/etl-scheduler');
        logger.info('   Scheduler ETL activado (cada 15 min)');
    }

    // Pipeline inicial
    if (process.env.ETL_RUN_ON_START === 'true') {
        const { ejecutarPipeline } = require('./etl/pipeline');
        setTimeout(() => ejecutarPipeline(), 5000);
    }
});

module.exports = app;
