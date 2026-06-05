/**
 * Scraper Instagram — Instagram Graph API (requiere token de acceso de página)
 * Para cuentas personales/gubernamentales se requiere conversión a cuenta profesional
 * y token de larga duración generado en Meta for Developers.
 */
const axios       = require('axios');
const BaseScraper = require('./base-scraper');
const logger      = require('../../config/logger');

class InstagramScraper extends BaseScraper {
    constructor() {
        super('InstagramScraper', 'instagram');
        this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
        this.baseURL     = 'https://graph.instagram.com/v18.0';
    }

    async getMediaList(igUserId, limit = 20) {
        const res = await axios.get(`${this.baseURL}/${igUserId}/media`, {
            params: {
                fields:       'id,caption,media_type,permalink,timestamp,like_count,comments_count',
                limit,
                access_token: this.accessToken,
            },
        });
        return res.data.data || [];
    }

    async getIgUserId() {
        const res = await axios.get(`${this.baseURL}/me`, {
            params: { fields: 'id,username', access_token: this.accessToken },
        });
        return res.data.id;
    }

    mediaToPublicacion(media, fuente) {
        const texto = media.caption || '';
        return {
            entidad_id:       fuente.entidad_id,
            fuente_id:        fuente.id,
            id_externo:       media.id,
            url_original:     media.permalink,
            contenido_raw:    texto,
            contenido_limpio: texto.replace(/#\w+/g, '').replace(/@\w+/g, '').trim(),
            likes:            media.like_count      || 0,
            comentarios:      media.comments_count  || 0,
            publicado_en:     new Date(media.timestamp),
        };
    }

    async scrapearFuente(fuente) {
        if (!this.accessToken) {
            logger.warn('[Instagram] INSTAGRAM_ACCESS_TOKEN no configurado — saltando');
            return;
        }

        await this.log('info', `Scrapeando Instagram: ${fuente.handle}`);

        try {
            const igUserId = fuente.config?.ig_user_id || await this.getIgUserId();
            const medias   = await this.getMediaList(igUserId, 20);

            for (const media of medias) {
                this.stats.procesados++;
                try {
                    const pub = this.mediaToPublicacion(media, fuente);
                    await this.guardarPublicacion(pub);
                } catch (err) {
                    this.stats.errores++;
                    logger.warn('[Instagram] Error guardando post', { id: media.id, error: err.message });
                }
                await new Promise(r => setTimeout(r, 300));
            }
        } catch (err) {
            if (err.response?.status === 401) {
                logger.error('[Instagram] Token inválido o expirado — renovar en Meta for Developers');
            }
            throw err;
        }
    }
}

module.exports = InstagramScraper;
