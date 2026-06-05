/**
 * Notificador central — despacha a todos los canales configurados
 */
const { notificarAlerta }     = require('./telegram-notifier');
const { broadcast }           = require('./websocket-server');
const logger                  = require('../../config/logger');

async function notificar(alerta) {
    logger.info('[Notificador] Despachando alerta', { tipo: alerta.tipo, severidad: alerta.severidad });

    // 1. WebSocket → dashboard en tiempo real
    try {
        broadcast('nueva_alerta', alerta);
    } catch (err) {
        logger.warn('[Notificador] WebSocket broadcast falló', { error: err.message });
    }

    // 2. Telegram → administradores
    try {
        await notificarAlerta(alerta);
    } catch (err) {
        logger.warn('[Notificador] Telegram falló', { error: err.message });
    }
}

module.exports = { notificar };
