const { createClient } = require('redis');
const logger = require('./logger');

let client;

const getRedis = async () => {
    if (client && client.isOpen) return client;
    client = createClient({
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: 0,
    });
    client.on('error',   (err) => logger.error('Redis error', { error: err.message }));
    client.on('connect', ()    => logger.info('Redis conectado'));
    await client.connect();
    return client;
};

module.exports = { getRedis };
