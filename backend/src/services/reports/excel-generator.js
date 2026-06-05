/**
 * Generador Excel enriquecido — ExcelJS
 * Produce archivos .xlsx con formato profesional, colores y múltiples hojas
 */
const ExcelJS = require('exceljs');
const q = require('./queries');

const COLORES = {
    header:   '0D1117',
    accent:   '1F6FEB',
    success:  '3FB950',
    warning:  'D29922',
    danger:   'F85149',
    muted:    '7D8590',
    rowAlt:   '161B22',
    rowNorm:  '0E1117',
    white:    'E6EDF3',
};

function headerStyle(color = COLORES.accent) {
    return {
        font:      { bold: true, color: { argb: 'FF' + COLORES.white }, size: 10 },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border:    { bottom: { style: 'thin', color: { argb: 'FF' + color } } },
    };
}

function cellStyle(alt = false) {
    return {
        font:      { color: { argb: 'FF' + COLORES.white }, size: 9 },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (alt ? COLORES.rowAlt : COLORES.rowNorm) } },
        alignment: { vertical: 'middle' },
    };
}

function addPortada(wb, titulo, subtitulo, filtros) {
    const ws = wb.addWorksheet('Portada');
    ws.pageSetup.orientation = 'portrait';
    ws.columns = [{ width: 60 }];

    const fila1 = ws.addRow(['']);
    const fila2 = ws.addRow(['GOBIERNO DEL ESTADO TÁCHIRA']);
    fila2.font = { bold: true, size: 16, color: { argb: 'FF' + COLORES.accent } };
    fila2.alignment = { horizontal: 'center' };

    ws.addRow(['Sistema Inteligente de Monitoreo de Gestión Pública']).font = { size: 11, color: { argb: 'FF' + COLORES.muted } };
    ws.addRow(['']);

    const filaTitulo = ws.addRow([titulo]);
    filaTitulo.font = { bold: true, size: 18, color: { argb: 'FF' + COLORES.white } };
    filaTitulo.alignment = { horizontal: 'center' };

    if (subtitulo) {
        ws.addRow([subtitulo]).font = { size: 12, color: { argb: 'FF' + COLORES.muted } };
    }
    ws.addRow(['']);
    ws.addRow([`Generado: ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`])
      .font = { size: 9, color: { argb: 'FF' + COLORES.muted } };

    if (filtros?.desde || filtros?.hasta) {
        ws.addRow([`Período: ${filtros.desde || '—'} al ${filtros.hasta || 'hoy'}`])
          .font = { size: 9, color: { argb: 'FF' + COLORES.muted } };
    }

    ws.addRow(['']);
    ws.addRow(['SIMGP-Táchira v1.0 — Uso interno y oficial']).font = { size: 8, color: { argb: 'FF444C56' } };

    ws.getColumn(1).width = 60;
    for (let i = 1; i <= ws.rowCount; i++) {
        ws.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORES.header } };
        ws.getRow(i).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        ws.getRow(i).height = 22;
    }
}

function addHojaResumen(wb, resumen, filtros) {
    const ws = wb.addWorksheet('Resumen Ejecutivo');
    ws.columns = [{ width: 35 }, { width: 20 }, { width: 20 }];

    const hdr = ws.addRow(['INDICADOR', 'VALOR', 'ESTADO']);
    hdr.height = 24;
    ['A1','B1','C1'].forEach(c => Object.assign(ws.getCell(c), headerStyle()));

    const kpis = [
        ['Total publicaciones recolectadas',  resumen.total_publicaciones,  null],
        ['Municipios visitados (de 29)',       resumen.municipios_visitados, resumen.municipios_visitados >= 20 ? '✅ Óptimo' : resumen.municipios_visitados >= 10 ? '⚠️ En seguimiento' : '🔴 Requiere atención'],
        ['Obras inauguradas',                  resumen.obras_inauguradas,    null],
        ['Obras en el último mes',             resumen.obras_ultimo_mes,     null],
        ['Tipos de problemas detectados',      resumen.tipos_problemas,      null],
        ['Sentiment promedio (-1 a 1)',        resumen.sentiment_promedio,   resumen.sentiment_promedio > 0.3 ? '😊 Positivo' : resumen.sentiment_promedio < -0.3 ? '😟 Negativo' : '😐 Neutro'],
        ['Publicaciones con tono positivo',   resumen.publicaciones_positivas, null],
        ['Publicaciones con tono negativo',   resumen.publicaciones_negativas, null],
    ];

    kpis.forEach(([label, val, estado], i) => {
        const row = ws.addRow([label, val ?? '—', estado ?? '—']);
        row.height = 20;
        row.eachCell(cell => {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: 'FF' + (i%2 ? COLORES.rowAlt : COLORES.rowNorm) } };
            cell.font = { color:{ argb:'FF' + COLORES.white }, size: 9 };
            cell.alignment = { vertical:'middle', horizontal: cell.col === 1 ? 'left' : 'center' };
        });
    });
}

function addHojaSectores(wb, sectores) {
    const ws = wb.addWorksheet('Obras por Sector');
    ws.columns = [
        { header:'Sector',     key:'sector',     width:20 },
        { header:'Total',      key:'total',      width:10 },
        { header:'Inauguradas',key:'inauguradas',width:14 },
        { header:'Municipios', key:'municipios', width:12 },
        { header:'Sentiment',  key:'sentiment',  width:12 },
        { header:'Municipios cubiertos', key:'municipios_lista', width:50 },
    ];

    ws.getRow(1).height = 22;
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle(COLORES.warning)));

    sectores.forEach((s, i) => {
        const row = ws.addRow(s);
        row.height = 18;
        row.eachCell(cell => {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+(i%2?COLORES.rowAlt:COLORES.rowNorm) } };
            cell.font = { color:{ argb:'FF'+COLORES.white }, size:9 };
            cell.alignment = { vertical:'middle' };
        });
        // Color en inauguradas
        const celdaInauguraciones = ws.getCell(`C${i+2}`);
        if (s.inauguradas > 0) celdaInauguraciones.font = { bold:true, color:{ argb:'FF'+COLORES.warning }, size:9 };
    });
}

function addHojaMunicipios(wb, municipios) {
    const ws = wb.addWorksheet('Municipios');
    ws.columns = [
        { header:'#',            key:'num',         width:5 },
        { header:'Municipio',    key:'municipio',   width:25 },
        { header:'Publicaciones',key:'publicaciones',width:14 },
        { header:'Obras',        key:'obras',        width:10 },
        { header:'Problemas',    key:'problemas_detectados', width:12 },
        { header:'Plataformas',  key:'plataformas',  width:12 },
        { header:'Sentiment',    key:'sentiment',    width:12 },
        { header:'Sectores',     key:'sectores_atendidos', width:40 },
        { header:'Última visita',key:'ultima_visita', width:18 },
    ];

    ws.getRow(1).height = 22;
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle(COLORES.success)));

    municipios.forEach((m, i) => {
        const row = ws.addRow({ num: i+1, ...m,
            ultima_visita: m.ultima_visita ? new Date(m.ultima_visita).toLocaleDateString('es-VE') : '—'
        });
        row.height = 18;
        row.eachCell(cell => {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+(i%2?COLORES.rowAlt:COLORES.rowNorm) } };
            cell.font = { color:{ argb:'FF'+COLORES.white }, size:9 };
        });
        const cObras = ws.getCell(`D${i+2}`);
        if (m.obras > 0) cObras.font = { bold:true, color:{ argb:'FF'+COLORES.warning }, size:9 };
    });
}

function addHojaObras(wb, obras) {
    const ws = wb.addWorksheet('Top Obras Inauguradas');
    ws.columns = [
        { header:'#',          key:'num',         width:5 },
        { header:'Obra',       key:'obra',         width:40 },
        { header:'Municipio',  key:'municipio',    width:20 },
        { header:'Sector',     key:'sector',       width:16 },
        { header:'Inversión',  key:'inversion',    width:18 },
        { header:'Beneficiarios', key:'beneficiarios', width:18 },
        { header:'Organismo',  key:'organismo',    width:25 },
        { header:'Fecha',      key:'fecha',        width:14 },
        { header:'Descripción',key:'descripcion',  width:60 },
    ];

    ws.getRow(1).height = 22;
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle(COLORES.danger)));

    obras.forEach((o, i) => {
        const row = ws.addRow({ num: i+1, ...o,
            fecha: o.fecha ? new Date(o.fecha).toLocaleDateString('es-VE') : '—'
        });
        row.height = 20;
        row.getCell('I').alignment = { wrapText: true };
        row.eachCell(cell => {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+(i%2?COLORES.rowAlt:COLORES.rowNorm) } };
            cell.font = { color:{ argb:'FF'+COLORES.white }, size:9 };
            cell.alignment = { vertical:'top', ...(cell.col===9 ? { wrapText:true } : {}) };
        });
    });
}

function addHojaProblemas(wb, problemas) {
    const ws = wb.addWorksheet('Problemas Sociales');
    ws.columns = [
        { header:'Problema Social',   key:'problema',         width:45 },
        { header:'Frecuencia',        key:'frecuencia',       width:12 },
        { header:'Municipios',        key:'municipios_afectados', width:12 },
        { header:'Sectores',          key:'sectores',         width:30 },
        { header:'Sentiment',         key:'sentiment_promedio', width:12 },
        { header:'Última mención',    key:'ultima_mencion',   width:16 },
        { header:'Municipios afectados', key:'municipios_lista', width:50 },
    ];

    ws.getRow(1).height = 22;
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle(COLORES.danger)));

    problemas.forEach((p, i) => {
        const row = ws.addRow({ ...p,
            ultima_mencion: p.ultima_mencion ? new Date(p.ultima_mencion).toLocaleDateString('es-VE') : '—'
        });
        row.height = 18;
        row.eachCell(cell => {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+(i%2?COLORES.rowAlt:COLORES.rowNorm) } };
            cell.font = { color:{ argb:'FF'+COLORES.white }, size:9 };
        });
        const cFreq = ws.getCell(`B${i+2}`);
        if (p.frecuencia > 5) cFreq.font = { bold:true, color:{ argb:'FF'+COLORES.danger }, size:9 };
    });
}

async function generarExcelCompleto(filtros = {}) {
    const wb = new ExcelJS.Workbook();
    wb.creator    = 'SIMGP-Táchira';
    wb.company    = 'Gobernación del Estado Táchira';
    wb.created    = new Date();
    wb.properties.date1904 = false;

    const [resumen, sectores, municipios, obras, problemas] = await Promise.all([
        q.getResumenEjecutivo(filtros.desde, filtros.hasta),
        q.getObrasPorSectorDetalle(filtros.desde, filtros.hasta),
        q.getMunicipiosDetalle(filtros.desde, filtros.hasta),
        q.getTopObras(30, filtros.desde, filtros.hasta),
        q.getProblemasSocialesDetalle(filtros.desde, filtros.hasta),
    ]);

    const titulo = 'Reporte de Gestión Pública';
    const sub    = filtros.desde ? `Período: ${filtros.desde} — ${filtros.hasta || 'hoy'}` : 'Período completo';

    addPortada(wb, titulo, sub, filtros);
    addHojaResumen(wb, resumen, filtros);
    addHojaSectores(wb, sectores);
    addHojaMunicipios(wb, municipios);
    addHojaObras(wb, obras);
    addHojaProblemas(wb, problemas);

    return wb;
}

module.exports = { generarExcelCompleto };
