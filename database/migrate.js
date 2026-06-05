const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const client = new Client({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function migrate() {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    for (const file of files) {
        if (!file.endsWith('.sql')) continue;
        const { rows } = await client.query('SELECT 1 FROM _migrations WHERE filename=$1', [file]);
        if (rows.length > 0) {
            console.log(`⏭  Ya aplicada: ${file}`);
            continue;
        }
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO _migrations(filename) VALUES($1)', [file]);
        console.log(`✅ Migración aplicada: ${file}`);
    }

    console.log('\n🎉 Todas las migraciones completadas.');
    await client.end();
}

migrate().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
