-- ============================================================
-- SIMGP-TÁCHIRA | Migración 004 — Tablas MÉTRICAS
-- ============================================================

CREATE TYPE metricas.categoria_indicador AS ENUM (
    'actividad_digital',
    'engagement',
    'alcance',
    'sentiment',
    'tematico',
    'comparativo'
);

-- ------------------------------------------------------------
-- INDICADORES
-- ------------------------------------------------------------
CREATE TABLE metricas.indicadores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_id      UUID NOT NULL REFERENCES core.entidades(id),
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    categoria       metricas.categoria_indicador NOT NULL,
    unidad          VARCHAR(50),
    valor_meta      FLOAT,
    valor_actual    FLOAT DEFAULT 0,
    valor_anterior  FLOAT DEFAULT 0,
    variacion_pct   FLOAT DEFAULT 0,
    periodo         VARCHAR(20) DEFAULT 'mensual',
    fecha_calculo   DATE DEFAULT CURRENT_DATE,
    fuente_calculo  VARCHAR(100),
    activo          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ind_entidad   ON metricas.indicadores(entidad_id);
CREATE INDEX idx_ind_categoria ON metricas.indicadores(categoria);
CREATE INDEX idx_ind_fecha     ON metricas.indicadores(fecha_calculo DESC);

-- ------------------------------------------------------------
-- SERIES TEMPORALES
-- ------------------------------------------------------------
CREATE TABLE metricas.series_temporales (
    id              BIGSERIAL PRIMARY KEY,
    indicador_id    UUID NOT NULL REFERENCES metricas.indicadores(id),
    entidad_id      UUID NOT NULL REFERENCES core.entidades(id),
    valor           FLOAT NOT NULL,
    fecha           DATE NOT NULL,
    periodo         VARCHAR(20),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(indicador_id, fecha)
);

CREATE INDEX idx_st_indicador ON metricas.series_temporales(indicador_id);
CREATE INDEX idx_st_entidad   ON metricas.series_temporales(entidad_id);
CREATE INDEX idx_st_fecha     ON metricas.series_temporales(fecha DESC);

-- ------------------------------------------------------------
-- SNAPSHOTS DIARIOS (resumen por entidad por día)
-- ------------------------------------------------------------
CREATE TABLE metricas.snapshots_diarios (
    id                  BIGSERIAL PRIMARY KEY,
    entidad_id          UUID NOT NULL REFERENCES core.entidades(id),
    fecha               DATE NOT NULL,
    total_publicaciones INTEGER DEFAULT 0,
    total_likes         BIGINT DEFAULT 0,
    total_comentarios   BIGINT DEFAULT 0,
    total_compartidos   BIGINT DEFAULT 0,
    alcance_total       BIGINT DEFAULT 0,
    sentiment_promedio  FLOAT DEFAULT 0,
    temas_top           JSONB DEFAULT '[]',
    plataformas_data    JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entidad_id, fecha)
);

CREATE INDEX idx_snap_entidad ON metricas.snapshots_diarios(entidad_id);
CREATE INDEX idx_snap_fecha   ON metricas.snapshots_diarios(fecha DESC);

-- ------------------------------------------------------------
-- RANKINGS
-- ------------------------------------------------------------
CREATE TABLE metricas.rankings (
    id              BIGSERIAL PRIMARY KEY,
    entidad_id      UUID NOT NULL REFERENCES core.entidades(id),
    categoria       VARCHAR(100) NOT NULL,
    posicion        INTEGER NOT NULL,
    valor           FLOAT NOT NULL,
    periodo         VARCHAR(20),
    fecha           DATE DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
