/* ── Cliente API ─────────────────────────────────────────── */
const API_BASE = window.API_BASE || 'http://localhost:3000/api/v1';

const _filters = {
  desde: '', hasta: '', municipio: '', organismo: '', categoria: '', tipo_actividad: ''
};

function getFilters() {
  return Object.fromEntries(
    Object.entries(_filters).filter(([, v]) => v !== '' && v !== null)
  );
}

function setFilter(key, value) { _filters[key] = value || ''; }

function buildQS(extra = {}) {
  const p = new URLSearchParams({ ...getFilters(), ...extra });
  return p.toString() ? `?${p}` : '';
}

async function apiFetch(endpoint, extra = {}) {
  const url = `${API_BASE}${endpoint}${buildQS(extra)}`;
  const res  = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${endpoint}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido');
  return json.data;
}

const API = {
  kpis:              ()     => apiFetch('/dashboard/kpis'),
  municipios:        ()     => apiFetch('/dashboard/municipios'),
  obrasTemporal:     ()     => apiFetch('/dashboard/obras-temporal'),
  obrasSector:       ()     => apiFetch('/dashboard/obras-sector'),
  problemasSociales: ()     => apiFetch('/dashboard/problemas-sociales'),
  rankingMunicipios: ()     => apiFetch('/dashboard/ranking-municipios'),
  tendencia:         ()     => apiFetch('/dashboard/tendencia'),
  organismos:        ()     => apiFetch('/dashboard/organismos'),
  sentimentRedes:    ()     => apiFetch('/dashboard/sentiment-redes'),
  mapa:              ()     => apiFetch('/dashboard/mapa'),
  feed:              ()     => apiFetch('/dashboard/feed'),
  alcaldias:         ()     => apiFetch('/dashboard/alcaldias'),
  resumen:           ()     => apiFetch('/dashboard/resumen'),
};
