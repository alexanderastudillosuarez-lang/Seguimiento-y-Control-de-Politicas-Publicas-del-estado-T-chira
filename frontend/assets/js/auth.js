/* ── Auth guard + WebSocket real-time ────────────────────── */

const TOKEN = localStorage.getItem('simgp_token');
const USER  = JSON.parse(localStorage.getItem('simgp_user') || '{}');

// Guard: redirigir al login si no hay token (solo en producción)
if (window.REQUIRE_AUTH && !TOKEN) {
    window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
}

// Inyectar token en todas las llamadas API
const _origFetch = window.fetch;
window.fetch = function(url, opts = {}) {
    if (TOKEN && typeof url === 'string' && url.includes('/api/')) {
        opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${TOKEN}` };
    }
    return _origFetch(url, opts);
};

// ── WebSocket — actualizaciones en tiempo real ─────────────
function initWebSocket() {
    const wsUrl = (window.API_BASE || 'http://localhost:3000')
        .replace(/^http/, 'ws').replace('/api/v1', '') + '/ws';

    let ws, reconnectTimer;

    function connect() {
        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                document.querySelector('.dot-live')?.style.setProperty('background', '#3fb950');
                console.log('[WS] Conectado');
            };

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                handleWSMessage(msg);
            };

            ws.onclose = () => {
                document.querySelector('.dot-live')?.style.setProperty('background', '#f85149');
                reconnectTimer = setTimeout(connect, 5000);
            };

            ws.onerror = () => ws.close();
        } catch (err) {
            console.warn('[WS] No disponible:', err.message);
        }
    }

    connect();
}

function handleWSMessage(msg) {
    switch (msg.tipo) {
        case 'nueva_publicacion':
            // Actualizar badge de publicaciones en tiempo real
            const kpiEl = document.getElementById('kpi-publicaciones');
            if (kpiEl) {
                const actual = parseInt(kpiEl.textContent.replace(/\./g, '')) || 0;
                kpiEl.textContent = (actual + 1).toLocaleString('es-VE');
                kpiEl.style.animation = 'none';
                setTimeout(() => kpiEl.style.animation = '', 10);
            }
            break;

        case 'nueva_alerta':
            mostrarAlertaToast(msg.payload);
            actualizarBadgeAlertas();
            break;

        case 'connected':
            console.log('[WS]', msg.payload?.msg);
            break;
    }
}

function mostrarAlertaToast(alerta) {
    const iconos   = { critica:'🚨', alta:'⚠️', media:'📢', baja:'ℹ️', info:'📌' };
    const colores  = { critica:'#f85149', alta:'#d29922', media:'#1f6feb', baja:'#3fb950', info:'#7d8590' };
    const icono    = iconos[alerta?.severidad]  || '📌';
    const color    = colores[alerta?.severidad] || '#7d8590';

    const el = document.createElement('div');
    el.className = 'toast-custom';
    el.innerHTML = `
        <div style="display:flex;gap:8px;align-items:flex-start">
            <span style="font-size:1rem">${icono}</span>
            <div>
                <div style="font-weight:700;color:${color};font-size:0.8rem">${alerta?.titulo || 'Alerta'}</div>
                <div style="font-size:0.74rem;color:#7d8590;margin-top:2px">${alerta?.mensaje || ''}</div>
            </div>
        </div>`;
    document.querySelector('.toast-container')?.appendChild(el);
    setTimeout(() => el.remove(), 6000);
}

function actualizarBadgeAlertas() {
    const badge = document.getElementById('badge-alertas');
    if (!badge) return;
    const n = parseInt(badge.textContent || '0') + 1;
    badge.textContent = n;
    badge.style.display = 'inline';
}

// Mostrar nombre de usuario en topbar
function renderUserTopbar() {
    const el = document.getElementById('topbar-user');
    if (!el || !USER.nombre) return;
    el.innerHTML = `
        <span style="font-size:0.75rem;color:#7d8590">${USER.nombre}</span>
        ${USER.rol === 'super_admin' || USER.rol === 'admin'
            ? '<a href="/admin" style="color:#1f6feb;font-size:0.75rem;text-decoration:none;margin-left:8px"><i class="bi bi-gear"></i></a>'
            : ''}
        <button onclick="logoutUser()" style="background:none;border:none;color:#7d8590;cursor:pointer;font-size:0.75rem;margin-left:4px">
            <i class="bi bi-box-arrow-right"></i>
        </button>`;
}

function logoutUser() {
    localStorage.removeItem('simgp_token');
    localStorage.removeItem('simgp_user');
    window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', () => {
    renderUserTopbar();
    initWebSocket();
});
