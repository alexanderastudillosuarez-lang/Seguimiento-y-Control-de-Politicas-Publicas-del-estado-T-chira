/**
 * Generador PDF server-side — PDFKit
 * Produce reportes ejecutivos con gráficos de texto, tablas y KPIs
 */
const PDFDocument = require('pdfkit');
const q = require('./queries');

const C = {
    bg:      '#0E1117',
    card:    '#161B22',
    border:  '#21262D',
    accent:  '#1F6FEB',
    success: '#3FB950',
    warning: '#D29922',
    danger:  '#F85149',
    text:    '#E6EDF3',
    muted:   '#7D8590',
    white:   '#FFFFFF',
};

function hex(color) { return color; }

class PDFReport {
    constructor() {
        this.doc = new PDFDocument({
            size:    'A4',
            margins: { top:40, bottom:40, left:40, right:40 },
            info:    { Title:'Reporte SIMGP-Táchira', Author:'Gobernación del Estado Táchira' },
        });
        this.W    = this.doc.page.width;
        this.H    = this.doc.page.height;
        this.x    = 40;
        this.y    = 40;
    }

    // ── Fondo oscuro en toda la página ──────────────────
    fondoOscuro() {
        this.doc.rect(0, 0, this.W, this.H).fill(C.bg);
        return this;
    }

    // ── Encabezado ──────────────────────────────────────
    header(titulo, subtitulo) {
        this.fondoOscuro();
        // Barra superior
        this.doc.rect(0, 0, this.W, 55).fill(C.card);
        this.doc.rect(0, 0, this.W, 3).fill(C.accent);

        // Punto azul + título
        this.doc.circle(45, 27, 5).fill(C.accent);
        this.doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
            .text('Sistema Inteligente de Monitoreo de Gestión Pública — Estado Táchira', 58, 18);
        this.doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text(`Generado: ${new Date().toLocaleString('es-VE', { timeZone:'America/Caracas' })}`, 58, 35);

        // Título del reporte
        this.doc.rect(0, 55, this.W, 50).fill('#0A0F16');
        this.doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white)
            .text(titulo, 40, 65, { align:'center' });
        if (subtitulo) {
            this.doc.font('Helvetica').fontSize(9).fillColor(C.muted)
                .text(subtitulo, 40, 88, { align:'center' });
        }

        this.y = 120;
        return this;
    }

    // ── Sección con título ───────────────────────────────
    seccion(titulo) {
        if (this.y > this.H - 100) { this.doc.addPage(); this.fondoOscuro(); this.y = 40; }
        this.doc.rect(this.x, this.y, this.W - 80, 22).fill(C.card);
        this.doc.rect(this.x, this.y, 3, 22).fill(C.accent);
        this.doc.font('Helvetica-Bold').fontSize(10).fillColor(C.accent)
            .text(titulo.toUpperCase(), this.x + 10, this.y + 7);
        this.y += 28;
        return this;
    }

    // ── Fila de KPIs ─────────────────────────────────────
    kpiRow(kpis) {
        const w = (this.W - 80) / kpis.length;
        kpis.forEach((kpi, i) => {
            const kx = this.x + i * w;
            this.doc.rect(kx, this.y, w - 4, 52).fill(C.card);
            this.doc.rect(kx, this.y, w - 4, 2).fill(kpi.color || C.accent);
            this.doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                .text(kpi.label, kx + 6, this.y + 8, { width: w - 12, align:'left' });
            this.doc.font('Helvetica-Bold').fontSize(20).fillColor(kpi.color || C.accent)
                .text(String(kpi.valor ?? '—'), kx + 6, this.y + 18, { width: w - 12 });
            if (kpi.sub) {
                this.doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                    .text(kpi.sub, kx + 6, this.y + 40, { width: w - 12 });
            }
        });
        this.y += 60;
        return this;
    }

    // ── Tabla ────────────────────────────────────────────
    tabla(columnas, filas, titulo) {
        if (titulo) this.seccion(titulo);

        const colW    = (this.W - 80) / columnas.length;
        const rowH    = 18;

        // Cabecera
        this.doc.rect(this.x, this.y, this.W - 80, rowH).fill(C.accent);
        columnas.forEach((col, i) => {
            this.doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
                .text(col, this.x + i * colW + 4, this.y + 5, { width: colW - 8, align:'left' });
        });
        this.y += rowH;

        // Filas
        filas.forEach((fila, ri) => {
            if (this.y > this.H - 60) {
                this.doc.addPage(); this.fondoOscuro(); this.y = 40;
                // Repetir cabecera
                this.doc.rect(this.x, this.y, this.W - 80, rowH).fill(C.accent);
                columnas.forEach((col, i) => {
                    this.doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
                        .text(col, this.x + i * colW + 4, this.y + 5, { width: colW - 8 });
                });
                this.y += rowH;
            }
            const bg = ri % 2 === 0 ? C.bg : C.card;
            this.doc.rect(this.x, this.y, this.W - 80, rowH).fill(bg);
            fila.forEach((celda, ci) => {
                const val   = celda ?? '—';
                const color = String(val).startsWith('✅') ? C.success
                            : String(val).startsWith('⚠️') ? C.warning
                            : String(val).startsWith('🔴') ? C.danger
                            : C.text;
                this.doc.font('Helvetica').fontSize(7.5).fillColor(color)
                    .text(String(val).substring(0, 45), this.x + ci * colW + 4, this.y + 5, { width: colW - 8 });
            });
            this.y += rowH;
        });
        this.y += 8;
        return this;
    }

    // ── Barra horizontal simple (simula gráfico) ─────────
    barraHorizontal(datos, titulo, colorBarra = C.accent) {
        if (titulo) this.seccion(titulo);
        const maxVal = Math.max(...datos.map(d => d.valor), 1);
        const maxW   = this.W - 200;

        datos.slice(0, 12).forEach(d => {
            if (this.y > this.H - 50) { this.doc.addPage(); this.fondoOscuro(); this.y = 40; }
            this.doc.font('Helvetica').fontSize(8).fillColor(C.text)
                .text(String(d.label).substring(0, 22), this.x, this.y + 3, { width: 115 });
            const barW = Math.max(4, Math.round((d.valor / maxVal) * maxW));
            this.doc.rect(this.x + 120, this.y, barW, 14).fill(colorBarra);
            this.doc.font('Helvetica-Bold').fontSize(8).fillColor(C.text)
                .text(String(d.valor), this.x + 124 + barW, this.y + 3);
            this.y += 18;
        });
        this.y += 6;
        return this;
    }

    // ── Pie de página ────────────────────────────────────
    footer() {
        const pages = this.doc.bufferedPageRange();
        for (let i = pages.start; i < pages.start + pages.count; i++) {
            this.doc.switchToPage(i);
            this.doc.rect(0, this.H - 30, this.W, 30).fill(C.card);
            this.doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                .text('SIMGP-Táchira — Gobernación del Estado Táchira — Uso interno y oficial',
                    40, this.H - 20, { align:'left' });
            this.doc.text(`Pág. ${i+1} de ${pages.count}`, 40, this.H - 20, { align:'right', width: this.W - 80 });
        }
        return this;
    }

    getStream() { return this.doc; }
    end()       { this.doc.end(); return this; }
}

async function generarPDFEjecutivo(filtros = {}) {
    const [resumen, sectores, municipios, obras, problemas] = await Promise.all([
        q.getResumenEjecutivo(filtros.desde, filtros.hasta),
        q.getObrasPorSectorDetalle(filtros.desde, filtros.hasta),
        q.getMunicipiosDetalle(filtros.desde, filtros.hasta),
        q.getTopObras(15, filtros.desde, filtros.hasta),
        q.getProblemasSocialesDetalle(filtros.desde, filtros.hasta),
    ]);

    const sub = filtros.desde
        ? `Período: ${filtros.desde} — ${filtros.hasta || 'hoy'}`
        : `Generado: ${new Date().toLocaleDateString('es-VE')}`;

    const rpt = new PDFReport();

    rpt.header('Reporte Ejecutivo de Gestión Pública', sub)

    // ── KPIs principales ─────────────────────────────────
    .seccion('Indicadores Clave de Gestión')
    .kpiRow([
        { label:'Total Publicaciones',  valor: resumen.total_publicaciones, color: C.accent },
        { label:'Municipios Visitados', valor: `${resumen.municipios_visitados}/29`, color: C.success },
        { label:'Obras Inauguradas',    valor: resumen.obras_inauguradas, color: C.warning },
        { label:'Sentiment Promedio',   valor: resumen.sentiment_promedio, color: parseFloat(resumen.sentiment_promedio) > 0 ? C.success : C.danger },
    ])
    .kpiRow([
        { label:'Obras Último Mes',     valor: resumen.obras_ultimo_mes, color: C.warning, sub:'últimos 30 días' },
        { label:'Publicaciones Pos.',   valor: resumen.publicaciones_positivas, color: C.success },
        { label:'Publicaciones Neg.',   valor: resumen.publicaciones_negativas, color: C.danger },
        { label:'Tipos de Problemas',   valor: resumen.tipos_problemas, color: C.muted },
    ])

    // ── Obras por sector ─────────────────────────────────
    .barraHorizontal(
        sectores.map(s => ({ label: s.sector, valor: parseInt(s.inauguradas) || 0 })),
        'Obras Inauguradas por Sector', C.warning
    )

    // ── Top Municipios ───────────────────────────────────
    .tabla(
        ['Municipio','Publ.','Obras','Problemas','Sentiment','Última visita'],
        municipios.slice(0, 15).map(m => [
            m.municipio,
            m.publicaciones,
            m.obras,
            m.problemas_detectados,
            parseFloat(m.sentiment) > 0.3 ? '✅ Pos.' : parseFloat(m.sentiment) < -0.3 ? '🔴 Neg.' : '⚠️ Neu.',
            m.ultima_visita ? new Date(m.ultima_visita).toLocaleDateString('es-VE') : '—',
        ]),
        'Ranking de Municipios por Actividad'
    )

    // ── Top Obras ────────────────────────────────────────
    .tabla(
        ['Obra','Municipio','Sector','Inversión','Organismo','Fecha'],
        obras.slice(0, 12).map(o => [
            (o.obra || '').substring(0, 35),
            o.municipio,
            o.sector,
            o.inversion || '—',
            (o.organismo || '').substring(0, 25),
            o.fecha ? new Date(o.fecha).toLocaleDateString('es-VE') : '—',
        ]),
        'Obras Inauguradas en el Período'
    )

    // ── Problemas sociales ───────────────────────────────
    .barraHorizontal(
        problemas.map(p => ({ label: (p.problema||'').substring(0,25), valor: parseInt(p.frecuencia) })),
        'Problemas Sociales más Frecuentes', C.danger
    )

    .footer()
    .end();

    return rpt.getStream();
}

module.exports = { generarPDFEjecutivo };
