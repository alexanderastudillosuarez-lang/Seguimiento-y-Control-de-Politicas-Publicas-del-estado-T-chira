/**
 * Notificador Telegram — envía alertas al canal de administración
 */
const axios  = require('axios');
const logger = require('../../config/logger');

const ICONOS = { critica: '🚨', alta: '⚠️', media: '📢', baja: 'ℹ️', info: '📌' };

async function enviarTelegram(chatId, texto) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return false;
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id:    chatId,
            text:       texto,
            parse_mode: 'HTML',
        });
        return true;
    } catch (err) {
        logger.warn('[Telegram] Error enviando notificación', { error: err.message });
        return false;
    }
}

async function notificarAlerta(alerta) {
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!chatId) return;

    const icono = ICONOS[alerta.severidad] || '📌';
    const texto = [
        `${icono} <b>SIMGP-Táchira — Alerta ${alerta.severidad.toUpperCase()}</b>`,
        ``,
        `<b>${alerta.titulo}</b>`,
        alerta.mensaje,
        ``,
        `🕐 ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`,
    ].join('\n');

    await enviarTelegram(chatId, texto);
}

async function notificarResumenDiario(resumen) {
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!chatId) return;

    const texto = [
        `📊 <b>SIMGP-Táchira — Resumen del día</b>`,
        ``,
        `📰 Publicaciones: <b>${resumen.total_publicaciones}</b>`,
        `🏗 Obras inauguradas: <b>${resumen.obras_hoy}</b>`,
        `🗺 Municipios activos: <b>${resumen.municipios_activos}</b>`,
        `😊 Sentiment promedio: <b>${resumen.sentiment_promedio}</b>`,
        `⚠️ Alertas generadas: <b>${resumen.alertas}</b>`,
        ``,
        `🕐 ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`,
    ].join('\n');

    await enviarTelegram(chatId, texto);
}

module.exports = { notificarAlerta, notificarResumenDiario };
