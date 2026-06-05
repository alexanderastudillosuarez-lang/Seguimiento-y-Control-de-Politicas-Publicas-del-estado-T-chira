const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'simgp_tachira',
    user:     process.env.DB_USER     || 'simgp_user',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
    logger.error('Error inesperado en pool PostgreSQL', { error: err.message });
});

pool.on('connect', () => {
    logger.debug('Nueva conexión establecida con PostgreSQL');
});

const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Query ejecutada', { duration_ms: duration, rows: result.rowCount });
        return result;
    } catch (err) {
        logger.error('Error en query PostgreSQL', { query: text.substring(0, 100), error: err.message });
        throw err;
    }
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
