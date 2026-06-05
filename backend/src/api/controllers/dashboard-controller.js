const { query } = require('../../config/db');

// ── Filtros comunes ──────────────────────────────────────────
function buildWhere(filtros = {}) {
    const conds = ['1=1'];
    const vals  = [];
    let   idx   = 1;

    if (filtros.desde) {
        conds.push(`p.publicado_en >= $${idx++}`);
        vals.push(filtros.desde);
    }
    if (filtros.hasta) {
        conds.push(`p.publicado_en <= $${idx++}`);
        vals.push(filtros.hasta + ' 23:59:59');
    }
    if (filtros.municipio) {
        conds.push(`m.municipio = $${idx++}`);
        vals.push(filtros.municipio);
    }
    if (filtros.organismo) {
        conds.push(`m.organismo ILIKE $${idx++}`);
        vals.push(`%${filtros.organismo}%`);
    }
    if (filtros.categoria) {
        conds.push(`m.categoria = $${idx++}`);
        vals.push(filtros.categoria);
    }
    if (filtros.tipo_actividad) {
        conds.push(`m.tipo_actividad = $${idx++}`);
        vals.push(filtros.tipo_actividad);
    }
    return { where: conds.join(' AND '), vals };
}

// ── 1. KPIs resumen ejecutivo ────────────────────────────────
async function getKPIs(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            COUNT(DISTINCT p.id)                                                AS total_publicaciones,
            COUNT(DISTINCT m.municipio) FILTER (WHERE m.municipio IS NOT NULL)  AS municipios_visitados,
            29 - COUNT(DISTINCT m.municipio) FILTER (WHERE m.municipio IS NOT NULL) AS municipios_pendientes,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')           AS obras_inauguradas,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración'
                             AND p.publicado_en >= NOW() - INTERVAL '1 day')    AS obras_hoy,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración'
                             AND p.publicado_en >= NOW() - INTERVAL '7 days')   AS obras_semana,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración'
                             AND p.publicado_en >= NOW() - INTERVAL '30 days')  AS obras_mes,
            ROUND(AVG(p.sentiment_score)::numeric, 3)                           AS sentiment_promedio,
            MAX(p.publicado_en)                                                 AS ultima_actividad
        FROM contenido.publicaciones p
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where}
    `, vals);
    return rows[0];
}

// ── 2. Municipios visitados vs pendientes ────────────────────
async function getMunicipiosVisitados(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            m.municipio,
            COUNT(*)                              AS visitas,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración') AS obras,
            MAX(p.publicado_en)                   AS ultima_visita,
            ROUND(AVG(p.sentiment_score)::numeric,3) AS sentiment
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where} AND m.municipio IS NOT NULL
        GROUP BY m.municipio
        ORDER BY visitas DESC
    `, vals);

    const todosMunicipios = [
        'San Cristóbal','Rubio','Táriba','Colón','La Fría','San Antonio del Táchira',
        'Ureña','La Grita','El Piñal','Cordero','Coloncito','Palmira','Michelena',
        'Lobatera','Seboruco','Pregonero','Queniquea','San Josecito','Capacho Nuevo',
        'Abejales','El Cobre','San Félix','Santa Ana del Táchira',
        'San Rafael del Piñal','San José de Bolívar','Delicias','Upata','San Simón','Ureña'
    ];
    const visitados  = rows.map(r => r.municipio);
    const pendientes = todosMunicipios.filter(m => !visitados.includes(m));
    return { visitados: rows, pendientes };
}

// ── 3. Obras por día / semana / mes ─────────────────────────
async function getObrasTemporal(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            DATE(p.publicado_en)                  AS fecha,
            COUNT(*)                              AS obras_inauguradas,
            COUNT(DISTINCT m.municipio)           AS municipios_con_obras,
            STRING_AGG(DISTINCT m.municipio, ', ') AS municipios
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where}
          AND m.tipo_actividad = 'inauguración'
          AND p.publicado_en >= NOW() - INTERVAL '90 days'
        GROUP BY DATE(p.publicado_en)
        ORDER BY fecha DESC
        LIMIT 90
    `, vals);
    return rows;
}

// ── 4. Obras por sector ──────────────────────────────────────
async function getObrasPorSector(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            m.categoria                           AS sector,
            COUNT(*)                              AS total,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración') AS inauguradas,
            COUNT(DISTINCT m.municipio)           AS municipios,
            ROUND(AVG(p.sentiment_score)::numeric,3) AS sentiment
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where} AND m.categoria IS NOT NULL
        GROUP BY m.categoria
        ORDER BY total DESC
    `, vals);
    return rows;
}

// ── 5. Problemas sociales más recurrentes ───────────────────
async function getProblemasSociales(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            m.problema_social                     AS problema,
            COUNT(*)                              AS frecuencia,
            COUNT(DISTINCT m.municipio)           AS municipios_afectados,
            MAX(p.publicado_en)                   AS ultima_mencion
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where} AND m.problema_social IS NOT NULL
        GROUP BY m.problema_social
        ORDER BY frecuencia DESC
        LIMIT 15
    `, vals);
    return rows;
}

// ── 6. Ranking municipios con mayores incidencias ───────────
async function getRankingMunicipios(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            m.municipio,
            COUNT(*)                              AS total_publicaciones,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')   AS obras,
            COUNT(*) FILTER (WHERE m.problema_social IS NOT NULL)        AS problemas,
            COUNT(*) FILTER (WHERE p.sentiment_label IN ('negativo','muy_negativo')) AS menciones_negativas,
            ROUND(AVG(p.sentiment_score)::numeric,3) AS sentiment_promedio,
            MAX(p.publicado_en)                   AS ultima_actividad
        FROM contenido.publicaciones p
        JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where} AND m.municipio IS NOT NULL
        GROUP BY m.municipio
        ORDER BY total_publicaciones DESC
        LIMIT 29
    `, vals);
    return rows;
}

// ── 7. Tendencia histórica de sentiment ─────────────────────
async function getTendenciaHistorica(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            DATE_TRUNC('week', p.publicado_en)    AS semana,
            COUNT(*)                              AS publicaciones,
            ROUND(AVG(p.sentiment_score)::numeric,3) AS sentiment,
            COUNT(*) FILTER (WHERE p.sentiment_label IN ('positivo','muy_positivo')) AS positivas,
            COUNT(*) FILTER (WHERE p.sentiment_label = 'neutro')                     AS neutras,
            COUNT(*) FILTER (WHERE p.sentiment_label IN ('negativo','muy_negativo')) AS negativas,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración')                AS obras
        FROM contenido.publicaciones p
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where} AND p.publicado_en >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('week', p.publicado_en)
        ORDER BY semana ASC
    `, vals);
    return rows;
}

// ── 8. Organismos más activos ────────────────────────────────
async function getOrganismosActivos(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            COALESCE(m.organismo, e.nombre_corto) AS organismo,
            e.tipo,
            COUNT(p.id)                           AS publicaciones,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración') AS obras,
            SUM(p.likes + p.comentarios + p.compartidos) AS engagement_total,
            ROUND(AVG(p.sentiment_score)::numeric,3) AS sentiment,
            MAX(p.publicado_en)                   AS ultima_actividad
        FROM contenido.publicaciones p
        JOIN core.entidades e ON e.id = p.entidad_id
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where}
        GROUP BY COALESCE(m.organismo, e.nombre_corto), e.tipo
        ORDER BY publicaciones DESC
        LIMIT 20
    `, vals);
    return rows;
}

// ── 9. Sentiment en redes sociales ──────────────────────────
async function getSentimentRedes(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            p.plataforma,
            COUNT(*)                              AS total,
            COUNT(*) FILTER (WHERE p.sentiment_label = 'muy_positivo')  AS muy_positivo,
            COUNT(*) FILTER (WHERE p.sentiment_label = 'positivo')       AS positivo,
            COUNT(*) FILTER (WHERE p.sentiment_label = 'neutro')         AS neutro,
            COUNT(*) FILTER (WHERE p.sentiment_label = 'negativo')       AS negativo,
            COUNT(*) FILTER (WHERE p.sentiment_label = 'muy_negativo')   AS muy_negativo,
            ROUND(AVG(p.sentiment_score)::numeric,3)                     AS score_promedio,
            SUM(p.likes)                          AS total_likes,
            SUM(p.compartidos)                    AS total_compartidos
        FROM contenido.publicaciones p
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where}
        GROUP BY p.plataforma
        ORDER BY total DESC
    `, vals);
    return rows;
}

// ── 10. Datos para mapa (municipios + coordenadas) ───────────
async function getDatosMapa(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            mun.nombre                            AS municipio,
            mun.capital,
            ST_Y(ST_Centroid(mun.geom))           AS lat,
            ST_X(ST_Centroid(mun.geom))           AS lng,
            COALESCE(stats.total, 0)              AS publicaciones,
            COALESCE(stats.obras, 0)              AS obras,
            COALESCE(stats.sentiment, 0)          AS sentiment,
            COALESCE(stats.ultima_actividad, NULL) AS ultima_actividad
        FROM core.municipios mun
        LEFT JOIN (
            SELECT
                m.municipio,
                COUNT(p.id)                       AS total,
                COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración') AS obras,
                ROUND(AVG(p.sentiment_score)::numeric,3) AS sentiment,
                MAX(p.publicado_en)               AS ultima_actividad
            FROM contenido.publicaciones p
            JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
            WHERE ${where} AND m.municipio IS NOT NULL
            GROUP BY m.municipio
        ) stats ON stats.municipio = mun.nombre
        WHERE mun.geom IS NOT NULL
        ORDER BY COALESCE(stats.total, 0) DESC
    `, vals);
    return rows;
}

// ── 11. Feed últimas publicaciones ──────────────────────────
async function getFeedReciente(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            p.id, p.plataforma, p.url_original,
            LEFT(p.contenido_limpio, 280)         AS contenido,
            p.resumen_ia                          AS resumen,
            p.likes, p.comentarios, p.compartidos,
            p.sentiment_label, p.sentiment_score,
            p.publicado_en,
            m.categoria, m.municipio, m.tipo_actividad, m.obra,
            e.nombre_corto                        AS entidad
        FROM contenido.publicaciones p
        JOIN core.entidades e ON e.id = p.entidad_id
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where}
        ORDER BY p.publicado_en DESC
        LIMIT 50
    `, vals);
    return rows;
}

// ── 12. Alcaldías más activas ────────────────────────────────
async function getAlcaldiasActivas(filtros) {
    const { where, vals } = buildWhere(filtros);
    const { rows } = await query(`
        SELECT
            e.nombre_corto                        AS alcaldia,
            mun.nombre                            AS municipio,
            COUNT(p.id)                           AS publicaciones,
            COUNT(*) FILTER (WHERE m.tipo_actividad = 'inauguración') AS obras,
            SUM(p.likes + p.comentarios + p.compartidos) AS engagement,
            ROUND(AVG(p.sentiment_score)::numeric,3) AS sentiment,
            MAX(p.publicado_en)                   AS ultima_actividad
        FROM contenido.publicaciones p
        JOIN core.entidades e ON e.id = p.entidad_id AND e.tipo = 'alcaldia'
        LEFT JOIN core.municipios mun ON mun.id = e.municipio_id
        LEFT JOIN contenido.metadatos_seguimiento m ON m.publicacion_id = p.id
        WHERE ${where}
        GROUP BY e.nombre_corto, mun.nombre
        ORDER BY publicaciones DESC
    `, vals);
    return rows;
}

// ── Exportar todos los endpoints ────────────────────────────
module.exports = {
    getKPIs,
    getMunicipiosVisitados,
    getObrasTemporal,
    getObrasPorSector,
    getProblemasSociales,
    getRankingMunicipios,
    getTendenciaHistorica,
    getOrganismosActivos,
    getSentimentRedes,
    getDatosMapa,
    getFeedReciente,
    getAlcaldiasActivas,
};
