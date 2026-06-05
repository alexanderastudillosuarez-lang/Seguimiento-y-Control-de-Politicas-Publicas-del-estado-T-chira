/**
 * Scraper Noticias — RSS + Web scraping con Cheerio
 * Portales de noticias de Táchira y medios nacionales con presencia regional
 */
const axios       = require('axios');
const cheerio     = require('cheerio');
const RSSParser   = require('rss-parser');
const BaseScraper = require('./base-scraper');
const logger      = require('../../config/logger');

const rssParser = new RSSParser({ timeout: 10000 });

// Fuentes RSS / portales que se scrapean directamente
const FUENTES_NOTICIAS = [
    { nombre: 'Diario La Nación',     tipo: 'rss',  url: 'https://lanacion.com.ve/feed/' },
    { nombre: 'Diario Frontera',      tipo: 'rss',  url: 'https://diariofrontera.com/feed/' },
    { nombre: 'Táchira en Acción',    tipo: 'rss',  url: 'https://tachiraenaccion.com/feed/' },
    { nombre: 'Correo del Caroní',    tipo: 'rss',  url: 'https://www.correodelcaroni.com/feed/' },
    { nombre: 'El Pitazo',            tipo: 'rss',  url: 'https://elpitazo.net/feed/' },
    { nombre: 'Gobierno Táchira Web', tipo: 'web',  url: 'https://www.tachira.gob.ve/noticias/' },
];

const PALABRAS_CLAVE = [
    'Bernal','Táchira','gobernación','alcaldía','obra','inauguración',
    'inversión','gobierno regional','municipio','Táchira',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function contienePalabraClave(texto) {
    if (!texto) return false;
    const t = texto.toLowerCase();
    return PALABRAS_CLAVE.some(p => t.includes(p.toLowerCase()));
}

class NoticiasScraper extends BaseScraper {
    constructor() {
        super('NoticiasScraper', 'rss');
    }

    async scrapearRSS(fuente, fuenteDB) {
        let feed;
        try {
            feed = await rssParser.parseURL(fuente.url);
        } catch (err) {
            logger.warn(`[Noticias] RSS no disponible: ${fuente.url}`, { error: err.message });
            return;
        }

        const items = (feed.items || []).slice(0, 30);
        for (const item of items) {
            const texto = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;
            if (!contienePalabraClave(texto)) continue;

            this.stats.procesados++;
            try {
                await this.guardarPublicacion({
                    entidad_id:       fuenteDB.entidad_id,
                    fuente_id:        fuenteDB.id,
                    id_externo:       item.guid || item.link,
                    url_original:     item.link,
                    contenido_raw:    texto,
                    contenido_limpio: texto.replace(/<[^>]+>/g, '').trim(),
                    publicado_en:     item.pubDate ? new Date(item.pubDate) : new Date(),
                });
            } catch (err) {
                this.stats.errores++;
                logger.warn('[Noticias] Error guardando item RSS', { error: err.message });
            }
        }
    }

    async scrapearWeb(fuente, fuenteDB) {
        let html;
        try {
            const res = await axios.get(fuente.url, {
                timeout: 15000,
                headers: { 'User-Agent': USER_AGENT },
            });
            html = res.data;
        } catch (err) {
            logger.warn(`[Noticias] Web no disponible: ${fuente.url}`, { error: err.message });
            return;
        }

        const $ = cheerio.load(html);
        const articulos = [];

        // Selectores genéricos para páginas de noticias
        $('article, .noticia, .post, .entry, [class*="news-item"]').each((_, el) => {
            const titulo = $(el).find('h1,h2,h3,h4').first().text().trim();
            const cuerpo = $(el).find('p').map((_, p) => $(p).text().trim()).get().join(' ');
            const link   = $(el).find('a').first().attr('href');
            const texto  = `${titulo} ${cuerpo}`;

            if (titulo && contienePalabraClave(texto)) {
                articulos.push({ titulo, cuerpo, link: link ? new URL(link, fuente.url).href : fuente.url });
            }
        });

        for (const art of articulos.slice(0, 20)) {
            this.stats.procesados++;
            try {
                const textoCompleto = `${art.titulo}. ${art.cuerpo}`;
                await this.guardarPublicacion({
                    entidad_id:       fuenteDB.entidad_id,
                    fuente_id:        fuenteDB.id,
                    id_externo:       art.link,
                    url_original:     art.link,
                    contenido_raw:    textoCompleto,
                    contenido_limpio: textoCompleto,
                    publicado_en:     new Date(),
                });
            } catch (err) {
                this.stats.errores++;
            }
        }
    }

    async scrapearFuentesExternas(fuenteDB) {
        for (const fuente of FUENTES_NOTICIAS) {
            logger.debug(`[Noticias] Procesando: ${fuente.nombre}`);
            if (fuente.tipo === 'rss') {
                await this.scrapearRSS(fuente, fuenteDB);
            } else {
                await this.scrapearWeb(fuente, fuenteDB);
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    async scrapearFuente(fuente) {
        await this.log('info', `Scrapeando noticias — fuente: ${fuente.url}`);

        // Scraper del sitio web de la fuente configurada en BD
        if (fuente.url) {
            await this.scrapearWeb({ url: fuente.url, tipo: 'web' }, fuente);
        }

        // Adicionalmente scrapear portales de noticias de Táchira
        await this.scrapearFuentesExternas(fuente);
    }
}

module.exports = NoticiasScraper;
