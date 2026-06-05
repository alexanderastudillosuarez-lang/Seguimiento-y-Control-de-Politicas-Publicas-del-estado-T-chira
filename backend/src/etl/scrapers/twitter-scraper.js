/**
 * Scraper X/Twitter — API v2 Bearer Token
 * Busca tweets de cuentas oficiales y menciones de términos clave
 */
const axios      = require('axios');
const BaseScraper = require('./base-scraper');
const logger     = require('../../config/logger');

const TERMINOS_BUSQUEDA = [
    'Freddy Bernal Táchira',
    'Gobernación Táchira',
    'Gobernador Táchira',
    '@FreddyBernal',
];

const DELAY_MS = 1500; // Respeto al rate limit de Twitter API v2

class TwitterScraper extends BaseScraper {
    constructor() {
        super('TwitterScraper', 'twitter');
        this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
        this.baseURL     = 'https://api.twitter.com/2';
    }

    get headers() {
        return { Authorization: `Bearer ${this.bearerToken}` };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getTweetsByUser(username, maxResults = 20) {
        // Paso 1: obtener user_id
        const userRes = await axios.get(`${this.baseURL}/users/by/username/${username}`, {
            headers: this.headers,
            params:  { 'user.fields': 'id,name,public_metrics' },
        });
        const userId = userRes.data.data?.id;
        if (!userId) throw new Error(`Usuario @${username} no encontrado`);

        await this.sleep(DELAY_MS);

        // Paso 2: obtener tweets recientes
        const tweetsRes = await axios.get(`${this.baseURL}/users/${userId}/tweets`, {
            headers: this.headers,
            params:  {
                max_results:  Math.min(maxResults, 100),
                'tweet.fields': 'created_at,public_metrics,entities,text',
                exclude:       'retweets,replies',
                start_time:    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
        });
        return tweetsRes.data.data || [];
    }

    async searchTweets(query, maxResults = 20) {
        const res = await axios.get(`${this.baseURL}/tweets/search/recent`, {
            headers: this.headers,
            params:  {
                query:        `${query} lang:es -is:retweet`,
                max_results:  Math.min(maxResults, 100),
                'tweet.fields': 'created_at,public_metrics,author_id,entities',
            },
        });
        return res.data.data || [];
    }

    tweetToPublicacion(tweet, fuente) {
        return {
            entidad_id:      fuente.entidad_id,
            fuente_id:       fuente.id,
            id_externo:      tweet.id,
            url_original:    `https://twitter.com/i/web/status/${tweet.id}`,
            contenido_raw:   tweet.text,
            contenido_limpio: tweet.text.replace(/https?:\/\/\S+/g, '').trim(),
            likes:           tweet.public_metrics?.like_count    || 0,
            comentarios:     tweet.public_metrics?.reply_count   || 0,
            compartidos:     tweet.public_metrics?.retweet_count || 0,
            vistas:          tweet.public_metrics?.impression_count || 0,
            publicado_en:    new Date(tweet.created_at),
        };
    }

    async scrapearFuente(fuente) {
        if (!this.bearerToken) {
            logger.warn('[Twitter] TWITTER_BEARER_TOKEN no configurado — saltando');
            return;
        }

        const handle = fuente.handle?.replace('@', '') || '';
        await this.log('info', `Scrapeando @${handle}`);

        try {
            // Tweets del perfil
            const tweets = await this.getTweetsByUser(handle, 20);
            for (const tweet of tweets) {
                this.stats.procesados++;
                try {
                    const pub = this.tweetToPublicacion(tweet, fuente);
                    await this.guardarPublicacion(pub);
                } catch (err) {
                    this.stats.errores++;
                    logger.warn('[Twitter] Error guardando tweet', { id: tweet.id, error: err.message });
                }
                await this.sleep(200);
            }

            // Búsquedas por términos
            for (const termino of TERMINOS_BUSQUEDA) {
                await this.sleep(DELAY_MS);
                const resultados = await this.searchTweets(termino, 15).catch(e => {
                    logger.warn('[Twitter] Búsqueda fallida', { termino, error: e.message });
                    return [];
                });
                for (const tweet of resultados) {
                    this.stats.procesados++;
                    try {
                        const pub = this.tweetToPublicacion(tweet, fuente);
                        await this.guardarPublicacion(pub);
                    } catch (err) {
                        this.stats.errores++;
                    }
                }
            }
        } catch (err) {
            if (err.response?.status === 429) {
                logger.warn('[Twitter] Rate limit alcanzado — esperando 15 min');
                await this.sleep(15 * 60 * 1000);
            } else {
                throw err;
            }
        }
    }
}

module.exports = TwitterScraper;
