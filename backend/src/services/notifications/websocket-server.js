/**
 * WebSocket server — push de eventos en tiempo real al dashboard
 * Escucha NOTIFY de PostgreSQL y reenvía a todos los clientes conectados
 */
const { WebSocketServer } = require('ws');
const { Client }           = require('pg');
const logger               = require('../../config/logger');

let wss  = null;
let pgListen = null;

function broadcast(tipo, payload) {
    if (!wss) return;
    const msg = JSON.stringify({ tipo, payload, ts: new Date().toISOString() });
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(msg);
    });
}

async function initPgListen() {
    pgListen = new Client({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'simgp_tachira',
        user:     process.env.DB_USER     || 'simgp_user',
        password: process.env.DB_PASSWORD || '',
    });

    await pgListen.connect();

    // Escuchar notificaciones de la función trigger en PostgreSQL
    await pgListen.query('LISTEN nueva_publicacion');
    await pgListen.query('LISTEN nueva_alerta');

    pgListen.on('notification', msg => {
        try {
            const payload = JSON.parse(msg.payload);
            broadcast(msg.channel, payload);
            logger.debug(`[WS] Broadcast: ${msg.channel}`, { clients: wss?.clients?.size || 0 });
        } catch (e) {
            logger.warn('[WS] Error parseando notificación PG', { error: e.message });
        }
    });

    pgListen.on('error', err => {
        logger.error('[WS] Error en pgListen', { error: err.message });
        setTimeout(initPgListen, 5000);
    });

    logger.info('[WS] PostgreSQL LISTEN activo (nueva_publicacion, nueva_alerta)');
}

function initWebSocketServer(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        logger.info('[WS] Cliente conectado', { ip, total: wss.clients.size });

        ws.send(JSON.stringify({ tipo: 'connected', payload: { msg: 'SIMGP-Táchira WebSocket activo' } }));

        const ping = setInterval(() => { if (ws.readyState === 1) ws.ping(); }, 30000);

        ws.on('pong',  ()    => logger.debug('[WS] Pong recibido'));
        ws.on('close', ()    => { clearInterval(ping); logger.info('[WS] Cliente desconectado', { total: wss.clients.size }); });
        ws.on('error', err   => logger.warn('[WS] Error en cliente', { error: err.message }));
    });

    // Iniciar listener de PostgreSQL en paralelo
    initPgListen().catch(err =>
        logger.warn('[WS] No se pudo conectar pgListen (sin BD), push desactivado', { error: err.message })
    );

    logger.info('[WS] WebSocket server iniciado en /ws');
    return { wss, broadcast };
}

module.exports = { initWebSocketServer, broadcast };
