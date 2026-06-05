/**
 * Tests del BaseScraper con DB mockeada
 */

jest.mock('../src/config/db', () => ({
    query: jest.fn(),
}));

jest.mock('../src/services/ai/classifier', () => ({
    clasificar: jest.fn().mockResolvedValue({
        categoria: 'infraestructura', subcategoria: null,
        municipio: 'San Cristóbal', organismo: 'Gobernación Táchira',
        tipo_actividad: 'inauguración', obra: 'Vía principal',
        inversion: null, beneficiarios: null, sector_afectado: null,
        coordenadas: { lat: null, lng: null },
        sentiment_score: 0.8, sentiment_label: 'positivo',
        palabras_clave: ['obra', 'vía'], problema_social: null,
        resumen: 'Inauguración de vía en San Cristóbal',
        confianza: 0.85, motor_ia: 'mock',
    }),
}));

const { query } = require('../src/config/db');
const BaseScraper = require('../src/etl/scrapers/base-scraper');

describe('BaseScraper', () => {
    let scraper;

    beforeEach(() => {
        jest.clearAllMocks();
        scraper = new BaseScraper('TestScraper', 'test');
    });

    test('hashContenido genera hash SHA-256 de 64 chars', () => {
        const h = scraper.hashContenido('texto de prueba');
        expect(h).toHaveLength(64);
        expect(h).toMatch(/^[a-f0-9]+$/);
    });

    test('hashContenido es determinístico', () => {
        const h1 = scraper.hashContenido('mismo texto');
        const h2 = scraper.hashContenido('mismo texto');
        expect(h1).toBe(h2);
    });

    test('hashContenido varía con textos distintos', () => {
        const h1 = scraper.hashContenido('texto A');
        const h2 = scraper.hashContenido('texto B');
        expect(h1).not.toBe(h2);
    });

    test('existePublicacion retorna true si hay rows', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 'abc' }] });
        const existe = await scraper.existePublicacion('hash123');
        expect(existe).toBe(true);
    });

    test('existePublicacion retorna false si no hay rows', async () => {
        query.mockResolvedValueOnce({ rows: [] });
        const existe = await scraper.existePublicacion('hash456');
        expect(existe).toBe(false);
    });

    test('guardarPublicacion no inserta duplicados', async () => {
        // Simular que ya existe
        query.mockResolvedValueOnce({ rows: [{ id: 'existente' }] });
        const resultado = await scraper.guardarPublicacion({
            entidad_id: 'uuid-1', fuente_id: 'uuid-2',
            contenido_raw: 'Texto duplicado',
        });
        expect(resultado).toBeNull();
    });

    test('guardarPublicacion inserta nueva publicación', async () => {
        query
            .mockResolvedValueOnce({ rows: [] })                      // existePublicacion
            .mockResolvedValueOnce({ rows: [{ id: 'nuevo-uuid' }] })  // INSERT publicacion
            .mockResolvedValueOnce({ rows: [] });                     // INSERT metadatos

        const id = await scraper.guardarPublicacion({
            entidad_id:    'uuid-1',
            fuente_id:     'uuid-2',
            contenido_raw: 'Nueva publicación de prueba sobre obras en Táchira',
            publicado_en:  new Date(),
        });
        expect(id).toBe('nuevo-uuid');
        expect(scraper.stats.nuevos).toBe(1);
    });

    test('stats se inicializan en cero', () => {
        expect(scraper.stats.procesados).toBe(0);
        expect(scraper.stats.nuevos).toBe(0);
        expect(scraper.stats.errores).toBe(0);
    });

    test('scrapearFuente lanza error en clase base', async () => {
        await expect(scraper.scrapearFuente({})).rejects.toThrow('scrapearFuente()');
    });
});
