-- ============================================================
-- SIMGP-TÁCHIRA | Migración 005 — Alertas, ETL y Auditoría
-- ============================================================

-- ------------------------------------------------------------
-- REGLAS DE ALERTA
-- ------------------------------------------------------------
CREATE TYPE alertas.severidad AS ENUM ('critica', 'alta', 'media', 'baja', 'info');

CREATE TABLE alertas.reglas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    condicion       JSONB NOT NULL,
    severidad       alertas.severidad DEFAULT 'media',
    canales_notif   JSONB DEFAULT '["dashboard"]',
    activa          BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES core.usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ALERTAS GENERADAS
-- ------------------------------------------------------------
CREATE TABLE alertas.alertas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_id      UUID REFERENCES core.entidades(id),
    indicador_id    UUID REFERENCES metricas.indicadores(id),
    regla_id        UUID REFERENCES alertas.reglas(id),
    tipo            VARCHAR(100),
    severidad       alertas.severidad NOT NULL DEFAULT 'media',
    titulo          VARCHAR(300),
    mensaje         TEXT,
    metadata        JSONB DEFAULT '{}',
    leida           BOOLEAN DEFAULT FALSE,
    resuelta        BOOLEAN DEFAULT FALSE,
    generada_en     TIMESTAMPTZ DEFAULT NOW(),
    resuelta_en     TIMESTAMPTZ,
    resuelta_por    UUID REFERENCES core.usuarios(id)
);

CREATE INDEX idx_alertas_entidad   ON alertas.alertas(entidad_id);
CREATE INDEX idx_alertas_severidad ON alertas.alertas(severidad);
CREATE INDEX idx_alertas_leida     ON alertas.alertas(leida);
CREATE INDEX idx_alertas_fecha     ON alertas.alertas(generada_en DESC);

-- ------------------------------------------------------------
-- ETL — JOBS DE RECOLECCIÓN
-- ------------------------------------------------------------
CREATE TYPE etl.estado_job AS ENUM ('pendiente','en_proceso','completado','fallido','cancelado');

CREATE TABLE etl.jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fuente_id       UUID REFERENCES core.fuentes(id),
    tipo            VARCHAR(50),
    estado          etl.estado_job DEFAULT 'pendiente',
    items_procesados INTEGER DEFAULT 0,
    items_nuevos    INTEGER DEFAULT 0,
    items_error     INTEGER DEFAULT 0,
    error_msg       TEXT,
    iniciado_en     TIMESTAMPTZ,
    completado_en   TIMESTAMPTZ,
    duracion_ms     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_fuente  ON etl.jobs(fuente_id);
CREATE INDEX idx_jobs_estado  ON etl.jobs(estado);
CREATE INDEX idx_jobs_fecha   ON etl.jobs(created_at DESC);

-- ------------------------------------------------------------
-- ETL — LOGS
-- ------------------------------------------------------------
CREATE TABLE etl.logs (
    id          BIGSERIAL PRIMARY KEY,
    job_id      UUID REFERENCES etl.jobs(id),
    nivel       VARCHAR(20) DEFAULT 'info',
    mensaje     TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_etl_logs_job  ON etl.logs(job_id);
CREATE INDEX idx_etl_logs_fecha ON etl.logs(created_at DESC);

-- ------------------------------------------------------------
-- AUDITORÍA
-- ------------------------------------------------------------
CREATE TABLE audit.log (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  UUID REFERENCES core.usuarios(id),
    accion      VARCHAR(100) NOT NULL,
    tabla       VARCHAR(100),
    registro_id VARCHAR(100),
    datos_antes JSONB,
    datos_despues JSONB,
    ip          INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_usuario ON audit.log(usuario_id);
CREATE INDEX idx_audit_fecha   ON audit.log(created_at DESC);
CREATE INDEX idx_audit_accion  ON audit.log(accion);
