/**
 * Scraper Facebook — Graph API v18
 * Requiere Page Access Token con permisos: pages_read_engagement, pages_show_list
 */
const axios       = require('axios');
const BaseScraper = require('./base-scraper');
const logger      = require('../../config/logger');

class FacebookScraper extends BaseScraper {
    constructor() {
        super('FacebookScraper', 'facebook');
        this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
        this.baseURL     = 'https://graph.facebook.com/v18.0';
    }

    async getPagePosts(pageId, limit = 25) {
        const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
        const res = await axios.get(`${this.baseURL}/${pageId}/posts`, {
            params: {
                fields:       'id,message,story,full_picture,permalink_url,created_time,reactions.summary(true),comments.summary(true),shares',
                limit,
                since,
                access_token: this.accessToken,
            },
        });
        return res.data.data || [];
    }

    async getPageId(pageSlug) {
        const res = await axios.get(`${this.baseURL}/${pageSlug}`, {
            params: { fields: 'id,name,fan_count', access_token: this.accessToken },
        });
        return res.data.id;
    }

    postToPublicacion(post, fuente) {
        const texto = post.message || post.story || '';
        return {
            entidad_id:       fuente.entidad_id,
            fuente_id:        fuente.id,
            id_externo:       post.id,
            url_original:     post.permalink_url,
            contenido_raw:    texto,
            contenido_limpio: texto,
            likes:            post.reactions?.summary?.total_count || 0,
            comentarios:      post.comments?.summary?.total_count  || 0,
            compartidos:      post.shares?.count || 0,
            publicado_en:     new Date(post.created_time),
        };
    }

    async scrapearFuente(fuente) {
        if (!this.accessToken) {
            logger.warn('[Facebook] FACEBOOK_ACCESS_TOKEN no configurado — saltando');
            return;
        }

        const pageSlug = fuente.handle || fuente.config?.page_slug || '';
        await this.log('info', `Scrapeando página Facebook: ${pageSlug}`);

        try {
            const pageId = fuente.config?.page_id || await this.getPageId(pageSlug);
            const posts  = await this.getPagePosts(pageId, 25);

            for (const post of posts) {
                if (!post.message && !post.story) continue;
                this.stats.procesados++;
                try {
                    const pub = this.postToPublicacion(post, fuente);
                    await this.guardarPublicacion(pub);
                } catch (err) {
                    this.stats.errores++;
                    logger.warn('[Facebook] Error guardando post', { id: post.id, error: err.message });
                }
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (err) {
            if (err.response?.status === 403) {
                logger.error('[Facebook] Permiso denegado — verificar scopes del token');
            }
            throw err;
        }
    }
}

module.exports = FacebookScraper;
