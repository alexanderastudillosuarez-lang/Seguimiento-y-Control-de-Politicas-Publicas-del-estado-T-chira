/* ── Exportaciones PDF / Excel / CSV ─────────────────────── */

async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ts   = new Date().toLocaleDateString('es-VE');
  const W    = doc.internal.pageSize.getWidth();

  // Encabezado
  doc.setFillColor(14, 17, 23);
  doc.rect(0, 0, W, 20, 'F');
  doc.setTextColor(230, 237, 243);
  doc.setFontSize(13); doc.setFont(undefined,'bold');
  doc.text('Sistema Inteligente de Monitoreo de Gestión Pública — Estado Táchira', W/2, 12, { align:'center' });
  doc.setFontSize(8); doc.setFont(undefined,'normal');
  doc.setTextColor(125, 133, 144);
  doc.text(`Generado el ${ts}`, W/2, 17, { align:'center' });

  // KPIs
  let y = 28;
  doc.setTextColor(230,237,243); doc.setFontSize(10); doc.setFont(undefined,'bold');
  doc.text('INDICADORES CLAVE', 14, y); y += 6;

  const kpis = [
    ['Total Publicaciones', document.getElementById('kpi-publicaciones')?.textContent || '—'],
    ['Municipios Visitados', document.getElementById('kpi-municipios-v')?.textContent || '—'],
    ['Obras Inauguradas',   document.getElementById('kpi-obras-total')?.textContent  || '—'],
    ['Obras Hoy',           document.getElementById('kpi-obras-hoy')?.textContent    || '—'],
    ['Obras Semana',        document.getElementById('kpi-obras-semana')?.textContent || '—'],
    ['Obras Mes',           document.getElementById('kpi-obras-mes')?.textContent    || '—'],
  ];
  kpis.forEach(([label, val], i) => {
    const x = 14 + (i % 3) * 90;
    if (i % 3 === 0 && i > 0) y += 12;
    doc.setFillColor(22, 27, 34);
    doc.roundedRect(x, y, 84, 10, 2, 2, 'F');
    doc.setTextColor(125,133,144); doc.setFontSize(7); doc.setFont(undefined,'normal');
    doc.text(label, x + 4, y + 4);
    doc.setTextColor(31,111,235); doc.setFontSize(10); doc.setFont(undefined,'bold');
    doc.text(String(val), x + 4, y + 9);
  });

  // Gráficos como imágenes
  y += 18;
  const canvases = [
    ['chart-donut-sector',   'Obras por Sector'],
    ['chart-bar-obras',      'Obras por Día'],
    ['chart-line-tendencia', 'Tendencia Histórica'],
  ];
  for (const [id, titulo] of canvases) {
    const canvas = document.getElementById(id);
    if (!canvas) continue;
    if (y + 70 > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); y = 14; }
    doc.setTextColor(230,237,243); doc.setFontSize(9); doc.setFont(undefined,'bold');
    doc.text(titulo, 14, y); y += 4;
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 14, y, W - 28, 60);
    y += 66;
  }

  doc.save(`SIMGP-Tachira-${ts.replace(/\//g,'-')}.pdf`);
  showToast('PDF exportado correctamente', 'success');
}

function exportarExcel(datos, nombreArchivo = 'SIMGP-Tachira') {
  const wb  = XLSX.utils.book_new();
  const ts  = new Date().toLocaleDateString('es-VE').replace(/\//g,'-');

  // Hoja 1: KPIs
  const kpiData = [
    ['SIMGP-TÁCHIRA — Indicadores de Gestión Pública'],
    [`Generado: ${new Date().toLocaleString('es-VE')}`],
    [],
    ['Indicador', 'Valor'],
    ['Total Publicaciones',  document.getElementById('kpi-publicaciones')?.textContent || '—'],
    ['Municipios Visitados', document.getElementById('kpi-municipios-v')?.textContent  || '—'],
    ['Municipios Pendientes',document.getElementById('kpi-municipios-p')?.textContent  || '—'],
    ['Obras Inauguradas',    document.getElementById('kpi-obras-total')?.textContent   || '—'],
    ['Obras Hoy',            document.getElementById('kpi-obras-hoy')?.textContent     || '—'],
    ['Obras Semana',         document.getElementById('kpi-obras-semana')?.textContent  || '—'],
    ['Obras Mes',            document.getElementById('kpi-obras-mes')?.textContent     || '—'],
    ['Sentiment Promedio',   document.getElementById('kpi-sentiment')?.textContent     || '—'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), 'KPIs');

  // Hojas adicionales si se pasan datos
  if (datos?.municipios?.visitados?.length) {
    const headers = ['Municipio','Visitas','Obras','Última Visita','Sentiment'];
    const rows = datos.municipios.visitados.map(r => [
      r.municipio, r.visitas, r.obras,
      r.ultima_visita ? new Date(r.ultima_visita).toLocaleDateString('es-VE') : '—',
      r.sentiment,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...rows]), 'Municipios Visitados');
  }

  if (datos?.ranking?.length) {
    const headers = ['Municipio','Publicaciones','Obras','Problemas','Menciones Negativas','Sentiment'];
    const rows = datos.ranking.map(r => [r.municipio, r.total_publicaciones, r.obras, r.problemas, r.menciones_negativas, r.sentiment_promedio]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...rows]), 'Ranking Municipios');
  }

  if (datos?.obrasSector?.length) {
    const headers = ['Sector','Total','Inauguradas','Municipios','Sentiment'];
    const rows = datos.obrasSector.map(r => [r.sector, r.total, r.inauguradas, r.municipios, r.sentiment]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...rows]), 'Obras por Sector');
  }

  XLSX.writeFile(wb, `${nombreArchivo}-${ts}.xlsx`);
  showToast('Excel exportado correctamente', 'success');
}

function exportarCSV(datos, nombreArchivo = 'SIMGP-Tachira-ranking') {
  if (!datos?.length) return showToast('Sin datos para exportar', 'warning');
  const headers = Object.keys(datos[0]);
  const rows    = datos.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g,'""')}"`).join(','));
  const csv     = [headers.join(','), ...rows].join('\r\n');
  const blob    = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `${nombreArchivo}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado correctamente', 'success');
}

/* Exportar tabla DataTable activa */
function exportarTablaCSV(dtInstance, nombre) {
  const data    = dtInstance.rows({ search: 'applied' }).data().toArray();
  exportarCSV(data, nombre);
}
