const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const client = new Client({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function seed() {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    const files = fs.readdirSync(__dirname)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
        try {
            await client.query(sql);
            console.log(`✅ Seed aplicado: ${file}`);
        } catch (err) {
            console.warn(`⚠️  Seed ${file}: ${err.message}`);
        }
    }

    console.log('\n🎉 Seeds completados.');
    await client.end();
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
