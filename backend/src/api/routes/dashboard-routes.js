const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/dashboard-controller');

function parseFiltros(q) {
    return {
        desde:         q.desde         || null,
        hasta:         q.hasta         || null,
        municipio:     q.municipio     || null,
        organismo:     q.organismo     || null,
        categoria:     q.categoria     || null,
        tipo_actividad: q.tipo_actividad || null,
    };
}

function handle(fn) {
    return async (req, res) => {
        try {
            const data = await fn(parseFiltros(req.query));
            res.json({ ok: true, data, timestamp: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    };
}

router.get('/kpis',               handle(ctrl.getKPIs));
router.get('/municipios',         handle(ctrl.getMunicipiosVisitados));
router.get('/obras-temporal',     handle(ctrl.getObrasTemporal));
router.get('/obras-sector',       handle(ctrl.getObrasPorSector));
router.get('/problemas-sociales', handle(ctrl.getProblemasSociales));
router.get('/ranking-municipios', handle(ctrl.getRankingMunicipios));
router.get('/tendencia',          handle(ctrl.getTendenciaHistorica));
router.get('/organismos',         handle(ctrl.getOrganismosActivos));
router.get('/sentiment-redes',    handle(ctrl.getSentimentRedes));
router.get('/mapa',               handle(ctrl.getDatosMapa));
router.get('/feed',               handle(ctrl.getFeedReciente));
router.get('/alcaldias',          handle(ctrl.getAlcaldiasActivas));

// Endpoint unificado — trae todo en una sola llamada para el dashboard
router.get('/resumen', async (req, res) => {
    try {
        const f = parseFiltros(req.query);
        const [kpis, municipios, obrasSector, tendencia, sentimentRedes, organismos] =
            await Promise.all([
                ctrl.getKPIs(f),
                ctrl.getMunicipiosVisitados(f),
                ctrl.getObrasPorSector(f),
                ctrl.getTendenciaHistorica(f),
                ctrl.getSentimentRedes(f),
                ctrl.getOrganismosActivos(f),
            ]);
        res.json({
            ok: true,
            data: { kpis, municipios, obrasSector, tendencia, sentimentRedes, organismos },
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
