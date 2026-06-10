# SIMGP-Táchira
## Sistema Inteligente de Monitoreo de Gestión Pública del Estado Táchira

Dashboard ejecutivo en tiempo real para monitorear la actividad de la Gobernación del Estado Táchira, Alcaldías, Institutos Autónomos y Entes Descentralizados.

---

## Inicio rápido (desarrollo local)

### Prerrequisitos
- Node.js 18+
- Docker Desktop
- Git

### 1. Clonar y configurar

```bash
git clone https://github.com/alexanderastudillosuarez-lang/Seguimiento-y-Control-de-Politicas-Publicas-del-estado-T-chira.git
cd Seguimiento-y-Control-de-Politicas-Publicas-del-estado-T-chira

cp backend/.env.example backend/.env
# Editar backend/.env con tus credenciales
```

### 2. Levantar base de datos con Docker

```bash
docker-compose -f docker/docker-compose.yml up -d postgres redis
```

### 3. Instalar dependencias y migrar

```bash
npm install
npm run migrate
npm run seed
```

### 4. Iniciar servidor

```bash
npm run dev
# Backend: http://localhost:3000
# Dashboard: http://localhost:3000
# API Health: http://localhost:3000/health
```

---

## Despliegue en producción

### Opción A — Railway + Vercel (recomendado)

#### Backend en Railway
1. Crear cuenta en [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub Repo**
3. Seleccionar este repositorio
4. Railway detecta automáticamente `railway.json`
5. Agregar servicio **PostgreSQL** (con PostGIS):
   - Add Plugin → Database → PostgreSQL
6. Configurar variables de entorno en Railway:

```
NODE_ENV=production
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
JWT_SECRET=<generar con: openssl rand -hex 32>
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
TWITTER_BEARER_TOKEN=...
TELEGRAM_BOT_TOKEN=...
ETL_ENABLED=true
ETL_RUN_ON_START=true
```

7. Ejecutar migraciones (desde Railway Shell):
```bash
npm run migrate && npm run seed
```

#### Frontend en Vercel
1. Ir a [vercel.com](https://vercel.com) → New Project
2. Importar el mismo repositorio de GitHub
3. **Framework Preset**: Other
4. **Root Directory**: `frontend`
5. Agregar variable de entorno:
```
NEXT_PUBLIC_API_BASE=https://tu-backend.railway.app/api/v1
```
6. Click **Deploy**

> Editar `frontend/index.html` línea final:
> `window.API_BASE = 'https://tu-backend.railway.app/api/v1';`

---

### Opción B — VPS propio (Docker Compose)

```bash
# En el servidor
git clone <repo>
cd simgp-tachira

cp backend/.env.example .env.production
# Editar .env.production

# Levantar todo
docker-compose -f docker/docker-compose.prod.yml up -d

# Migrar
docker exec simgp_backend_prod npm run migrate
docker exec simgp_backend_prod npm run seed
```

---

### CI/CD automático (GitHub Actions)

El pipeline `.github/workflows/ci-cd.yml` ejecuta automáticamente al hacer push a `master`:

1. ✅ Tests con PostgreSQL real
2. 🐳 Build imagen Docker → GitHub Container Registry
3. 🚂 Deploy backend → Railway
4. ▲ Deploy frontend → Vercel

#### Secrets necesarios en GitHub:
| Secret | Descripción |
|--------|-------------|
| `RAILWAY_TOKEN` | Token de Railway (Settings → Tokens) |
| `VERCEL_TOKEN` | Token de Vercel (Settings → Tokens) |
| `VERCEL_ORG_ID` | ID de organización Vercel |
| `VERCEL_PROJECT_ID` | ID del proyecto Vercel |
| `CODECOV_TOKEN` | Opcional — cobertura de tests |

---

## Arquitectura

```
simgp-tachira/
├── frontend/               # Dashboard HTML/JS/CSS
│   ├── index.html          # Dashboard principal
│   └── assets/
│       ├── css/dashboard.css
│       └── js/
│           ├── api.js      # Cliente API
│           ├── charts.js   # Chart.js (8 tipos de gráficos)
│           ├── maps.js     # Leaflet maps
│           ├── exports.js  # PDF/Excel/CSV
│           └── dashboard.js
├── backend/
│   └── src/
│       ├── server.js
│       ├── config/         # DB, Redis, Logger, Env
│       ├── api/
│       │   ├── routes/     # dashboard, etl
│       │   └── controllers/
│       ├── etl/
│       │   ├── scrapers/   # Instagram, Facebook, Twitter, TikTok, Telegram, Noticias
│       │   ├── pipeline.js
│       │   └── schedulers/ # Cron 15min
│       └── services/
│           └── ai/         # Claude + OpenAI classifier
├── database/
│   ├── migrations/         # 007 migraciones SQL
│   ├── seeds/              # 29 municipios + entidades
│   └── migrate.js
├── docker/
│   ├── docker-compose.yml      # Desarrollo
│   ├── docker-compose.prod.yml # Producción
│   ├── Dockerfile.prod
│   └── nginx.conf
└── .github/workflows/ci-cd.yml
```

## Indicadores del Dashboard

| # | Indicador | Fuente |
|---|-----------|--------|
| 1 | Municipios visitados por Freddy Bernal | IA sobre publicaciones |
| 2 | Municipios pendientes por visitar | Comparativa 29 municipios |
| 3 | Visitas por municipio | Conteo de publicaciones |
| 4-6 | Obras inauguradas (día/semana/mes) | Clasificación IA |
| 7 | Obras por sector (12 categorías) | Clasificación IA |
| 8 | Problemas sociales recurrentes | NER con IA |
| 9 | Ranking municipios con incidencias | Agregación SQL |
| 10 | Tendencia histórica 6 meses | Series temporales |
| 11 | Mapa geográfico interactivo | PostGIS + Leaflet |
| 12 | Organismos más activos | Conteo por entidad |
| 13 | Alcaldías más activas | Filtro por tipo |
| 14 | Sentiment ciudadano en redes | Claude/OpenAI |

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, Bootstrap 5, Chart.js, Leaflet, DataTables |
| Backend | Node.js 20, Express 4 |
| Base de datos | PostgreSQL 15 + PostGIS |
| Cache | Redis 7 |
| IA | Claude API (Anthropic) + OpenAI GPT-4o-mini |
| ETL | Bull Queue + node-cron |
| Deploy | Railway + Vercel / Docker + Nginx |
| CI/CD | GitHub Actions |
