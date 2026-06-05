/**
 * Clasificador IA — Usa Claude (primario) y OpenAI (fallback)
 * Detecta categoría, municipio, obra, organismo, coordenadas y más.
 */
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI    = require('openai');
const logger    = require('../../config/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CATEGORIAS = [
    'salud','educacion','vivienda','infraestructura','vialidad',
    'agua','electricidad','produccion','seguridad','deporte','cultura','otro'
];

const MUNICIPIOS_TACHIRA = [
    'San Cristóbal','Rubio','Táriba','Colón','La Fría','San Antonio',
    'Ureña','La Grita','El Piñal','Cordero','Coloncito','Palmira',
    'Michelena','Lobatera','Seboruco','Pregonero','Queniquea',
    'San Josecito','Capacho','Abejales','El Cobre','San Félix',
    'Santa Ana','San Rafael del Piñal','San José de Bolívar',
    'Delicias','Upata','San Simón','Ureña'
];

const SYSTEM_PROMPT = `Eres un sistema de análisis de información pública del Estado Táchira, Venezuela.
Analiza el texto y extrae información estructurada en JSON estricto.

Categorías válidas: ${CATEGORIAS.join(', ')}
Municipios del Táchira: ${MUNICIPIOS_TACHIRA.join(', ')}

Responde ÚNICAMENTE con JSON válido, sin texto adicional.`;

const USER_PROMPT = (texto) => `Analiza esta publicación y extrae:

"${texto}"

Responde con este JSON exacto:
{
  "categoria": "<una de las categorías válidas>",
  "subcategoria": "<tema específico>",
  "municipio": "<municipio del Táchira o null>",
  "organismo": "<institución responsable mencionada o null>",
  "tipo_actividad": "<inauguración|supervisión|reunión|entrega|recorrido|anuncio|otro>",
  "obra": "<nombre de la obra o proyecto o null>",
  "inversion": "<monto en bolívares o dólares mencionado o null>",
  "beneficiarios": "<número o descripción de beneficiarios o null>",
  "sector_afectado": "<descripción del sector geográfico o social>",
  "coordenadas": { "lat": null, "lng": null },
  "sentiment_score": <número entre -1.0 y 1.0>,
  "sentiment_label": "<muy_positivo|positivo|neutro|negativo|muy_negativo>",
  "palabras_clave": ["<kw1>","<kw2>","<kw3>"],
  "problema_social": "<problema social detectado o null>",
  "resumen": "<resumen en máximo 2 oraciones>",
  "confianza": <número entre 0 y 1>
}`;

async function clasificarConClaude(texto) {
    const message = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 800,
        messages:   [{ role: 'user', content: USER_PROMPT(texto) }],
        system:     SYSTEM_PROMPT,
    });
    return JSON.parse(message.content[0].text);
}

async function clasificarConOpenAI(texto) {
    const completion = await openai.chat.completions.create({
        model:    'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: USER_PROMPT(texto) },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 800,
        temperature: 0.1,
    });
    return JSON.parse(completion.choices[0].message.content);
}

function clasificacionFallback(texto) {
    const textoLower = texto.toLowerCase();
    let categoria = 'otro';
    const mapa = {
        salud:           ['hospital','salud','médico','clínica','ambulatorio','enfermera'],
        educacion:       ['escuela','liceo','universidad','educación','aula','docente'],
        vivienda:        ['vivienda','casa','hogar','habitacional','apartamento'],
        infraestructura: ['obra','construcción','edificio','infraestructura','proyecto'],
        vialidad:        ['vía','carretera','asfalt','calle','puente','bache'],
        agua:            ['agua','acueducto','tubería','hidro','suministro'],
        electricidad:    ['electricidad','luz','corpoelec','transformer','energía'],
        produccion:      ['producción','agro','cosecha','alimento','campo'],
        seguridad:       ['seguridad','policía','cicpc','delincu','crimen'],
        deporte:         ['deporte','estadio','cancha','atleta','juegos'],
        cultura:         ['cultura','arte','música','teatro','tradición'],
    };
    for (const [cat, keywords] of Object.entries(mapa)) {
        if (keywords.some(k => textoLower.includes(k))) { categoria = cat; break; }
    }
    const municipio = MUNICIPIOS_TACHIRA.find(m => textoLower.includes(m.toLowerCase())) || null;
    return {
        categoria, subcategoria: null, municipio, organismo: null,
        tipo_actividad: 'otro', obra: null, inversion: null,
        beneficiarios: null, sector_afectado: null,
        coordenadas: { lat: null, lng: null },
        sentiment_score: 0, sentiment_label: 'neutro',
        palabras_clave: [], problema_social: null,
        resumen: texto.substring(0, 150), confianza: 0.3,
    };
}

async function clasificar(texto) {
    if (!texto || texto.trim().length < 10) return clasificacionFallback(texto || '');

    const textoTruncado = texto.substring(0, 2000);

    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const resultado = await clasificarConClaude(textoTruncado);
            logger.debug('Clasificación Claude exitosa', { categoria: resultado.categoria });
            return { ...resultado, motor_ia: 'claude' };
        } catch (err) {
            logger.warn('Claude falló, intentando OpenAI', { error: err.message });
        }
    }

    if (process.env.OPENAI_API_KEY) {
        try {
            const resultado = await clasificarConOpenAI(textoTruncado);
            logger.debug('Clasificación OpenAI exitosa', { categoria: resultado.categoria });
            return { ...resultado, motor_ia: 'openai' };
        } catch (err) {
            logger.warn('OpenAI también falló, usando fallback', { error: err.message });
        }
    }

    return { ...clasificacionFallback(textoTruncado), motor_ia: 'fallback' };
}

module.exports = { clasificar, CATEGORIAS };
