require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const logger      = require('./config/logger');
const { pool }    = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Seguridad y middlewares ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Demasiadas solicitudes, intenta más tarde' },
}));

// ── Logging de requests ──
app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
    next();
});

// ── Health check ──
app.get('/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'conectada', timestamp: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', db: 'desconectada' });
    }
});

// ── Rutas API ──
app.use('/api/v1/etl',       require('./api/routes/etl-routes'));
app.use('/api/v1/dashboard', require('./api/routes/dashboard-routes'));

// ── Servir frontend estático ──
const path = require('path');
app.use(express.static(path.join(__dirname, '../../frontend')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../../frontend/index.html')));

// ── 404 ──
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── Error handler global ──
app.use((err, _req, res, _next) => {
    logger.error('Error no manejado', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Iniciar servidor y scheduler ──
app.listen(PORT, async () => {
    logger.info(`🚀 SIMGP-Táchira backend corriendo en puerto ${PORT}`);
    logger.info(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);

    // Iniciar scheduler ETL
    if (process.env.ETL_ENABLED !== 'false') {
        require('./etl/schedulers/etl-scheduler');
        logger.info('   Scheduler ETL activado');
    }

    // Ejecutar pipeline inicial al arrancar
    if (process.env.ETL_RUN_ON_START === 'true') {
        const { ejecutarPipeline } = require('./etl/pipeline');
        setTimeout(() => ejecutarPipeline(), 5000);
    }
});

module.exports = app;
