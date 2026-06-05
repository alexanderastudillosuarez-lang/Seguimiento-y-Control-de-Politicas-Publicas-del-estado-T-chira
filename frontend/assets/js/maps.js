/* ── Mapa Leaflet — Táchira ──────────────────────────────── */

let mapaInstance = null;
let mapaMarkers  = L.layerGroup();
let mapaHeat     = null;

// Coordenadas centradas en Táchira
const TACHIRA_CENTER = [7.77, -72.22];
const TACHIRA_ZOOM   = 8;

// Colores según nivel de actividad
function colorActividad(publicaciones) {
  if (publicaciones > 50) return '#f85149';
  if (publicaciones > 20) return '#d29922';
  if (publicaciones > 5)  return '#1f6feb';
  if (publicaciones > 0)  return '#3fb950';
  return '#21262d';
}

function radiusActividad(publicaciones) {
  return Math.max(8, Math.min(28, 8 + Math.sqrt(publicaciones || 0) * 2.5));
}

function sentimentEmoji(score) {
  if (score >  0.5) return '😊';
  if (score >  0.1) return '🙂';
  if (score > -0.1) return '😐';
  if (score > -0.5) return '😟';
  return '😡';
}

function initMapa() {
  if (mapaInstance) return;

  mapaInstance = L.map('mapa-tachira', {
    center:        TACHIRA_CENTER,
    zoom:          TACHIRA_ZOOM,
    zoomControl:   true,
    attributionControl: false,
  });

  // Tile layer oscuro
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(mapaInstance);

  L.control.attribution({ prefix: 'SIMGP-Táchira | © CartoDB' }).addTo(mapaInstance);
  mapaMarkers.addTo(mapaInstance);
}

function renderMapa(datos) {
  if (!mapaInstance) initMapa();
  mapaMarkers.clearLayers();

  datos.forEach(mun => {
    if (!mun.lat || !mun.lng) return;

    const color  = colorActividad(mun.publicaciones);
    const radius = radiusActividad(mun.publicaciones);

    const circle = L.circleMarker([mun.lat, mun.lng], {
      radius,
      fillColor:   color,
      color:       '#0e1117',
      weight:      2,
      fillOpacity: 0.8,
    });

    const fecha = mun.ultima_actividad
      ? new Date(mun.ultima_actividad).toLocaleDateString('es-VE')
      : 'Sin actividad';

    circle.bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:180px;color:#e6edf3;background:#161b22;padding:2px">
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:6px">${mun.municipio}</div>
        <div style="font-size:0.75rem;color:#7d8590">Capital: ${mun.capital || '—'}</div>
        <hr style="border-color:#21262d;margin:6px 0">
        <table style="font-size:0.75rem;width:100%;border-collapse:collapse">
          <tr><td style="color:#7d8590">Publicaciones</td><td style="text-align:right;font-weight:600">${mun.publicaciones}</td></tr>
          <tr><td style="color:#7d8590">Obras</td><td style="text-align:right;font-weight:600;color:#d29922">${mun.obras}</td></tr>
          <tr><td style="color:#7d8590">Sentiment</td><td style="text-align:right">${sentimentEmoji(mun.sentiment)} ${mun.sentiment?.toFixed(2) || '—'}</td></tr>
          <tr><td style="color:#7d8590">Última actividad</td><td style="text-align:right">${fecha}</td></tr>
        </table>
      </div>
    `, { className: 'custom-tooltip' });

    circle.bindTooltip(mun.municipio, { permanent: false, direction: 'top', className: 'custom-tooltip' });
    mapaMarkers.addLayer(circle);
  });

  // Leyenda
  if (mapaInstance._legendControl) mapaInstance.removeControl(mapaInstance._legendControl);
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.innerHTML = `
      <div style="background:#161b22;border:1px solid #21262d;padding:10px 14px;border-radius:8px;font-size:0.72rem;color:#7d8590">
        <div style="font-weight:700;color:#e6edf3;margin-bottom:6px">Actividad</div>
        ${[['#f85149','+50'],['#d29922','21-50'],['#1f6feb','6-20'],['#3fb950','1-5'],['#21262d','Sin datos']]
          .map(([c,l]) => `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c}"></span>${l}
          </div>`).join('')}
      </div>`;
    return div;
  };
  legend.addTo(mapaInstance);
  mapaInstance._legendControl = legend;
}
