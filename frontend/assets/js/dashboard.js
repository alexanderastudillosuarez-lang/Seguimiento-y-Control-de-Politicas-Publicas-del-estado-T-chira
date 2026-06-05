/* ══════════════════════════════════════════════════════════
   SIMGP-TÁCHIRA — Dashboard Controller
   Auto-refresh: 5 min | Filtros reactivos | Toast system
══════════════════════════════════════════════════════════ */

const REFRESH_MS  = 5 * 60 * 1000; // 5 minutos
let   refreshTimer = null;
let   globalData   = {};
let   dtRanking    = null;
let   dtFeed       = null;
let   dtAlcaldias  = null;
let   countdown    = REFRESH_MS / 1000;

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, tipo = 'info') {
  const icons = { success:'✅', warning:'⚠️', error:'❌', info:'ℹ️' };
  const el = document.createElement('div');
  el.className = 'toast-custom';
  el.innerHTML = `${icons[tipo] || ''} ${msg}`;
  document.querySelector('.toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Helpers ────────────────────────────────────────────────
function fmt(n)       { return n != null ? Number(n).toLocaleString('es-VE') : '—'; }
function fmtPct(n)    { return n != null ? `${(n * 100).toFixed(1)}%` : '—'; }
function timeAgo(d)   {
  if (!d) return '—';
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000);
  if (m <   1) return 'Ahora';
  if (m <  60) return `Hace ${m} min`;
  if (m < 1440) return `Hace ${Math.floor(m/60)}h`;
  return `Hace ${Math.floor(m/1440)}d`;
}
function semaforo(val, meta, tipo = 'mayor') {
  const ok   = tipo === 'mayor' ? val >= meta : val <= meta;
  const warn = tipo === 'mayor' ? val >= meta * 0.6 : val <= meta * 1.4;
  if (ok)   return '<span class="semaforo verde">Óptimo</span>';
  if (warn) return '<span class="semaforo amarillo">En seguimiento</span>';
  return       '<span class="semaforo rojo">Requiere atención</span>';
}
function platIcon(plataforma) {
  const icons = { instagram:'📸', facebook:'👥', twitter:'🐦', tiktok:'🎵', telegram:'📢', rss:'📰' };
  return icons[plataforma] || '📄';
}
function catClass(cat) { return `badge-cat cat-${cat || 'otro'}`; }

// ── KPIs ──────────────────────────────────────────────────
function renderKPIs(kpis) {
  if (!kpis) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('kpi-publicaciones', fmt(kpis.total_publicaciones));
  set('kpi-municipios-v',  fmt(kpis.municipios_visitados));
  set('kpi-municipios-p',  fmt(Math.max(0, kpis.municipios_pendientes)));
  set('kpi-obras-total',   fmt(kpis.obras_inauguradas));
  set('kpi-obras-hoy',     fmt(kpis.obras_hoy));
  set('kpi-obras-semana',  fmt(kpis.obras_semana));
  set('kpi-obras-mes',     fmt(kpis.obras_mes));

  const score = parseFloat(kpis.sentiment_promedio) || 0;
  set('kpi-sentiment', score.toFixed(2));
  const semEl = document.getElementById('kpi-sentiment-label');
  if (semEl) {
    const label = score > 0.3 ? 'Positivo' : score < -0.3 ? 'Negativo' : 'Neutro';
    const color = score > 0.3 ? '#3fb950' : score < -0.3 ? '#f85149' : '#d29922';
    semEl.innerHTML = `<span style="color:${color}">${label}</span>`;
  }

  set('kpi-ultima', timeAgo(kpis.ultima_actividad));

  const progEl = document.getElementById('prog-municipios');
  if (progEl) {
    const pct = Math.round((kpis.municipios_visitados / 29) * 100);
    progEl.style.width = pct + '%';
    document.getElementById('prog-municipios-pct')?.textContent && (document.getElementById('prog-municipios-pct').textContent = `${pct}%`);
  }
}

// ── Tabla Ranking Municipios ──────────────────────────────
function renderTablaRanking(data) {
  if (!data?.length) return;
  const tbody = document.getElementById('tbody-ranking');
  if (!tbody) return;

  tbody.innerHTML = data.map((r, i) => `
    <tr>
      <td><strong>${i+1}</strong></td>
      <td>${r.municipio}</td>
      <td><strong>${fmt(r.total_publicaciones)}</strong></td>
      <td><span style="color:#d29922;font-weight:600">${fmt(r.obras)}</span></td>
      <td><span style="color:#f85149">${fmt(r.problemas)}</span></td>
      <td>${fmt(r.menciones_negativas)}</td>
      <td>${semaforo(r.sentiment_promedio, 0, 'mayor')}</td>
      <td style="color:#7d8590;font-size:0.75rem">${timeAgo(r.ultima_actividad)}</td>
    </tr>
  `).join('');

  if (dtRanking) { dtRanking.destroy(); dtRanking = null; }
  dtRanking = new DataTable('#tabla-ranking', {
    language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
    pageLength: 10, ordering: true, searching: true,
    dom: 'frtip',
  });
}

// ── Tabla Feed ─────────────────────────────────────────────
function renderFeed(data) {
  if (!data?.length) return;
  const container = document.getElementById('feed-container');
  if (!container) return;

  container.innerHTML = data.slice(0, 30).map(p => `
    <div class="feed-item fade-in">
      <div class="feed-platform ${p.plataforma}" title="${p.plataforma}">
        <span style="font-size:0.85rem">${platIcon(p.plataforma)}</span>
      </div>
      <div class="feed-content">
        <div class="feed-meta">
          <strong style="color:#e6edf3">${p.entidad}</strong>
          · ${p.plataforma} · ${timeAgo(p.publicado_en)}
          ${p.municipio ? `· <span style="color:#58a6ff">${p.municipio}</span>` : ''}
        </div>
        <div class="feed-text">${p.resumen || p.contenido || '(Sin contenido)'}</div>
        <div class="feed-tags">
          ${p.categoria ? `<span class="${catClass(p.categoria)}">${p.categoria}</span>` : ''}
          ${p.tipo_actividad ? `<span class="feed-tag" style="background:rgba(125,133,144,0.15);color:#7d8590">${p.tipo_actividad}</span>` : ''}
          ${p.obra ? `<span class="feed-tag" style="background:rgba(210,153,34,0.15);color:#d29922">🏗 ${p.obra.substring(0,40)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
        ${p.likes       ? `<span style="font-size:0.65rem;color:#7d8590">❤ ${fmt(p.likes)}</span>`       : ''}
        ${p.comentarios ? `<span style="font-size:0.65rem;color:#7d8590">💬 ${fmt(p.comentarios)}</span>` : ''}
        ${p.url_original ? `<a href="${p.url_original}" target="_blank" style="font-size:0.65rem;color:#1f6feb">Ver →</a>` : ''}
      </div>
    </div>
  `).join('');
}

// ── Municipios visitados/pendientes ───────────────────────
function renderMunicipiosListas(data) {
  if (!data) return;
  const elV = document.getElementById('lista-visitados');
  const elP = document.getElementById('lista-pendientes');

  if (elV) elV.innerHTML = (data.visitados || []).slice(0, 10).map(m => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #21262d">
      <span style="font-size:0.8rem">${m.municipio}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:0.7rem;color:#d29922">${m.obras} obras</span>
        <span class="semaforo verde" style="font-size:0.65rem">${m.visitas} visitas</span>
      </div>
    </div>
  `).join('');

  if (elP) elP.innerHTML = (data.pendientes || []).map(m => `
    <span class="semaforo rojo" style="font-size:0.7rem;margin:2px">${m}</span>
  `).join('');
}

// ── Tabla Alcaldías ────────────────────────────────────────
function renderTablaAlcaldias(data) {
  if (!data?.length) return;
  const tbody = document.getElementById('tbody-alcaldias');
  if (!tbody) return;

  tbody.innerHTML = data.map((r, i) => `
    <tr>
      <td><strong>${i+1}</strong></td>
      <td>${r.alcaldia}</td>
      <td style="color:#7d8590">${r.municipio || '—'}</td>
      <td><strong>${fmt(r.publicaciones)}</strong></td>
      <td style="color:#d29922;font-weight:600">${fmt(r.obras)}</td>
      <td>${fmt(r.engagement)}</td>
      <td>${semaforo(r.sentiment, 0, 'mayor')}</td>
    </tr>
  `).join('');

  if (dtAlcaldias) { dtAlcaldias.destroy(); dtAlcaldias = null; }
  dtAlcaldias = new DataTable('#tabla-alcaldias', {
    language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
    pageLength: 10,
  });
}

// ── Filtros ────────────────────────────────────────────────
function initFiltros() {
  document.getElementById('filtro-desde')?.addEventListener('change',        e => { setFilter('desde', e.target.value);        aplicarFiltros(); });
  document.getElementById('filtro-hasta')?.addEventListener('change',        e => { setFilter('hasta', e.target.value);        aplicarFiltros(); });
  document.getElementById('filtro-municipio')?.addEventListener('change',    e => { setFilter('municipio', e.target.value);    aplicarFiltros(); });
  document.getElementById('filtro-organismo')?.addEventListener('input',     e => { setFilter('organismo', e.target.value);    aplicarFiltros(); });
  document.getElementById('filtro-categoria')?.addEventListener('change',    e => { setFilter('categoria', e.target.value);    aplicarFiltros(); });
  document.getElementById('filtro-tipo')?.addEventListener('change',         e => { setFilter('tipo_actividad', e.target.value); aplicarFiltros(); });
  document.getElementById('btn-limpiar-filtros')?.addEventListener('click',  () => {
    ['filtro-desde','filtro-hasta','filtro-municipio','filtro-organismo','filtro-categoria','filtro-tipo']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    ['desde','hasta','municipio','organismo','categoria','tipo_actividad'].forEach(k => setFilter(k,''));
    aplicarFiltros();
  });
}

let filtroTimeout = null;
function aplicarFiltros() {
  clearTimeout(filtroTimeout);
  filtroTimeout = setTimeout(() => cargarDashboard(), 600);
}

// ── Countdown de próximo refresh ──────────────────────────
function startCountdown() {
  countdown = REFRESH_MS / 1000;
  const el  = document.getElementById('countdown');
  const tick = setInterval(() => {
    countdown--;
    if (el) el.textContent = `Actualiza en ${Math.floor(countdown/60)}:${String(countdown%60).padStart(2,'0')}`;
    if (countdown <= 0) clearInterval(tick);
  }, 1000);
}

// ── Carga principal ────────────────────────────────────────
async function cargarDashboard() {
  document.getElementById('loading-bar')?.style.setProperty('width','30%');

  try {
    const [kpis, municipios, obrasSector, obrasTemporal, tendencia,
           sentimentRedes, problemas, ranking, organismos, mapa, feed, alcaldias] =
      await Promise.allSettled([
        API.kpis(), API.municipios(), API.obrasSector(), API.obrasTemporal(),
        API.tendencia(), API.sentimentRedes(), API.problemasSociales(),
        API.rankingMunicipios(), API.organismos(), API.mapa(), API.feed(), API.alcaldias(),
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

    document.getElementById('loading-bar')?.style.setProperty('width','80%');

    globalData = { kpis, municipios, obrasSector, obrasTemporal, tendencia,
                   sentimentRedes, problemas, ranking, organismos, mapa, feed, alcaldias };

    renderKPIs(kpis);
    renderMunicipiosListas(municipios);
    renderDonutSector(obrasSector);
    renderBarObras(obrasTemporal);
    renderLineTendencia(tendencia);
    renderBarSentimentRedes(sentimentRedes);
    renderBarProblemas(problemas);
    renderBarRanking(ranking);
    renderRadarCategorias(obrasSector);
    renderBarOrganismos(organismos);
    renderMapa(mapa || []);
    renderFeed(feed);
    renderTablaRanking(ranking);
    renderTablaAlcaldias(alcaldias);

    document.getElementById('last-update')?.textContent && (
      document.getElementById('last-update').textContent =
        'Última actualización: ' + new Date().toLocaleTimeString('es-VE')
    );
    document.getElementById('loading-bar')?.style.setProperty('width','100%');
    setTimeout(() => document.getElementById('loading-bar')?.style.setProperty('width','0%'), 500);

  } catch(err) {
    console.error('Error cargando dashboard:', err);
    showToast('Error cargando datos. Reintentando...', 'error');
  }
}

// ── Sidebar toggle ─────────────────────────────────────────
function initSidebar() {
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('expanded');
  });
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function() {
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      const target = this.dataset.section;
      if (target) document.getElementById(target)?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

// ── Exportaciones ──────────────────────────────────────────
function initExports() {
  document.getElementById('btn-export-pdf')?.addEventListener('click',  exportarPDF);
  document.getElementById('btn-export-excel')?.addEventListener('click', () => exportarExcel(globalData));
  document.getElementById('btn-export-csv')?.addEventListener('click',  () => exportarCSV(globalData.ranking, 'ranking-municipios'));
}

// ── Reloj en topbar ────────────────────────────────────────
function initReloj() {
  const el = document.getElementById('topbar-clock');
  const tick = () => {
    if (el) el.textContent = new Date().toLocaleString('es-VE', { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initReloj();
  initSidebar();
  initFiltros();
  initExports();
  initMapa();

  await cargarDashboard();
  startCountdown();

  refreshTimer = setInterval(() => {
    cargarDashboard();
    startCountdown();
  }, REFRESH_MS);

  showToast('Dashboard cargado correctamente', 'success');
});
