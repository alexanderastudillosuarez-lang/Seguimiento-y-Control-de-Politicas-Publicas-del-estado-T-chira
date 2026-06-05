/**
 * Consultas SQL reutilizables para generación de reportes
 */
const { query } = require('../../config/db');

async function getResumenEjecutivo(desde, hasta) {
    const { rows } = await query(`
        SELECT
            COUNT(DISTINCT p.id)                                                        AS total_publicaciones,
            COUNT(DISTINCT m.municipio) FILTER (WHERE m.municipio IS NOT NULL)          AS municipios_visitados,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')                   AS obras_inauguradas,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración'
                             AND p.publicado_en >= NOW() - INTERVAL '30 days')          AS obras_ultimo_mes,
            COUNT(DISTINCT m.problema_social) FILTER (WHERE m.problema_social IS NOT NULL) AS tipos_problemas,
            ROUND(AVG(p.sentiment_score)::numeric, 3)                                   AS sentiment_promedio,
            COUNT(*) FILTER (WHERE p.sentiment_label IN ('positivo','muy_positivo'))    AS publicaciones_positivas,
            COUNT(*) FILTER (WHERE p.sentiment_label IN ('negativo','muy_negativo'))    AS publicaciones_negativas,
            MAX(p.publicado_en)                                                         AS ultima_actividad,
            MIN(p.publicado_en)                                                         AS primera_actividad
        FROM contenido.publicaciones p
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ($1::date IS NULL OR DATE(p.publicado_en) >= $1::date)
          AND ($2::date IS NULL OR DATE(p.publicado_en) <= $2::date)
    `, [desde || null, hasta || null]);
    return rows[0];
}

async function getObrasPorSectorDetalle(desde, hasta) {
    const { rows } = await query(`
        SELECT
            m.categoria                                                              AS sector,
            COUNT(*)                                                                 AS total,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')               AS inauguradas,
            COUNT(DISTINCT m.municipio)                                              AS municipios,
            ROUND(AVG(p.sentiment_score)::numeric, 3)                               AS sentiment,
            STRING_AGG(DISTINCT m.municipio, ', ' ORDER BY m.municipio)             AS municipios_lista,
            MAX(p.publicado_en)                                                      AS ultima_actividad
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE m.categoria IS NOT NULL
          AND ($1::date IS NULL OR DATE(p.publicado_en) >= $1::date)
          AND ($2::date IS NULL OR DATE(p.publicado_en) <= $2::date)
        GROUP BY m.categoria
        ORDER BY inauguradas DESC, total DESC
    `, [desde || null, hasta || null]);
    return rows;
}

async function getMunicipiosDetalle(desde, hasta) {
    const { rows } = await query(`
        SELECT
            m.municipio,
            COUNT(*)                                                                 AS publicaciones,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')               AS obras,
            COUNT(*) FILTER (WHERE m.problema_social IS NOT NULL)                   AS problemas_detectados,
            COUNT(DISTINCT p.plataforma)                                             AS plataformas,
            ROUND(AVG(p.sentiment_score)::numeric, 3)                               AS sentiment,
            p.sentiment_label                                                        AS sentiment_label,
            MAX(p.publicado_en)                                                      AS ultima_visita,
            STRING_AGG(DISTINCT m.categoria, ', ')                                  AS sectores_atendidos
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE m.municipio IS NOT NULL
          AND ($1::date IS NULL OR DATE(p.publicado_en) >= $1::date)
          AND ($2::date IS NULL OR DATE(p.publicado_en) <= $2::date)
        GROUP BY m.municipio, p.sentiment_label
        ORDER BY obras DESC, publicaciones DESC
    `, [desde || null, hasta || null]);
    return rows;
}

async function getComparativaPeriodos(periodo1Desde, periodo1Hasta, periodo2Desde, periodo2Hasta) {
    const metricas = async (d, h) => {
        const { rows } = await query(`
            SELECT
                COUNT(*)                                                             AS publicaciones,
                COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')           AS obras,
                COUNT(DISTINCT m.municipio) FILTER (WHERE m.municipio IS NOT NULL)  AS municipios,
                ROUND(AVG(p.sentiment_score)::numeric, 3)                           AS sentiment,
                SUM(p.likes + p.comentarios + p.compartidos)                        AS engagement
            FROM contenido.publicaciones p
            LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
            WHERE DATE(p.publicado_en) BETWEEN $1 AND $2
        `, [d, h]);
        return rows[0];
    };

    const [p1, p2] = await Promise.all([
        metricas(periodo1Desde, periodo1Hasta),
        metricas(periodo2Desde, periodo2Hasta),
    ]);

    const diff = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : null;

    return {
        periodo1: { desde: periodo1Desde, hasta: periodo1Hasta, ...p1 },
        periodo2: { desde: periodo2Desde, hasta: periodo2Hasta, ...p2 },
        variacion: {
            publicaciones: diff(p1.publicaciones, p2.publicaciones),
            obras:         diff(p1.obras,         p2.obras),
            municipios:    diff(p1.municipios,     p2.municipios),
            sentiment:     diff(p1.sentiment,      p2.sentiment),
            engagement:    diff(p1.engagement,     p2.engagement),
        },
    };
}

async function getSerieTemporalDiaria(desde, hasta, agrupacion = 'day') {
    const trunc = { day: 'day', week: 'week', month: 'month' }[agrupacion] || 'day';
    const { rows } = await query(`
        SELECT
            DATE_TRUNC('${trunc}', p.publicado_en)                                  AS periodo,
            COUNT(*)                                                                 AS publicaciones,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')               AS obras,
            COUNT(DISTINCT m.municipio) FILTER (WHERE m.municipio IS NOT NULL)      AS municipios_activos,
            ROUND(AVG(p.sentiment_score)::numeric, 3)                               AS sentiment,
            SUM(p.likes + p.comentarios + p.compartidos)                            AS engagement
        FROM contenido.publicaciones p
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ($1::date IS NULL OR DATE(p.publicado_en) >= $1::date)
          AND ($2::date IS NULL OR DATE(p.publicado_en) <= $2::date)
        GROUP BY DATE_TRUNC('${trunc}', p.publicado_en)
        ORDER BY periodo ASC
    `, [desde || null, hasta || null]);
    return rows;
}

async function getTopObras(limite = 20, desde, hasta) {
    const { rows } = await query(`
        SELECT
            m.obra,
            m.municipio,
            m.categoria                                                              AS sector,
            m.inversion,
            m.beneficiarios,
            m.organismo,
            p.resumen_ia                                                             AS descripcion,
            p.publicado_en                                                           AS fecha,
            p.url_original                                                           AS fuente_url,
            e.nombre_corto                                                           AS entidad,
            ROUND(p.sentiment_score::numeric, 2)                                    AS sentiment
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        JOIN core.entidades e ON e.id = p.entidad_id
        WHERE m.tipo_actividad = 'inauguración' AND m.obra IS NOT NULL
          AND ($1::date IS NULL OR DATE(p.publicado_en) >= $1::date)
          AND ($2::date IS NULL OR DATE(p.publicado_en) <= $2::date)
        ORDER BY p.publicado_en DESC
        LIMIT $3
    `, [desde || null, hasta || null, limite]);
    return rows;
}

async function getProblemasSocialesDetalle(desde, hasta) {
    const { rows } = await query(`
        SELECT
            m.problema_social                                                        AS problema,
            COUNT(*)                                                                 AS frecuencia,
            COUNT(DISTINCT m.municipio)                                              AS municipios_afectados,
            STRING_AGG(DISTINCT m.municipio, ', ' ORDER BY m.municipio)             AS municipios_lista,
            STRING_AGG(DISTINCT m.categoria, ', ')                                  AS sectores,
            MAX(p.publicado_en)                                                      AS ultima_mencion,
            ROUND(AVG(p.sentiment_score)::numeric, 3)                               AS sentiment_promedio
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE m.problema_social IS NOT NULL
          AND ($1::date IS NULL OR DATE(p.publicado_en) >= $1::date)
          AND ($2::date IS NULL OR DATE(p.publicado_en) <= $2::date)
        GROUP BY m.problema_social
        ORDER BY frecuencia DESC
        LIMIT 20
    `, [desde || null, hasta || null]);
    return rows;
}

module.exports = {
    getResumenEjecutivo,
    getObrasPorSectorDetalle,
    getMunicipiosDetalle,
    getComparativaPeriodos,
    getSerieTemporalDiaria,
    getTopObras,
    getProblemasSocialesDetalle,
};
