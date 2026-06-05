-- ============================================================
-- SIMGP-TÁCHIRA | Migración 007 — Tabla metadatos_seguimiento
-- ============================================================
CREATE TABLE IF NOT EXISTS contenido.metadatos_seguimiento (
    id              BIGSERIAL PRIMARY KEY,
    publicacion_id  UUID NOT NULL REFERENCES contenido.publicaciones(id) ON DELETE CASCADE,
    categoria       VARCHAR(50),
    subcategoria    VARCHAR(100),
    municipio       VARCHAR(150),
    organismo       VARCHAR(200),
    tipo_actividad  VARCHAR(50),
    obra            TEXT,
    inversion       VARCHAR(200),
    beneficiarios   VARCHAR(200),
    sector_afectado TEXT,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    problema_social TEXT,
    motor_ia        VARCHAR(20) DEFAULT 'fallback',
    confianza_ia    FLOAT DEFAULT 0,
    raw_ia          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_metadatos_publicacion UNIQUE(publicacion_id)
);

CREATE INDEX idx_meta_categoria  ON contenido.metadatos_seguimiento(categoria);
CREATE INDEX idx_meta_municipio  ON contenido.metadatos_seguimiento(municipio);
CREATE INDEX idx_meta_organismo  ON contenido.metadatos_seguimiento(organismo);
CREATE INDEX idx_meta_lat_lng    ON contenido.metadatos_seguimiento(lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;
