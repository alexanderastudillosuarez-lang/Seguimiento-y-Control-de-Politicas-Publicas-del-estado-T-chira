/**
 * Scraper Telegram — Bot API
 * Lee mensajes de canales públicos configurados como fuentes
 */
const axios       = require('axios');
const BaseScraper = require('./base-scraper');
const logger      = require('../../config/logger');

class TelegramScraper extends BaseScraper {
    constructor() {
        super('TelegramScraper', 'telegram');
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.baseURL  = `https://api.telegram.org/bot${this.botToken}`;
        this.offsetsMap = {}; // offset por canal para no releer mensajes
    }

    async getUpdates(offset = 0, limit = 100) {
        const res = await axios.get(`${this.baseURL}/getUpdates`, {
            params: { offset, limit, timeout: 10, allowed_updates: ['channel_post', 'message'] },
        });
        return res.data.result || [];
    }

    async getChatHistory(chatId, limit = 50) {
        // Telegram Bot API no permite leer historial de canales directamente.
        // Usamos getUpdates para mensajes nuevos desde el último offset guardado.
        const offset = this.offsetsMap[chatId] || 0;
        const updates = await this.getUpdates(offset, limit);

        const mensajes = updates
            .filter(u => {
                const msg = u.channel_post || u.message;
                return msg && (msg.chat?.username === chatId.replace('@', '') || msg.chat?.id === chatId);
            })
            .map(u => u.channel_post || u.message);

        if (updates.length > 0) {
            this.offsetsMap[chatId] = updates[updates.length - 1].update_id + 1;
        }
        return mensajes;
    }

    limpiarTexto(msg) {
        let texto = msg.text || msg.caption || '';
        // Quitar emojis problemáticos para análisis pero mantener el texto
        return texto.replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}]/gu, ' ').trim();
    }

    mensajeToPublicacion(msg, fuente) {
        const texto = msg.text || msg.caption || '';
        return {
            entidad_id:       fuente.entidad_id,
            fuente_id:        fuente.id,
            id_externo:       String(msg.message_id),
            url_original:     fuente.url,
            contenido_raw:    texto,
            contenido_limpio: this.limpiarTexto(msg),
            vistas:           msg.views || 0,
            compartidos:      msg.forwards || 0,
            publicado_en:     new Date(msg.date * 1000),
        };
    }

    async scrapearFuente(fuente) {
        if (!this.botToken) {
            logger.warn('[Telegram] TELEGRAM_BOT_TOKEN no configurado — saltando');
            return;
        }

        const canal = fuente.handle || fuente.config?.canal || '';
        await this.log('info', `Leyendo canal Telegram: ${canal}`);

        try {
            const mensajes = await this.getChatHistory(canal, 50);
            for (const msg of mensajes) {
                if (!msg.text && !msg.caption) continue;
                this.stats.procesados++;
                try {
                    const pub = this.mensajeToPublicacion(msg, fuente);
                    await this.guardarPublicacion(pub);
                } catch (err) {
                    this.stats.errores++;
                    logger.warn('[Telegram] Error guardando mensaje', { error: err.message });
                }
            }
        } catch (err) {
            logger.error('[Telegram] Error accediendo al canal', { canal, error: err.message });
            throw err;
        }
    }
}

module.exports = TelegramScraper;
