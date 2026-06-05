/**
 * Tests del clasificador IA (sin llamadas reales a API)
 */
const { clasificar, CATEGORIAS } = require('../src/services/ai/classifier');

// Forzar fallback para tests sin API keys
process.env.ANTHROPIC_API_KEY = '';
process.env.OPENAI_API_KEY    = '';

describe('Clasificador IA — Fallback', () => {
    test('detecta categoría SALUD', async () => {
        const r = await clasificar('Se inauguró el nuevo hospital ambulatorio en el municipio San Cristóbal');
        expect(r.categoria).toBe('salud');
    });

    test('detecta categoría VIALIDAD', async () => {
        const r = await clasificar('El gobernador supervisó el asfaltado de la carretera principal de Rubio');
        expect(r.categoria).toBe('vialidad');
    });

    test('detecta categoría EDUCACION', async () => {
        const r = await clasificar('Entrega de aulas y mobiliario escolar en liceo de Cárdenas');
        expect(r.categoria).toBe('educacion');
    });

    test('detecta municipio San Cristóbal', async () => {
        const r = await clasificar('Reunión en San Cristóbal con líderes comunitarios');
        expect(r.municipio).toBe('San Cristóbal');
    });

    test('retorna estructura completa', async () => {
        const r = await clasificar('Obras de infraestructura en Táchira');
        expect(r).toHaveProperty('categoria');
        expect(r).toHaveProperty('sentiment_score');
        expect(r).toHaveProperty('sentiment_label');
        expect(r).toHaveProperty('resumen');
        expect(r).toHaveProperty('motor_ia');
    });

    test('maneja texto vacío', async () => {
        const r = await clasificar('');
        expect(r.categoria).toBeDefined();
        expect(r.confianza).toBeLessThan(0.5);
    });

    test('CATEGORIAS contiene todas las categorías requeridas', () => {
        const requeridas = ['salud','educacion','vivienda','infraestructura','vialidad',
                            'agua','electricidad','produccion','seguridad','deporte','cultura'];
        requeridas.forEach(c => expect(CATEGORIAS).toContain(c));
    });
});
