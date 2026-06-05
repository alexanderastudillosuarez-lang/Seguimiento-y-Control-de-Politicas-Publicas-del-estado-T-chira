/**
 * Tests del pipeline ETL
 */

// Mock todos los scrapers
jest.mock('../src/etl/scrapers/instagram-scraper', () => jest.fn().mockImplementation(() => ({
    ejecutar: jest.fn().mockResolvedValue({ procesados: 5, nuevos: 3, errores: 0 }),
})));
jest.mock('../src/etl/scrapers/facebook-scraper', () => jest.fn().mockImplementation(() => ({
    ejecutar: jest.fn().mockResolvedValue({ procesados: 8, nuevos: 4, errores: 0 }),
})));
jest.mock('../src/etl/scrapers/twitter-scraper', () => jest.fn().mockImplementation(() => ({
    ejecutar: jest.fn().mockResolvedValue({ procesados: 12, nuevos: 6, errores: 1 }),
})));
jest.mock('../src/etl/scrapers/tiktok-scraper', () => jest.fn().mockImplementation(() => ({
    ejecutar: jest.fn().mockResolvedValue({ procesados: 4, nuevos: 2, errores: 0 }),
})));
jest.mock('../src/etl/scrapers/telegram-scraper', () => jest.fn().mockImplementation(() => ({
    ejecutar: jest.fn().mockResolvedValue({ procesados: 20, nuevos: 15, errores: 0 }),
})));
jest.mock('../src/etl/scrapers/noticias-scraper', () => jest.fn().mockImplementation(() => ({
    ejecutar: jest.fn().mockResolvedValue({ procesados: 30, nuevos: 10, errores: 2 }),
})));
jest.mock('../src/config/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    pool:  { connect: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() }) },
}));

const { ejecutarPipeline } = require('../src/etl/pipeline');

describe('Pipeline ETL', () => {
    test('ejecuta todas las plataformas y retorna resumen', async () => {
        const resultado = await ejecutarPipeline();
        expect(resultado).toHaveProperty('total_nuevos');
        expect(resultado).toHaveProperty('total_procesados');
        expect(resultado).toHaveProperty('duracion_ms');
        expect(resultado).toHaveProperty('por_plataforma');
        expect(resultado.total_nuevos).toBeGreaterThan(0);
    });

    test('filtra plataformas correctamente', async () => {
        const resultado = await ejecutarPipeline({ plataformas: ['Twitter', 'Telegram'] });
        expect(Object.keys(resultado.por_plataforma)).toEqual(
            expect.arrayContaining(['Twitter', 'Telegram'])
        );
        expect(Object.keys(resultado.por_plataforma)).not.toContain('Instagram');
    });

    test('maneja fallo de un scraper sin detener el resto', async () => {
        const InstagramScraper = require('../src/etl/scrapers/instagram-scraper');
        InstagramScraper.mockImplementationOnce(() => ({
            ejecutar: jest.fn().mockRejectedValue(new Error('API caída')),
        }));

        const resultado = await ejecutarPipeline({ plataformas: ['Instagram', 'Twitter'] });
        expect(resultado.por_plataforma.Instagram.estado).toBe('error');
        expect(resultado.por_plataforma.Twitter.estado).toBe('ok');
    });

    test('contabiliza totales correctamente', async () => {
        const resultado = await ejecutarPipeline();
        const sumaNuevos = Object.values(resultado.por_plataforma)
            .reduce((s, r) => s + (r.nuevos || 0), 0);
        expect(resultado.total_nuevos).toBe(sumaNuevos);
    });
});
