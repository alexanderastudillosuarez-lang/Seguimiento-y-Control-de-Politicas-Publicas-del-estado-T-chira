-- ============================================================
-- SIMGP-TÁCHIRA | Migración 006 — Reportes y Funciones
-- ============================================================

-- ------------------------------------------------------------
-- REPORTES
-- ------------------------------------------------------------
CREATE TYPE reportes.tipo_reporte AS ENUM (
    'resumen_ejecutivo',
    'entidad_detalle',
    'comparativo',
    'tendencias',
    'alertas',
    'personalizado'
);

CREATE TABLE reportes.reportes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo          VARCHAR(300) NOT NULL,
    tipo            reportes.tipo_reporte NOT NULL,
    parametros      JSONB DEFAULT '{}',
    estado          VARCHAR(30) DEFAULT 'pendiente',
    archivo_url     TEXT,
    generado_por    UUID REFERENCES core.usuarios(id),
    generado_en     TIMESTAMPTZ DEFAULT NOW(),
    expira_en       TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entidades_updated_at
    BEFORE UPDATE ON core.entidades
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON core.usuarios
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_indicadores_updated_at
    BEFORE UPDATE ON metricas.indicadores
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- ------------------------------------------------------------
-- FUNCIÓN: Notificación WebSocket vía LISTEN/NOTIFY
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION contenido.notify_nueva_publicacion()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'nueva_publicacion',
        json_build_object(
            'id',          NEW.id,
            'entidad_id',  NEW.entidad_id,
            'plataforma',  NEW.plataforma,
            'sentiment',   NEW.sentiment_label,
            'publicado_en', NEW.publicado_en
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_publicacion
    AFTER INSERT ON contenido.publicaciones
    FOR EACH ROW EXECUTE FUNCTION contenido.notify_nueva_publicacion();

-- ------------------------------------------------------------
-- FUNCIÓN: Calcular snapshot diario
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION metricas.calcular_snapshot(p_entidad_id UUID, p_fecha DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO metricas.snapshots_diarios (
        entidad_id, fecha,
        total_publicaciones, total_likes, total_comentarios,
        total_compartidos, alcance_total, sentiment_promedio
    )
    SELECT
        p_entidad_id,
        p_fecha,
        COUNT(*),
        COALESCE(SUM(likes), 0),
        COALESCE(SUM(comentarios), 0),
        COALESCE(SUM(compartidos), 0),
        COALESCE(SUM(alcance_estimado), 0),
        COALESCE(AVG(sentiment_score), 0)
    FROM contenido.publicaciones
    WHERE entidad_id = p_entidad_id
      AND DATE(publicado_en) = p_fecha
    ON CONFLICT (entidad_id, fecha) DO UPDATE SET
        total_publicaciones = EXCLUDED.total_publicaciones,
        total_likes         = EXCLUDED.total_likes,
        total_comentarios   = EXCLUDED.total_comentarios,
        total_compartidos   = EXCLUDED.total_compartidos,
        alcance_total       = EXCLUDED.alcance_total,
        sentiment_promedio  = EXCLUDED.sentiment_promedio;
END;
$$ LANGUAGE plpgsql;
