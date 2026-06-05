/**
 * Scraper TikTok — TikTok Research API / Display API
 * Requiere aprobación de TikTok for Developers.
 * Se usa web scraping como fallback para perfiles públicos.
 */
const axios       = require('axios');
const cheerio     = require('cheerio');
const BaseScraper = require('./base-scraper');
const logger      = require('../../config/logger');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class TikTokScraper extends BaseScraper {
    constructor() {
        super('TikTokScraper', 'tiktok');
        this.accessToken = process.env.TIKTOK_ACCESS_TOKEN;
        this.baseURL     = 'https://open.tiktokapis.com/v2';
    }

    // ── Vía API oficial (si tiene token) ──
    async getVideosByAPI(openId) {
        const res = await axios.post(`${this.baseURL}/video/list/`, {
            max_count: 20,
        }, {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            params: { fields: 'id,title,video_description,create_time,like_count,comment_count,share_count,view_count,share_url' },
        });
        return res.data.data?.videos || [];
    }

    // ── Fallback: scraping de perfil público ──
    async scrapePerfilPublico(username) {
        const url = `https://www.tiktok.com/@${username.replace('@', '')}`;
        try {
            const res = await axios.get(url, {
                timeout: 20000,
                headers: {
                    'User-Agent':      USER_AGENT,
                    'Accept-Language': 'es-VE,es;q=0.9',
                    'Accept':          'text/html,application/xhtml+xml',
                },
            });
            const $ = cheerio.load(res.data);

            // TikTok renderiza con Next.js — extraemos NEXT_DATA
            const nextDataScript = $('#__NEXT_DATA__').html() || $('script#__NEXT_DATA__').html();
            if (!nextDataScript) return [];

            const nextData = JSON.parse(nextDataScript);
            const videoList = nextData?.props?.pageProps?.items || [];

            return videoList.slice(0, 15).map(v => ({
                id:          v.id,
                descripcion: v.desc || '',
                likes:       v.stats?.diggCount    || 0,
                comentarios: v.stats?.commentCount || 0,
                compartidos: v.stats?.shareCount   || 0,
                vistas:      v.stats?.playCount    || 0,
                url:         `https://www.tiktok.com/@${username}/video/${v.id}`,
                fecha:       new Date(v.createTime * 1000),
            }));
        } catch (err) {
            logger.warn('[TikTok] Scraping de perfil falló', { username, error: err.message });
            return [];
        }
    }

    async scrapearFuente(fuente) {
        const handle = fuente.handle?.replace('@', '') || '';
        await this.log('info', `Scrapeando TikTok: @${handle}`);

        let videos = [];

        if (this.accessToken && fuente.config?.open_id) {
            try {
                videos = await this.getVideosByAPI(fuente.config.open_id);
                videos = videos.map(v => ({
                    id:          v.id,
                    descripcion: v.title || v.video_description || '',
                    likes:       v.like_count    || 0,
                    comentarios: v.comment_count || 0,
                    compartidos: v.share_count   || 0,
                    vistas:      v.view_count    || 0,
                    url:         v.share_url,
                    fecha:       new Date(v.create_time * 1000),
                }));
            } catch (err) {
                logger.warn('[TikTok] API falló, usando scraping', { error: err.message });
                videos = await this.scrapePerfilPublico(handle);
            }
        } else {
            videos = await this.scrapePerfilPublico(handle);
        }

        for (const video of videos) {
            if (!video.descripcion) continue;
            this.stats.procesados++;
            try {
                await this.guardarPublicacion({
                    entidad_id:       fuente.entidad_id,
                    fuente_id:        fuente.id,
                    id_externo:       video.id,
                    url_original:     video.url,
                    contenido_raw:    video.descripcion,
                    contenido_limpio: video.descripcion.replace(/#\w+/g, '').trim(),
                    likes:            video.likes,
                    comentarios:      video.comentarios,
                    compartidos:      video.compartidos,
                    vistas:           video.vistas,
                    publicado_en:     video.fecha,
                });
            } catch (err) {
                this.stats.errores++;
                logger.warn('[TikTok] Error guardando video', { error: err.message });
            }
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

module.exports = TikTokScraper;
