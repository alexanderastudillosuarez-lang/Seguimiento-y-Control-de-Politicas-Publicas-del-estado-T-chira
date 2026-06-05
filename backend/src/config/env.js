/**
 * Validación de variables de entorno al arrancar.
 * Falla rápido si faltan variables críticas en producción.
 */
const REQUIRED_PROD = ['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD','JWT_SECRET'];
const OPTIONAL      = ['ANTHROPIC_API_KEY','OPENAI_API_KEY','TWITTER_BEARER_TOKEN',
                        'INSTAGRAM_ACCESS_TOKEN','FACEBOOK_ACCESS_TOKEN',
                        'TELEGRAM_BOT_TOKEN','TIKTOK_ACCESS_TOKEN'];

function validateEnv() {
    const env = process.env.NODE_ENV || 'development';
    const missing = [];

    if (env === 'production') {
        for (const key of REQUIRED_PROD) {
            if (!process.env[key]) missing.push(key);
        }
        if (missing.length) {
            console.error(`❌ Variables de entorno faltantes: ${missing.join(', ')}`);
            process.exit(1);
        }
    }

    const configured = OPTIONAL.filter(k => !!process.env[k]);
    const absent     = OPTIONAL.filter(k => !process.env[k]);

    console.log(`✅ Variables de entorno validadas (${env})`);
    if (configured.length) console.log(`   APIs configuradas: ${configured.join(', ')}`);
    if (absent.length)     console.log(`   APIs opcionales no configuradas: ${absent.join(', ')}`);
}

module.exports = { validateEnv };
