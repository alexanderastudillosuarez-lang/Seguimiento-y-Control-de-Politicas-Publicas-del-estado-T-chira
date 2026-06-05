-- ============================================================
-- SIMGP-TÁCHIRA | Migración 002 — Tablas CORE
-- ============================================================

-- ------------------------------------------------------------
-- MUNICIPIOS
-- ------------------------------------------------------------
CREATE TABLE core.municipios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    codigo_ine      VARCHAR(10) UNIQUE,
    capital         VARCHAR(100),
    geom            GEOMETRY(MULTIPOLYGON, 4326),
    poblacion       INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_municipios_geom ON core.municipios USING GIST(geom);

-- ------------------------------------------------------------
-- TIPOS DE ENTIDAD (enum)
-- ------------------------------------------------------------
CREATE TYPE core.tipo_entidad AS ENUM (
    'gobernacion',
    'alcaldia',
    'instituto_autonomo',
    'ente_descentralizado',
    'ministerio',
    'organismo_seguridad',
    'otro'
);

CREATE TYPE core.nivel_entidad AS ENUM (
    'estadal',
    'municipal',
    'nacional_con_presencia'
);

-- ------------------------------------------------------------
-- ENTIDADES
-- ------------------------------------------------------------
CREATE TABLE core.entidades (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    nombre_corto    VARCHAR(80),
    tipo            core.tipo_entidad NOT NULL,
    nivel           core.nivel_entidad NOT NULL,
    municipio_id    INTEGER REFERENCES core.municipios(id),
    titular         VARCHAR(200),
    cargo_titular   VARCHAR(200),
    logo_url        TEXT,
    sitio_web       TEXT,
    email_oficial   VARCHAR(200),
    telefono        VARCHAR(50),
    descripcion     TEXT,
    redes_sociales  JSONB DEFAULT '{}',
    activo          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entidades_tipo  ON core.entidades(tipo);
CREATE INDEX idx_entidades_municipio ON core.entidades(municipio_id);
CREATE INDEX idx_entidades_activo ON core.entidades(activo);

-- ------------------------------------------------------------
-- ROLES Y USUARIOS
-- ------------------------------------------------------------
CREATE TYPE core.rol_usuario AS ENUM (
    'super_admin',
    'admin',
    'analista',
    'monitor',
    'api_client'
);

CREATE TABLE core.usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    email           VARCHAR(200) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             core.rol_usuario NOT NULL DEFAULT 'monitor',
    permisos        JSONB DEFAULT '{}',
    activo          BOOLEAN DEFAULT TRUE,
    ultimo_acceso   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FUENTES (cuentas/canales por plataforma)
-- ------------------------------------------------------------
CREATE TYPE core.plataforma AS ENUM (
    'instagram',
    'facebook',
    'twitter',
    'tiktok',
    'telegram',
    'web_oficial',
    'rss',
    'nota_prensa'
);

CREATE TABLE core.fuentes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_id      UUID NOT NULL REFERENCES core.entidades(id) ON DELETE CASCADE,
    plataforma      core.plataforma NOT NULL,
    handle          VARCHAR(200),
    url             TEXT NOT NULL,
    tipo            VARCHAR(50) DEFAULT 'perfil',
    verificada      BOOLEAN DEFAULT FALSE,
    seguidores      BIGINT DEFAULT 0,
    intervalo_sync  INTEGER DEFAULT 30,
    ultima_sync     TIMESTAMPTZ,
    activa          BOOLEAN DEFAULT TRUE,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fuentes_entidad   ON core.fuentes(entidad_id);
CREATE INDEX idx_fuentes_plataforma ON core.fuentes(plataforma);
CREATE INDEX idx_fuentes_activa    ON core.fuentes(activa);
