-- ============================================================
-- SIMGP-TÁCHIRA | Migración 003 — Tablas CONTENIDO
-- ============================================================

CREATE TYPE contenido.sentiment_label AS ENUM (
    'muy_positivo',
    'positivo',
    'neutro',
    'negativo',
    'muy_negativo'
);

-- ------------------------------------------------------------
-- PUBLICACIONES
-- ------------------------------------------------------------
CREATE TABLE contenido.publicaciones (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_id          UUID NOT NULL REFERENCES core.entidades(id),
    fuente_id           UUID REFERENCES core.fuentes(id),
    plataforma          core.plataforma NOT NULL,
    id_externo          VARCHAR(500),
    url_original        TEXT,
    contenido_raw       TEXT,
    contenido_limpio    TEXT,
    resumen_ia          TEXT,
    idioma              VARCHAR(10) DEFAULT 'es',
    likes               BIGINT DEFAULT 0,
    comentarios         BIGINT DEFAULT 0,
    compartidos         BIGINT DEFAULT 0,
    vistas              BIGINT DEFAULT 0,
    alcance_estimado    BIGINT DEFAULT 0,
    sentiment_score     FLOAT CHECK (sentiment_score BETWEEN -1 AND 1),
    sentiment_label     contenido.sentiment_label DEFAULT 'neutro',
    temas               JSONB DEFAULT '[]',
    entidades_mencionadas JSONB DEFAULT '[]',
    hash_contenido      VARCHAR(64) UNIQUE,
    publicado_en        TIMESTAMPTZ,
    recolectado_en      TIMESTAMPTZ DEFAULT NOW(),
    procesado_ia        BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pub_entidad      ON contenido.publicaciones(entidad_id);
CREATE INDEX idx_pub_fuente       ON contenido.publicaciones(fuente_id);
CREATE INDEX idx_pub_plataforma   ON contenido.publicaciones(plataforma);
CREATE INDEX idx_pub_publicado    ON contenido.publicaciones(publicado_en DESC);
CREATE INDEX idx_pub_sentiment    ON contenido.publicaciones(sentiment_label);
CREATE INDEX idx_pub_hash         ON contenido.publicaciones(hash_contenido);
CREATE INDEX idx_pub_fts          ON contenido.publicaciones USING GIN(to_tsvector('spanish', COALESCE(contenido_limpio,'')));

-- ------------------------------------------------------------
-- ETIQUETAS
-- ------------------------------------------------------------
CREATE TABLE contenido.etiquetas (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre      VARCHAR(100) UNIQUE NOT NULL,
    categoria   VARCHAR(100),
    color_hex   VARCHAR(7) DEFAULT '#6c757d',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contenido.publicaciones_etiquetas (
    publicacion_id  UUID NOT NULL REFERENCES contenido.publicaciones(id) ON DELETE CASCADE,
    etiqueta_id     UUID NOT NULL REFERENCES contenido.etiquetas(id),
    relevancia      FLOAT DEFAULT 1.0,
    PRIMARY KEY (publicacion_id, etiqueta_id)
);

-- ------------------------------------------------------------
-- MEDIA ADJUNTOS
-- ------------------------------------------------------------
CREATE TABLE contenido.media_adjuntos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    publicacion_id  UUID NOT NULL REFERENCES contenido.publicaciones(id) ON DELETE CASCADE,
    tipo            VARCHAR(20) CHECK (tipo IN ('imagen','video','documento','audio')),
    url_original    TEXT,
    url_almacenado  TEXT,
    thumbnail_url   TEXT,
    descripcion_ia  TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
