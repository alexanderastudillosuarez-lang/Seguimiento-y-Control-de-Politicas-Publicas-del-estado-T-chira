/* ── Configuración global Chart.js ───────────────────────── */
Chart.defaults.color          = '#7d8590';
Chart.defaults.borderColor    = '#21262d';
Chart.defaults.font.family    = "'Inter','Segoe UI',system-ui,sans-serif";
Chart.defaults.font.size      = 11;
Chart.defaults.plugins.legend.labels.color = '#7d8590';
Chart.defaults.plugins.tooltip.backgroundColor = '#161b22';
Chart.defaults.plugins.tooltip.borderColor     = '#21262d';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.titleColor      = '#e6edf3';
Chart.defaults.plugins.tooltip.bodyColor       = '#7d8590';
Chart.defaults.plugins.tooltip.padding         = 10;

const PALETTE = [
  '#1f6feb','#3fb950','#d29922','#f85149','#bc8cff',
  '#38bdf8','#fbbf24','#34d399','#f87171','#a78bfa','#fb923c','#9ca3af'
];

const PALETTE_ALPHA = (i, a = 0.7) => {
  const hex = PALETTE[i % PALETTE.length];
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

const registry = {};

function destroyIfExists(id) {
  if (registry[id]) { registry[id].destroy(); delete registry[id]; }
}

/* ── 1. Obras por sector — Donut ─────────────────────────── */
function renderDonutSector(data) {
  destroyIfExists('chart-donut-sector');
  const ctx = document.getElementById('chart-donut-sector');
  if (!ctx || !data?.length) return;
  registry['chart-donut-sector'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   data.map(d => d.sector),
      datasets: [{
        data:            data.map(d => d.total),
        backgroundColor: data.map((_, i) => PALETTE_ALPHA(i, 0.85)),
        borderColor:     data.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 1, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} publicaciones` } },
      },
    },
  });
}

/* ── 2. Obras por día — Barras ───────────────────────────── */
function renderBarObras(data) {
  destroyIfExists('chart-bar-obras');
  const ctx = document.getElementById('chart-bar-obras');
  if (!ctx || !data?.length) return;
  const sorted = [...data].sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).slice(-30);
  registry['chart-bar-obras'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(d => new Date(d.fecha).toLocaleDateString('es-VE',{day:'2-digit',month:'short'})),
      datasets: [{
        label: 'Obras inauguradas',
        data:  sorted.map(d => d.obras_inauguradas),
        backgroundColor: PALETTE_ALPHA(0, 0.7),
        borderColor:     PALETTE[0],
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#21262d' }, ticks: { maxRotation: 45 } },
        y: { grid: { color: '#21262d' }, beginAtZero: true, ticks: { stepSize: 1 } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/* ── 3. Tendencia histórica — Líneas ─────────────────────── */
function renderLineTendencia(data) {
  destroyIfExists('chart-line-tendencia');
  const ctx = document.getElementById('chart-line-tendencia');
  if (!ctx || !data?.length) return;
  registry['chart-line-tendencia'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.semana).toLocaleDateString('es-VE',{day:'2-digit',month:'short'})),
      datasets: [
        {
          label: 'Positivas', data: data.map(d => d.positivas),
          borderColor: '#3fb950', backgroundColor: 'rgba(63,185,80,0.1)',
          fill: true, tension: 0.4, pointRadius: 3,
        },
        {
          label: 'Neutras', data: data.map(d => d.neutras),
          borderColor: '#7d8590', backgroundColor: 'rgba(125,133,144,0.05)',
          fill: false, tension: 0.4, pointRadius: 3,
        },
        {
          label: 'Negativas', data: data.map(d => d.negativas),
          borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)',
          fill: true, tension: 0.4, pointRadius: 3,
        },
        {
          label: 'Obras', data: data.map(d => d.obras),
          borderColor: '#d29922', backgroundColor: 'transparent',
          borderDash: [5,3], tension: 0.4, pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: '#21262d' } },
        y: { grid: { color: '#21262d' }, beginAtZero: true },
      },
    },
  });
}

/* ── 4. Sentiment por redes — Barras apiladas ────────────── */
function renderBarSentimentRedes(data) {
  destroyIfExists('chart-sentiment-redes');
  const ctx = document.getElementById('chart-sentiment-redes');
  if (!ctx || !data?.length) return;
  registry['chart-sentiment-redes'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.plataforma),
      datasets: [
        { label:'Muy Positivo', data: data.map(d=>d.muy_positivo), backgroundColor:'rgba(63,185,80,0.9)' },
        { label:'Positivo',     data: data.map(d=>d.positivo),     backgroundColor:'rgba(63,185,80,0.45)' },
        { label:'Neutro',       data: data.map(d=>d.neutro),       backgroundColor:'rgba(125,133,144,0.5)' },
        { label:'Negativo',     data: data.map(d=>d.negativo),     backgroundColor:'rgba(248,81,73,0.45)' },
        { label:'Muy Negativo', data: data.map(d=>d.muy_negativo), backgroundColor:'rgba(248,81,73,0.9)' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { color: '#21262d' } },
        y: { stacked: true, grid: { color: '#21262d' }, beginAtZero: true },
      },
    },
  });
}

/* ── 5. Ranking municipios — Barras horizontales ─────────── */
function renderBarRanking(data) {
  destroyIfExists('chart-ranking');
  const ctx = document.getElementById('chart-ranking');
  if (!ctx || !data?.length) return;
  const top = data.slice(0, 15);
  registry['chart-ranking'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(d => d.municipio),
      datasets: [
        { label:'Obras',    data: top.map(d=>d.obras),    backgroundColor: PALETTE_ALPHA(0,0.8), borderRadius:3 },
        { label:'Problemas', data: top.map(d=>d.problemas), backgroundColor: PALETTE_ALPHA(3,0.8), borderRadius:3 },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#21262d' }, stacked: false },
        y: { grid: { display: false } },
      },
    },
  });
}

/* ── 6. Radar categorías ─────────────────────────────────── */
function renderRadarCategorias(data) {
  destroyIfExists('chart-radar');
  const ctx = document.getElementById('chart-radar');
  if (!ctx || !data?.length) return;
  registry['chart-radar'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: data.map(d => d.sector),
      datasets: [{
        label: 'Publicaciones por sector',
        data:  data.map(d => d.total),
        backgroundColor: 'rgba(31,111,235,0.2)',
        borderColor:     '#1f6feb',
        pointBackgroundColor: '#1f6feb',
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { grid: { color: '#21262d' }, pointLabels: { color: '#7d8590', font: { size: 10 } }, ticks: { display: false } } },
    },
  });
}

/* ── 7. Problemas sociales — Barras ─────────────────────── */
function renderBarProblemas(data) {
  destroyIfExists('chart-problemas');
  const ctx = document.getElementById('chart-problemas');
  if (!ctx || !data?.length) return;
  const top = data.slice(0, 10);
  registry['chart-problemas'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(d => d.problema?.substring(0, 30) + (d.problema?.length > 30 ? '…' : '')),
      datasets: [{
        label: 'Frecuencia',
        data:  top.map(d => d.frecuencia),
        backgroundColor: top.map((_, i) => PALETTE_ALPHA(i, 0.75)),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#21262d' } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/* ── 8. Organismos activos — Barras horizontales ─────────── */
function renderBarOrganismos(data) {
  destroyIfExists('chart-organismos');
  const ctx = document.getElementById('chart-organismos');
  if (!ctx || !data?.length) return;
  const top = data.slice(0, 12);
  registry['chart-organismos'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(d => d.organismo?.substring(0, 25)),
      datasets: [{
        label: 'Publicaciones',
        data:  top.map(d => d.publicaciones),
        backgroundColor: PALETTE_ALPHA(1, 0.75),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#21262d' } },
        y: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}
