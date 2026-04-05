// ════════════════════════════════════
// NEXUS AGENT — agents/digital/generator.js
// Genera productos como HTML con tabs/acordeón
// Cada sección se genera por separado para evitar truncado
// ════════════════════════════════════

import { preguntarCompleto, MODEL_SONNET } from '../../core/claude.js';
import { db } from '../../core/database.js';
import { enviar } from '../../core/telegram.js';

// Pausa entre secciones para evitar rate limit de Anthropic
const delay = ms => new Promise(r => setTimeout(r, ms));
const DELAY_SECCIONES = 2000; // 2 segundos entre llamadas (era 4s)

const SYSTEM = `Eres un experto creador de productos digitales premium para el mercado hispano.
Tu misión: crear contenido que haga que el cliente diga "wow, pagué muy poco por esto".
Escribes para latinos reales — no para marketeros. Tu tono es de amigo que sabe, no de gurú.

REGLAS DE CALIDAD — OBLIGATORIAS EN CADA SECCIÓN:
1. ESPECIFICIDAD REAL: Herramientas reales con precios reales, pasos con clicks exactos
   MAL: "usa una herramienta de diseño" | BIEN: "abre Canva (canva.com, gratis) → New Design → Instagram Post"
2. NÚMEROS CONCRETOS: Siempre con cifras reales del mercado
   MAL: "puedes ganar buen dinero" | BIEN: "promedio $1,200/mes los primeros 3 meses, $3,500+ al año"
3. PERSONAJES LATINOS ESPECÍFICOS: Usa el perfil del cliente ideal como personaje en ejemplos
   MAL: "un usuario de Texas" | BIEN: "Jorge, 38 años de Houston, que llegó hace 5 años de Michoacán"
4. ACCIONABLE HOY: Cada paso se puede ejecutar hoy, sin prereqs ocultos
5. PROGRESIÓN: Cada sección construye sobre la anterior — di "como viste en la sección anterior..."
6. CERO RELLENO: Sin "es importante recordar", "como mencionamos", "en conclusión". Directo al valor.
7. EJERCICIO PRÁCTICO: Termina cada sección con una acción inmediata concreta
8. CONTEXTO CULTURAL: Menciona barrios, ciudades, formas de pago y situaciones reales del subgrupo

Devuelves SOLO el HTML del contenido, sin <html> ni <body>. Contenido denso, rico, específico.

RESTRICCIONES TÉCNICAS OBLIGATORIAS — NUNCA VIOLARLAS:
- NUNCA uses <script> ni </script> — el producto ya tiene su propio JS
- NUNCA uses <style> ni </style> — el producto ya tiene su propio CSS
- NUNCA uses colores claros en inline style: no "color:#333", no "color:black", no "color:#000", no "background:white", no "background:#fff", no "background:#f5f5f5" — el fondo es OSCURO, texto claro
- Si necesitas colorear texto, usa las clases ya definidas: .highlight .tip .info .card .section-title
- Atributos style permitidos solo para: margin, padding, gap, flex, grid, width — nunca color ni background`;

// ── Shell HTML con tabs y acordeón ──────────────────────────
function crearShellHTML(titulo, subtitulo, tipo, secciones) {
  const tabs = secciones.map((s, i) => `
    <button class="tab-btn ${i === 0 ? 'active' : ''}" onclick="showTab(${i})" id="btn-${i}">
      ${s.icono} ${s.titulo}
    </button>`).join('');

  const panels = secciones.map((s, i) => `
    <div class="tab-panel ${i === 0 ? 'active' : ''}" id="panel-${i}">
      <h2 style="color:#00ff88;margin:0 0 24px;">${s.icono} ${s.titulo}</h2>
      ${s.contenido}
    </div>`).join('');

  const badges = { prompts: '⚡ PROMPTS PREMIUM', plantilla: '📋 PLANTILLA PREMIUM', guia_pdf: '📘 GUÍA PREMIUM', mini_curso: '🎓 MINI CURSO', toolkit: '🔧 TOOLKIT PREMIUM' };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:        #0F1729;
  --surface:   #172035;
  --surface2:  #1E2A42;
  --border:    #2A3A55;
  --accent:    #F5A623;
  --accent-dim:  rgba(245,166,35,0.12);
  --accent-dim2: rgba(245,166,35,0.07);
  --blue:      #4f8ef7;
  --blue-dim:  rgba(79,142,247,0.1);
  --green:     #34d399;
  --green-dim: rgba(52,211,153,0.1);
  --red:       #ff6b6b;
  --text:      #E8EAF0;
  --text-muted:#9AA3B8;
  --text-faint:#4A5568;
  --radius:    10px;
}
body { font-family: 'Inter', 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

/* ── HEADER ── */
.header {
  background: linear-gradient(135deg, #0B1220 0%, #0F1729 50%, #0B1828 100%);
  padding: 52px 24px 44px;
  text-align: center;
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;
}
.header::before {
  content: '';
  position: absolute;
  top: -60px; left: 50%; transform: translateX(-50%);
  width: 500px; height: 200px;
  background: radial-gradient(ellipse, rgba(245,166,35,0.1) 0%, transparent 70%);
  pointer-events: none;
}
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--accent-dim); color: var(--accent);
  border: 1px solid rgba(245,166,35,0.3);
  padding: 5px 16px; border-radius: 20px;
  font-size: 0.72em; font-weight: 700; letter-spacing: 1.5px;
  text-transform: uppercase; margin-bottom: 20px;
}
.header h1 {
  font-family: 'Poppins', sans-serif;
  color: #fff; font-size: clamp(1.4em, 4vw, 2.3em);
  font-weight: 700; line-height: 1.25; margin-bottom: 12px;
}
.header p { color: var(--text-muted); font-size: 1.05em; max-width: 580px; margin: 0 auto; line-height: 1.6; }

/* ── LAYOUT ── */
.layout { display: flex; min-height: calc(100vh - 180px); }

/* ── SIDEBAR ── */
.sidebar {
  width: 256px; flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 16px 0;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.sidebar-label {
  font-size: 0.68em; font-weight: 700; letter-spacing: 2px;
  color: var(--text-faint); text-transform: uppercase;
  padding: 8px 20px 12px; display: block;
}
.tab-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; text-align: left; background: none; border: none;
  color: var(--text-muted); padding: 11px 20px;
  cursor: pointer; font-size: 0.88em; font-family: inherit;
  transition: all 0.15s; border-left: 3px solid transparent;
  line-height: 1.4; font-weight: 500;
}
.tab-btn:hover { background: var(--surface2); color: var(--text); }
.tab-btn.active {
  background: var(--accent-dim2);
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 600;
}
.tab-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--surface2); color: var(--text-faint);
  font-size: 0.75em; font-weight: 700; flex-shrink: 0;
  transition: all 0.15s;
}
.tab-btn.active .tab-num { background: var(--accent); color: #000; }

/* ── CONTENT ── */
.content { flex: 1; padding: 40px 44px; max-width: 860px; }
.tab-panel { display: none; animation: fadeIn 0.2s ease; overflow-x: auto; }
.tab-panel.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.section-title {
  font-family: 'Poppins', sans-serif;
  font-size: 1.5em; font-weight: 700; color: #fff;
  margin-bottom: 6px;
}
.section-sub { color: var(--text-muted); font-size: 0.9em; margin-bottom: 28px; }

/* ── CARDS ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px; margin-bottom: 16px;
}
.card h3 { color: #fff; margin-bottom: 10px; font-size: 1em; font-weight: 600; }
.card h4 { color: var(--accent); margin: 16px 0 8px; font-size: 0.85em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.card p { color: #C8CEDC; line-height: 1.8; margin-bottom: 10px; }
.card ul, .card ol { padding-left: 20px; }
.card li { color: #C8CEDC; line-height: 1.8; margin-bottom: 6px; }
.card strong { color: var(--text); }

/* ── HIGHLIGHT / TIP / INFO ── */
.highlight {
  background: var(--accent-dim);
  border: 1px solid rgba(245,166,35,0.25);
  border-radius: var(--radius); padding: 16px 20px; margin: 14px 0;
  color: var(--accent); font-weight: 600; line-height: 1.6;
}
.tip {
  background: var(--green-dim);
  border: 1px solid rgba(52,211,153,0.2);
  border-radius: var(--radius); padding: 14px 20px; margin: 14px 0;
  color: var(--green); font-size: 0.92em; line-height: 1.6;
}
.info {
  background: var(--blue-dim);
  border: 1px solid rgba(79,142,247,0.2);
  border-radius: var(--radius); padding: 14px 20px; margin: 14px 0;
  color: var(--blue); font-size: 0.92em; line-height: 1.6;
}

/* ── PROMPT BOX ── */
.prompt-box {
  background: #0B1220;
  border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
  margin: 14px 0; font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.87em; color: #F5A623; white-space: pre-wrap;
  line-height: 1.8; position: relative;
}
.copy-btn {
  position: absolute; top: 12px; right: 12px;
  background: var(--accent); color: #000;
  border: none; padding: 5px 14px; border-radius: 6px;
  cursor: pointer; font-size: 0.78em; font-weight: 700;
  transition: opacity 0.15s;
}
.copy-btn:hover { opacity: 0.85; }

/* ── CHECKLIST ── */
.checklist { list-style: none; padding: 0; }
.checklist li {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
  color: #C8CEDC; line-height: 1.6; font-size: 0.95em;
}
.checklist li::before {
  content: "○"; color: var(--accent);
  font-size: 1em; flex-shrink: 0; margin-top: 1px;
}

/* ── ACCORDION ── */
.accordion-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius); margin-bottom: 8px; overflow: hidden;
}
.accordion-header {
  padding: 16px 20px; cursor: pointer; color: #fff;
  display: flex; justify-content: space-between; align-items: center;
  font-weight: 600; font-size: 0.95em; transition: background 0.15s;
}
.accordion-header:hover { background: var(--surface2); }
.accordion-body { padding: 0 20px 20px; color: #C8CEDC; line-height: 1.8; display: none; }
.accordion-body p { margin-bottom: 10px; }
.accordion-body ul { padding-left: 20px; }
.arrow { transition: transform 0.2s; color: var(--accent); font-size: 0.85em; }
.open .arrow { transform: rotate(180deg); }
.open .accordion-body { display: block; }

/* ── TABLES ── */
.table-wrap { overflow-x: auto; margin: 14px 0; border-radius: var(--radius); border: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; }
thead { background: var(--surface2); }
th { color: var(--accent); padding: 12px 16px; text-align: left; font-size: 0.82em; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
td { padding: 11px 16px; border-top: 1px solid var(--border); color: #C8CEDC; font-size: 0.9em; vertical-align: top; }
tbody tr:hover { background: var(--surface2); }

/* ── SCROLL HORIZONTAL GLOBAL — tablas, certificados, cualquier contenido ancho ── */
.card { overflow-x: auto; }

/* ── FORZAR LEGIBILIDAD — Claude a veces inyecta inline styles con color oscuro ──
   Cualquier elemento dentro del panel con color oscuro queda ilegible en fondo oscuro.
   Estos overrides fuerzan el texto a ser legible sin importar el inline style. ── */
.tab-panel [style*="color:#3"],
.tab-panel [style*="color: #3"],
.tab-panel [style*="color:#2"],
.tab-panel [style*="color: #2"],
.tab-panel [style*="color:#1"],
.tab-panel [style*="color: #1"],
.tab-panel [style*="color:#0"],
.tab-panel [style*="color: #0"],
.tab-panel [style*="color:black"],
.tab-panel [style*="color: black"],
.tab-panel [style*="color:rgb(0"],
.tab-panel [style*="color: rgb(0"] { color: var(--text) !important; }
.tab-panel [style*="background:#f"],
.tab-panel [style*="background: #f"],
.tab-panel [style*="background:#e"],
.tab-panel [style*="background: #e"],
.tab-panel [style*="background:#d"],
.tab-panel [style*="background: #d"],
.tab-panel [style*="background:white"],
.tab-panel [style*="background: white"],
.tab-panel [style*="background-color:#f"],
.tab-panel [style*="background-color: #f"],
.tab-panel [style*="background-color:#e"],
.tab-panel [style*="background-color: #e"],
.tab-panel [style*="background-color:white"],
.tab-panel [style*="background-color: white"] { background: var(--surface2) !important; }

/* ── TABLE ACTIONS ── */
.table-actions { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.tbl-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
  padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit;
  transition: all 0.15s; }
.tbl-btn:hover { color: var(--accent); border-color: var(--accent); }

/* ── SECTION PRINT BUTTON ── */
.section-print-btn { float: right; background: var(--surface2); border: 1px solid var(--border);
  color: var(--text-muted); padding: 6px 14px; border-radius: 6px; cursor: pointer;
  font-size: 12px; font-family: inherit; transition: all 0.15s; margin-bottom: 16px; }
.section-print-btn:hover { color: var(--accent); border-color: var(--accent); }

/* ── PRINT STYLES ── */
@media print {
  .header, .sidebar, .mobile-menu, .footer, .tab-btn, .mobile-tab-btn,
  .section-print-btn, .tbl-btn, .table-actions, .copy-btn { display: none !important; }
  body { background: white !important; color: black !important; }
  .tab-panel { display: block !important; color: black !important; }
  .card { background: white !important; border: 1px solid #ddd !important; color: black !important; }
  .highlight { background: #fff8e1 !important; color: #333 !important; }
  .tip { background: #e8f5e9 !important; color: #333 !important; }
  .accordion-body { display: block !important; color: black !important; }
  th { background: #f0f0f0 !important; color: #333 !important; }
  td { color: #333 !important; border-top: 1px solid #ccc !important; }
  thead { background: #f0f0f0 !important; }
}

/* ── MOBILE ── */
.mobile-menu { display: none; background: var(--surface); border-bottom: 1px solid var(--border); padding: 8px 0; }
.mobile-tab-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; text-align: left; background: none; border: none;
  color: var(--text-muted); padding: 12px 20px;
  cursor: pointer; font-size: 0.9em; font-family: inherit;
  transition: all 0.15s; border-left: 3px solid transparent; font-weight: 500;
}
.mobile-tab-btn.active {
  background: var(--accent-dim2); color: var(--accent);
  border-left-color: var(--accent); font-weight: 600;
}
.mobile-tab-num {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  background: var(--surface2); color: var(--text-faint);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75em; font-weight: 700; transition: all 0.15s;
}
.mobile-tab-btn.active .mobile-tab-num { background: var(--accent); color: #000; }

/* ── FOOTER ── */
.footer { background: var(--surface); padding: 24px; text-align: center; border-top: 1px solid var(--border); margin-top: 40px; }
.footer p { color: var(--text-faint); font-size: 0.8em; }

@media (max-width: 768px) {
  .sidebar { display: none; }
  .mobile-menu { display: block; }
  .layout { flex-direction: column; }
  .content { padding: 24px 16px; }
  .section-title { font-size: 1.3em; }
}
</style>
</head>
<body>

<div class="header">
  <div class="badge">${badges[tipo] || '⚡ PRODUCTO PREMIUM'}</div>
  <h1>${titulo}</h1>
  <p>${subtitulo}</p>
</div>

<div class="mobile-menu">
  ${secciones.map((s, i) => `
  <button class="mobile-tab-btn ${i === 0 ? 'active' : ''}" onclick="showTab(${i})" id="mbtn-${i}">
    <span class="mobile-tab-num">${i + 1}</span>
    ${s.icono} ${s.titulo}
  </button>`).join('')}
</div>

<div class="layout">
  <nav class="sidebar">
    <span class="sidebar-label">Contenido</span>
    ${secciones.map((s, i) => `
    <button class="tab-btn ${i === 0 ? 'active' : ''}" onclick="showTab(${i})" id="btn-${i}">
      <span class="tab-num">${i + 1}</span>
      ${s.icono} ${s.titulo}
    </button>`).join('')}
  </nav>
  <main class="content">
    ${secciones.map((s, i) => `
    <div class="tab-panel ${i === 0 ? 'active' : ''}" id="panel-${i}">
      <div class="section-title">${s.icono} ${s.titulo}</div>
      <div class="section-sub">Sección ${i + 1} de ${secciones.length}</div>
      ${s.contenido}
    </div>`).join('')}
  </main>
</div>

<div class="footer">
  <p>© 2026 ${titulo} · Producto Premium · Todos los derechos reservados</p>
</div>

<script>
function showTab(i) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + i)?.classList.add('active');
  document.getElementById('btn-' + i)?.classList.add('active');
  document.getElementById('mbtn-' + i)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toggleAccordion(el) {
  el.parentElement.classList.toggle('open');
}
document.querySelectorAll('.prompt-box').forEach(box => {
  const btn = box.querySelector('.copy-btn');
  if (btn) btn.addEventListener('click', () => {
    navigator.clipboard.writeText(box.innerText.replace('Copiar','').trim());
    btn.textContent = '✅ Copiado';
    setTimeout(() => btn.textContent = 'Copiar', 2000);
  });
});

// ── TABLAS: scroll + botones imprimir/descargar ──────────────
function enhanceTables() {
  document.querySelectorAll('table').forEach((table, idx) => {
    if (table.closest('.table-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const actions = document.createElement('div');
    actions.className = 'table-actions';
    const btnPrint = document.createElement('button');
    btnPrint.className = 'tbl-btn';
    btnPrint.innerHTML = '🖨️ Imprimir tabla';
    btnPrint.onclick = () => printTable(table);
    const btnCSV = document.createElement('button');
    btnCSV.className = 'tbl-btn';
    btnCSV.innerHTML = '📥 Descargar CSV';
    btnCSV.onclick = () => downloadCSV(table, idx + 1);
    actions.appendChild(btnPrint);
    actions.appendChild(btnCSV);
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(actions);
    wrap.appendChild(table);
  });
}

function printTable(table) {
  const win = window.open('', '_blank');
  win.document.write('<html><head><style>' +
    'body{font-family:Inter,sans-serif;padding:24px;color:#111;max-width:900px;margin:0 auto}' +
    'table{border-collapse:collapse;width:100%}' +
    'th{background:#f0f0f0;font-weight:700;padding:10px 14px;text-align:left;border:1px solid #ccc}' +
    'td{padding:9px 14px;border:1px solid #ccc;vertical-align:top}' +
    'tr:nth-child(even){background:#fafafa}' +
    '</style></head><body>' + table.outerHTML + '</body></html>');
  win.document.close();
  win.focus();
  win.print();
}

function downloadCSV(table, idx) {
  const rows = Array.from(table.querySelectorAll('tr'));
  const csv = rows.map(row =>
    Array.from(row.querySelectorAll('th,td'))
      .map(cell => '"' + cell.innerText.replace(/"/g, '""').trim() + '"')
      .join(',')
  ).join('\\n');
  const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tabla-' + idx + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── SECCIONES: botón imprimir por sección ────────────────────
function addSectionPrintButtons() {
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const btn = document.createElement('button');
    btn.className = 'section-print-btn';
    btn.innerHTML = '🖨️ Imprimir sección';
    btn.onclick = () => printSection(panel);
    panel.insertBefore(btn, panel.firstChild);
  });
}

function printSection(panel) {
  const win = window.open('', '_blank');
  win.document.write('<html><head><style>' +
    'body{font-family:Inter,sans-serif;padding:24px;color:#111;max-width:800px;margin:0 auto}' +
    'h2,h3{color:#1a1a2e}.card{border:1px solid #ddd;padding:16px;margin:12px 0;border-radius:8px}' +
    '.highlight{background:#fff8e1;padding:12px;border-radius:6px;margin:8px 0}' +
    '.tip{background:#e8f5e9;padding:12px;border-radius:6px;margin:8px 0}' +
    'table{border-collapse:collapse;width:100%}' +
    'th{background:#f0f0f0;font-weight:700;padding:10px 14px;text-align:left;border:1px solid #ccc}' +
    'td{padding:9px 14px;border:1px solid #ccc;vertical-align:top}' +
    '.accordion-body{display:block!important}' +
    '.section-print-btn,.tbl-btn,.copy-btn{display:none}' +
    '</style></head><body>' + panel.innerHTML + '</body></html>');
  win.document.close();
  win.focus();
  win.print();
}

document.addEventListener('DOMContentLoaded', () => {
  enhanceTables();
  addSectionPrintButtons();
});
</script>
</body>
</html>`;
}

// ── Generador principal ──────────────────────────────────────
export async function generarProducto(nicho) {
  console.log(`[Generator] Creando producto tipo "${nicho.tipo}": "${nicho.nombre_producto}"...`);

  let html = '';

  if (nicho.tipo === 'prompts') html = await generarPackPrompts(nicho);
  else if (nicho.tipo === 'plantilla') html = await generarPlantilla(nicho);
  else if (nicho.tipo === 'guia_pdf') html = await generarGuiaPDF(nicho);
  else if (nicho.tipo === 'mini_curso') html = await generarMiniCurso(nicho);
  else if (nicho.tipo === 'toolkit') html = await generarToolkit(nicho);
  else html = await generarGuiaPDF(nicho);

  await db.log('generator', 'producto_generado', { nicho: nicho.nicho, tipo: nicho.tipo, chars: html.length });
  console.log(`[Generator] Producto creado — ${html.length} caracteres`);
  return html;
}

// ── Sanea el HTML de una sección: balancea <div> y elimina bloques peligrosos ──
// Sin esto, un </div> de más en el contenido de Claude cierra el panel wrapper
// y el resto de la sección queda fuera del contenedor (aparece "vacío").
// También: un <script>...</script> incompleto (solo eliminando </script>) deja un
// <script> abierto que consume todo el HTML restante y rompe los tabs.
function sanearHTML(html) {
  // Eliminar bloques <script>...</script> completos primero
  let resultado = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Eliminar tags <script> o </script> sueltos que hayan quedado
  resultado = resultado.replace(/<\/?script[^>]*>/gi, '');
  // Eliminar bloques <style>...</style> que Claude inyecte (rompen el CSS del shell)
  resultado = resultado.replace(/<style[\s\S]*?<\/style>/gi, '');
  resultado = resultado.replace(/<\/?style[^>]*>/gi, '');

  // Contar divs abiertos y cerrados para balancear
  const abiertos = (resultado.match(/<div[\s>]/gi) || []).length;
  const cerrados = (resultado.match(/<\/div>/gi) || []).length;
  const diferencia = abiertos - cerrados;

  if (diferencia > 0) {
    // Faltan cierres — agregar los que faltan al final
    resultado += '</div>'.repeat(diferencia);
    console.log(`[Generator] HTML saneado: +${diferencia} </div> agregados`);
  } else if (diferencia < 0) {
    // Sobran cierres — eliminar los últimos sobrantes
    const sobrantes = Math.abs(diferencia);
    for (let i = 0; i < sobrantes; i++) {
      const idx = resultado.lastIndexOf('</div>');
      if (idx !== -1) resultado = resultado.slice(0, idx) + resultado.slice(idx + 6);
    }
    console.log(`[Generator] HTML saneado: -${sobrantes} </div> removidos`);
  }

  return resultado;
}

// ── Helper: genera una sección con Claude — nunca cancela todo ─
async function generarSeccion(prompt, agente = 'generator', etiqueta = '') {
  // Intento 1 — full quality, hasta 8 continuaciones
  try {
    const resultado = await preguntarCompleto(prompt, SYSTEM, agente, 6000, 8, null, MODEL_SONNET);
    const limpio = resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    if (limpio.length > 200) return sanearHTML(limpio);
    throw new Error('Respuesta demasiado corta');
  } catch (err) {
    console.warn(`[Generator] Sección "${etiqueta}" falló en intento 1: ${err.message} — reintentando versión compacta...`);
    await enviar(`⚠️ Sección "${etiqueta || 'actual'}" requirió reintento — continuando...`).catch(() => {});
    await delay(8000);
  }

  // Intento 2 — versión compacta (menos tokens, más fácil de completar)
  try {
    const promptCompacto = prompt + `\n\nIMPORTANTE: Versión compacta. Máximo 500 palabras. Directo al punto, sin introducciones. Completa la sección en una sola respuesta.`;
    const resultado = await preguntarCompleto(promptCompacto, SYSTEM, agente, 4000, 4, null, MODEL_SONNET);
    const limpio = resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    if (limpio.length > 100) return sanearHTML(limpio);
    throw new Error('Respuesta demasiado corta en intento compacto');
  } catch (err) {
    console.error(`[Generator] Sección "${etiqueta}" falló en intento 2: ${err.message}`);
    throw err; // propagar para que el llamador sepa que falló
  }
}

// ── Extrae texto plano de HTML para pasar como contexto ──────
function resumirParaContexto(titulo, html) {
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  return `[${titulo}]: ${texto}...`;
}

// ── Construye el bloque de contexto — solo las últimas 2 secciones ──
// (evita acumular tokens innecesarios en prompts tardíos)
function bloqueContexto(historial) {
  if (!historial.length) return '';
  const reciente = historial.slice(-2);
  return `\nCONTEXTO RECIENTE (últimas ${reciente.length} secciones — mantén coherencia, no repitas, construye sobre esto):\n${reciente.join('\n')}\n`;
}

// ── Bloque de especificidad del nicho para cada prompt ────────
function bloqueNicho(nicho) {
  const herramientas = nicho.herramientas_clave?.join(', ') || 'herramientas del sector';
  return `
CONTEXTO DEL CLIENTE — LEE ESTO ANTES DE ESCRIBIR UNA SOLA LÍNEA:
- Producto: ${nicho.nombre_producto}
- Nicho exacto: ${nicho.nicho}
- Subgrupo latino: ${nicho.subgrupo_latino || nicho.cliente_ideal}
- Cliente ideal (úsalo como personaje real en ejemplos): ${nicho.cliente_ideal}
- Su dolor exacto en sus palabras: ${nicho.problema_que_resuelve}
- Herramientas reales del sector: ${herramientas}
- Quick win prometido al cliente: ${nicho.quick_win || ''}
- Historia de éxito de referencia (menciónala o usa una similar): ${nicho.ejemplo_exito || ''}

REGLAS DE ESPECIFICIDAD — OBLIGATORIAS:
1. Usa el nombre/perfil del cliente ideal en los ejemplos — no digas "el usuario", di "Jorge" o "María"
2. Menciona ciudades y estados reales donde vive ese subgrupo latino
3. Usa los precios, tiempos y porcentajes exactos — no digas "varios dólares", di "$47/mes"
4. Cada sección debe tener mínimo 1 ejemplo con nombre latino + ciudad + resultado con número
5. Menciona métodos de pago que usa ese subgrupo: Zelle, Venmo, efectivo, MetroPCS, etc.
`;
}

// ── Pack de 30 Prompts ───────────────────────────────────────
async function generarPackPrompts(nicho) {
  console.log('[Generator] Generando prompts por bloques...');

  const FORMATO_PROMPT = `
<div class="card">
  <h3>Prompt #N: [Nombre descriptivo del caso de uso]</h3>
  <p><strong>Para qué sirve:</strong> [1 línea muy concreta del resultado]</p>
  <p><strong>Cuándo usarlo:</strong> [situación específica]</p>
  <div class="prompt-box"><button class="copy-btn">Copiar</button>[PROMPT COMPLETO y detallado, mínimo 5 líneas, con variables en MAYÚSCULAS como NOMBRE_NEGOCIO, PRODUCTO, PRECIO_OBJETIVO]</div>
  <div class="tip">💡 Tip pro: [Consejo para sacar el máximo de este prompt en ${nicho.nicho}]</div>
  <p><strong>Ejemplo de resultado:</strong> [Muestra un output real de este prompt]</p>
</div>`;

  const intro = await generarSeccion(`
${bloqueNicho(nicho)}
Escribe la sección de bienvenida y guía de uso para el pack de prompts "${nicho.nombre_producto}".

- Quick Win: el primer prompt que deben usar HOY y el resultado que obtendrán en 10 minutos
  <div class="highlight"> con ese primer prompt listo para copiar directamente </div>
- Cómo usar el pack: dónde pegar los prompts (ChatGPT: chat.openai.com, Claude: claude.ai), cómo personalizar variables en MAYÚSCULAS, cómo encadenar prompts
- Los 3 errores más comunes al usar prompts de IA para ${nicho.nicho} y cómo evitarlos
- <div class="tip"> con el modelo de IA recomendado para cada tipo de prompt del pack
Formato: <div class="card"> con highlight y tips. Sin <html> ni <body>.`);
  await delay(DELAY_SECCIONES);

  const prompts1 = await generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #1 al #10 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Estos primeros 10 prompts cubren: iniciar, investigar, planificar y configurar las bases de ${nicho.nicho}.
Cada prompt DEBE ser largo y detallado (mínimo 5-8 líneas el prompt en sí), ultra-específico para el nicho.
Usa EXACTAMENTE este formato para cada uno:
${FORMATO_PROMPT}
Sin <html> ni <body>. Los 10 divs completos.`);
  await delay(DELAY_SECCIONES);

  const prompts2 = await generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #11 al #20 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Estos 10 prompts cubren: ejecutar, optimizar, crear contenido y generar resultados en ${nicho.nicho}.
Cada prompt DEBE ser diferente a los anteriores — cubre casos de uso distintos.
Mismo formato:
${FORMATO_PROMPT}
Sin <html> ni <body>. Los 10 divs completos.`);
  await delay(DELAY_SECCIONES);

  const prompts3 = await generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #21 al #30 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Estos 10 prompts son los más avanzados: escalar, automatizar, analizar y multiplicar resultados.
Son prompts que los expertos del sector usan — no los principiantes.
Mismo formato:
${FORMATO_PROMPT}
Sin <html> ni <body>. Los 10 divs completos.`);
  await delay(DELAY_SECCIONES);

  const bonus = await generarSeccion(`
${bloqueNicho(nicho)}
Crea la sección Bonus: "3 Flujos de Trabajo con IA para ${nicho.nicho}".

Para cada flujo de trabajo:
- Nombre del flujo (ej: "Flujo para conseguir tu primer cliente en 48h")
- Qué logras con este flujo y en cuánto tiempo
- Secuencia de prompts a usar (ej: Prompt #3 → #7 → #15 → #22) con por qué en ese orden
- Ejemplo real de resultado usando este flujo
- Tiempo total estimado

Termina con: tabla de referencia rápida — los 30 prompts con nombre y caso de uso en 2 líneas.
Formato HTML con <div class="card"> y tabla. Sin <html> ni <body>.`);

  const secciones = [
    { icono: '📖', titulo: 'Cómo usar este pack', contenido: intro },
    { icono: '⚡', titulo: 'Prompts #1 — #10', contenido: prompts1 },
    { icono: '⚡', titulo: 'Prompts #11 — #20', contenido: prompts2 },
    { icono: '⚡', titulo: 'Prompts #21 — #30', contenido: prompts3 },
    { icono: '🎁', titulo: 'Bonus: Combinar Prompts', contenido: bonus },
  ];

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'prompts', secciones);
}

// ── Guía PDF ─────────────────────────────────────────────────
async function generarGuiaPDF(nicho) {
  console.log('[Generator] Generando guía por capítulos...');
  const ctx = []; // historial de contexto acumulado
  const temas = nicho.modulos_temas?.length >= 4 ? nicho.modulos_temas : null;

  await enviar('📝 Generando sección 1/7 — Quick Win...').catch(() => {});

  // ── QUICK WIN — primera sección, resultado en 30 min ────────
  const quickWin = await generarSeccion(`
${bloqueNicho(nicho)}
Escribe la sección "Tu Primer Resultado en 30 Minutos" para la guía "${nicho.nombre_producto}".
Quick win prometido: ${nicho.quick_win || 'resultado inmediato y concreto'}

Esta sección debe:
- Dar instrucciones paso a paso para que el lector logre UN resultado concreto ahora mismo
- Pasos numerados con acciones exactas (herramientas reales, clicks específicos, textos de ejemplo)
- Al final el lector tiene algo: una lista, un archivo, una cuenta configurada, un primer ingreso, etc.
- Tono: emocionante, "ya lo lograste, ahora vamos al resto"
- Incluye <div class="highlight"> con el resultado que van a lograr
- Termina con <div class="tip">✅ Logro desbloqueado: [lo que acaban de conseguir]</div>
Formato: <div class="card"> con pasos y highlight. Sin <html> ni <body>.`, 'generator', 'Quick Win');
  ctx.push(resumirParaContexto('Quick Win', quickWin));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 2/7 — Introducción...').catch(() => {});

  // ── INTRODUCCIÓN ─────────────────────────────────────────────
  const intro = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe la introducción profunda de la guía "${nicho.nombre_producto}".
- Párrafo 1: Conecta con el dolor real del cliente (${nicho.problema_que_resuelve}) con una historia o situación reconocible
- Párrafo 2: Por qué la mayoría falla en ${nicho.nicho} (error más común, específico)
- Párrafo 3: Qué van a tener cuando terminen esta guía (resultados concretos con números)
- Incluye <div class="highlight"> con la promesa principal de la guía
- Entre 400-500 palabras. Sin frases de relleno. Directo y poderoso.
Formato: <div class="card"><p>...</p></div>. Sin <html> ni <body>.`, 'generator', 'Introducción');
  ctx.push(resumirParaContexto('Introducción', intro));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 3/7 — Capítulo 1...').catch(() => {});

  // ── CAP 1 ────────────────────────────────────────────────────
  const tema1 = temas?.[0] || `Fundamentos de ${nicho.nicho}`;
  const cap1 = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Capítulo 1: "${tema1}" para la guía "${nicho.nombre_producto}".
- Explica los conceptos base con ejemplos MUY específicos del nicho (no teoría genérica)
- Incluye al menos 3 conceptos clave con definición + ejemplo real + por qué importa
- Agrega <div class="highlight"> con el concepto más importante de este capítulo
- Lista ordenada de los pasos iniciales que necesita hacer el lector
- Incluye un <div class="tip"> con el error más común en esta etapa y cómo evitarlo
- Ejercicio al final: algo concreto que el lector hace en los próximos 15 minutos
- Entre 400-600 palabras. Herramientas reales con nombres y precios.
Formato: <div class="card"> y elementos HTML. Sin <html> ni <body>.`, 'generator', tema1);
  ctx.push(resumirParaContexto(tema1, cap1));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 4/7 — Capítulo 2...').catch(() => {});

  // ── CAP 2 ────────────────────────────────────────────────────
  const tema2 = temas?.[1] || `El Método Paso a Paso`;
  const cap2 = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Capítulo 2: "${tema2}" para la guía "${nicho.nombre_producto}".
- El método principal, paso a paso, con instrucciones exactas (no "configura tu cuenta" sino "ve a Ajustes > Cuenta > Plan > selecciona Business")
- Cada paso con: qué hacer, cómo hacerlo exactamente, cuánto tarda, qué resultado esperar
- Al menos 6 pasos detallados
- Incluye <div class="tip"> con el atajo o truco que los expertos usan y los principiantes no conocen
- Ejemplo real de alguien del mercado hispano aplicando este método con resultados numéricos
- Ejercicio práctico al final que aplica todo el capítulo
- Entre 400-600 palabras. Específico, accionable, con números reales.
Formato: <div class="card"> y elementos HTML. Sin <html> ni <body>.`, 'generator', tema2);
  ctx.push(resumirParaContexto(tema2, cap2));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 5/7 — Casos Reales...').catch(() => {});

  // ── CAP 3 — CASOS REALES ──────────────────────────────────────
  const tema3 = temas?.[2] || 'Casos Reales del Mercado Hispano';
  const cap3 = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Capítulo 3: "${tema3}" — 3 casos reales de personas hispanohablantes.
Ejemplo de éxito de referencia: ${nicho.ejemplo_exito || 'persona del mercado hispano con resultados reales'}

Para cada caso incluye:
- Nombre y ciudad hispana real (ej: Sofía Ramírez, Medellín / Diego Torres, Miami)
- Situación inicial: qué problema tenía, cuánto tiempo llevaba intentándolo, qué había probado antes
- Qué hizo exactamente: pasos específicos, herramientas usadas, tiempo invertido
- Resultado con números: ingresos, tiempo, porcentajes, clientes conseguidos, etc.
- Lección transferible: qué puede copiar el lector de este caso HOY
- Cada caso entre 150-200 palabras
Formato: <div class="card"> separado por cada caso, con <div class="highlight"> para el resultado. Sin <html> ni <body>.`, 'generator', tema3);
  ctx.push(resumirParaContexto('Casos Reales', cap3));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 6/7 — Herramientas...').catch(() => {});

  // ── HERRAMIENTAS Y ERRORES ────────────────────────────────────
  const tema4 = temas?.[3] || 'Herramientas y Errores Críticos';
  const recursos = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe la sección "${tema4}" para la guía "${nicho.nombre_producto}".

PARTE 1 — Stack de Herramientas:
Tabla HTML completa con al menos 10 herramientas REALES del sector:
- Columnas: Herramienta | Para qué sirve exactamente | Precio real | Nivel (principiante/avanzado) | Link/dónde conseguirla
- Herramientas del nicho: ${nicho.herramientas_clave?.join(', ') || 'las del sector'}
- Para cada herramienta: tip de uso específico en este nicho

PARTE 2 — Los 7 Errores que Cuestan Dinero:
Lista de los 7 errores más comunes en ${nicho.nicho}:
- Error específico + por qué pasa + cómo evitarlo
Formato: <table> para herramientas + <div class="card"><ol> para errores. Sin <html> ni <body>.`, 'generator', tema4);
  ctx.push(resumirParaContexto('Herramientas y Errores', recursos));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 7/7 — Plan de Acción...').catch(() => {});

  // ── PLAN 7 DÍAS ───────────────────────────────────────────────
  const plan = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Plan de Acción de 7 Días para "${nicho.nombre_producto}".
Este plan lleva al lector de cero al primer resultado concreto en 7 días.

Para cada día:
- Título del día con objetivo claro
- Tiempo estimado (ej: "45 minutos")
- Lista de tareas específicas con herramientas exactas
- Resultado concreto al final de ese día (qué tiene el lector que no tenía antes)
- Un <div class="tip"> con el truco para completar ese día más rápido

Día 1 debe conectar con el Quick Win ya logrado.
Día 7 debe entregar el resultado principal prometido en la guía.
Usa acordeón HTML:
<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)">📅 Día N: [Título] — [tiempo] <span class="arrow">▼</span></div><div class="accordion-body"><p>...</p></div></div>
Sin <html> ni <body>.`, 'generator', 'Plan 7 Días');

  const secciones = [
    { icono: '⚡', titulo: 'Resultado en 30 Min', contenido: quickWin },
    { icono: '🎯', titulo: 'Introducción', contenido: intro },
    { icono: '📚', titulo: temas?.[0] || 'Fundamentos', contenido: cap1 },
    { icono: '🔧', titulo: temas?.[1] || 'El Método', contenido: cap2 },
    { icono: '💡', titulo: 'Casos Reales', contenido: cap3 },
    { icono: '🛠️', titulo: 'Herramientas y Errores', contenido: recursos },
    { icono: '📅', titulo: 'Plan 7 Días', contenido: plan },
  ];

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'guia_pdf', secciones);
}

// ── Plantilla ────────────────────────────────────────────────
async function generarPlantilla(nicho) {
  console.log('[Generator] Generando plantilla por secciones...');

  await enviar('📝 Generando sección 1/4 — Cómo usar...').catch(() => {});
  const instrucciones = await generarSeccion(`
${bloqueNicho(nicho)}
Escribe la guía de inicio rápido para la plantilla "${nicho.nombre_producto}".

- Quick Win: lo primero que el cliente hace con la plantilla y el resultado en 20 minutos
  <div class="highlight"> con ese resultado inmediato </div>
- Cómo duplicar esta plantilla a Google Sheets (enlace: sheets.google.com > Archivo > Hacer una copia), Notion y Excel — instrucciones exactas con clicks
- Mapa de la plantilla: qué hace cada sección, en qué orden usarla
- Tiempo estimado de setup completo y cuándo verán el primer resultado
- Los 3 casos de uso más comunes en ${nicho.nicho} para esta plantilla
Formato: <div class="card"> con highlight. Sin <html> ni <body>.`);
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 2/4 — La Plantilla Principal...').catch(() => {});
  const plantilla = await generarSeccion(`
${bloqueNicho(nicho)}
Crea la plantilla PRINCIPAL COMPLETA para "${nicho.nombre_producto}".
Esta es la pieza central del producto — debe ser densa, práctica y lista para usar.

La plantilla debe incluir:
- Todas las secciones que un profesional de ${nicho.nicho} usa diariamente
- Tablas HTML con columnas bien definidas y al menos 5 filas de ejemplo con datos reales
- Fórmulas o cálculos explicados donde aplique (ej: "Multiplica columna B × C para obtener margen")
- Secciones con pestañas lógicas (una tabla por sección)
- Código de colores explicado (verde = bueno, amarillo = atención, rojo = acción)
Formato: múltiples <div class="card"><table>...</table></div>. Sin <html> ni <body>.`);
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 3/4 — Ejemplo Llenado...').catch(() => {});
  const ejemplo = await generarSeccion(`
${bloqueNicho(nicho)}
Crea el ejemplo COMPLETAMENTE LLENADO de la plantilla para "${nicho.nombre_producto}".
Usa datos de: Ana García, 32 años, de Ciudad de México, lleva 2 meses en ${nicho.nicho}.

- La plantilla principal 100% llenada con datos realistas de Ana
- Números reales (no "X" ni "N/A") — ingresos, tiempos, clientes, porcentajes
- Nota al margen de cada sección explicando por qué Ana tomó esas decisiones
- Comparación "Antes de usar la plantilla vs. Después" con números
- <div class="highlight"> con el resultado que Ana logró en el primer mes
Formato: <div class="card"> con tablas llenadas. Sin <html> ni <body>.`);
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 4/4 — Tips y Errores...').catch(() => {});
  const tips = await generarSeccion(`
${bloqueNicho(nicho)}
Crea la sección de Tips Avanzados y Errores para "${nicho.nombre_producto}".

PARTE 1 — 8 Tips de Experto (que no son obvios):
Cada tip: nombre del tip + por qué funciona en ${nicho.nicho} + cómo implementarlo en la plantilla + resultado que da
Herramientas específicas recomendadas para potenciar la plantilla: ${nicho.herramientas_clave?.slice(0, 3).join(', ')}

PARTE 2 — Los 7 Errores que Destruyen Resultados:
Cada error: descripción específica + por qué pasa + costo real (tiempo o dinero) + solución paso a paso
Formato: <div class="card"><ul> para tips + <div class="card"><ol> para errores. Sin <html> ni <body>.`);

  const secciones = [
    { icono: '📖', titulo: 'Cómo usar', contenido: instrucciones },
    { icono: '📋', titulo: 'La Plantilla', contenido: plantilla },
    { icono: '✅', titulo: 'Ejemplo Llenado', contenido: ejemplo },
    { icono: '💡', titulo: 'Tips y Errores', contenido: tips },
  ];

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'plantilla', secciones);
}

// ── Mini Curso ───────────────────────────────────────────────
async function generarMiniCurso(nicho) {
  console.log('[Generator] Generando mini curso módulo por módulo...');
  const ctx = [];
  await enviar('📝 Generando sección 1/7 — Bienvenida + Quick Win...').catch(() => {});

  // Temas específicos del nicho (del researcher) o genéricos como fallback
  const temas = nicho.modulos_temas?.length >= 5
    ? nicho.modulos_temas.slice(0, 5)
    : [
        `Bases esenciales de ${nicho.nicho}`,
        `El método comprobado paso a paso`,
        `Herramientas y configuración inicial`,
        `Casos reales y cómo replicarlos`,
        `Escala, automatiza y multiplica resultados`
      ];

  // ── BIENVENIDA + QUICK WIN ────────────────────────────────────
  const bienvenida = await generarSeccion(`
${bloqueNicho(nicho)}
Escribe la sección de Bienvenida + Tu Primer Resultado para el curso "${nicho.nombre_producto}".

PARTE 1 — Bienvenida (tono personal, motivador):
- Preséntate como el curso, qué van a lograr al terminarlo (con números: ingresos, tiempo, resultado)
- Mapa del curso: los 5 módulos con una línea de qué aprenden en cada uno
- Cómo aprovechar el curso al máximo (consejo práctico, no genérico)
- <div class="highlight"> con el resultado principal prometido

PARTE 2 — Quick Win (resultado en los próximos 30 minutos):
Quick win: ${nicho.quick_win || 'primer resultado concreto e inmediato'}
- Pasos exactos para lograrlo ahora mismo (herramientas reales, acciones específicas)
- Al completarlo: <div class="tip">✅ ¡Ya tienes tu primer resultado! Ahora vamos al Módulo 1.</div>
Formato: <div class="card"> con highlight y tip. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Bienvenida y Quick Win', bienvenida));
  await delay(DELAY_SECCIONES);

  // ── MÓDULOS 1-5 ───────────────────────────────────────────────
  const modulos = [];
  for (let i = 0; i < 5; i++) {
    const n = i + 1;
    console.log(`[Generator] Generando módulo ${n}/5: "${temas[i]}"...`);
    await enviar(`📝 Generando sección ${n + 1}/7 — Módulo ${n}...`).catch(() => {});
    const contenido = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Módulo ${n} del curso "${nicho.nombre_producto}".
Tema: "${temas[i]}"

ESTRUCTURA OBLIGATORIA:
- <div class="highlight"> con el objetivo del módulo en 1 oración poderosa

- Lección ${n}.1: [título específico del tema] — mínimo 400 palabras
  * Contenido denso y específico, con ejemplos reales del nicho
  * Herramientas reales nombradas con precios
  * Pasos con acciones exactas
  * Un <div class="tip"> con el truco que los expertos usan

- Lección ${n}.2: [título específico complementario] — mínimo 400 palabras
  * Profundiza en el tema, construye sobre lección ${n}.1
  * Ejemplo real de persona hispana con resultado numérico
  * Errores comunes en esta etapa y cómo evitarlos

- Tarea del Módulo ${n}: ejercicio concreto que el alumno hace HOY (30-60 min máx)
  <div class="tip">✅ Tarea M${n}: [acción específica con resultado esperado]</div>

Usa acordeón para las lecciones:
<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)">📝 Lección ${n}.1: [Título] <span class="arrow">▼</span></div><div class="accordion-body"><p>contenido...</p></div></div>
Sin <html> ni <body>.`);
    modulos.push(contenido);
    ctx.push(resumirParaContexto(`Módulo ${n}: ${temas[i]}`, contenido));
    if (i < 4) await delay(DELAY_SECCIONES);
  }
  await delay(DELAY_SECCIONES);

  // ── EXAMEN + CERTIFICADO ──────────────────────────────────────
  await enviar('📝 Generando sección 7/7 — Examen + Certificado...').catch(() => {});
  const examen = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Crea el Examen Final y Certificado para el curso "${nicho.nombre_producto}".

PARTE 1 — Examen (10 preguntas, no 5):
- 10 preguntas de opción múltiple basadas en el contenido ESPECÍFICO del curso
- 4 opciones por pregunta, respuesta correcta marcada con ✅
- Preguntas que prueban conocimiento aplicado, no memorización
- Al final: "Si respondiste 8+ correctas, eres oficialmente un experto en ${nicho.nicho}"

PARTE 2 — Certificado de Completación:
- Diseño elegante con borde verde (#00ff88), fondo oscuro
- "Certificado de Completación — ${nicho.nombre_producto}"
- Texto: "Este certificado acredita que [NOMBRE] ha completado exitosamente el programa..."
- Campo para nombre, fecha, y los 5 temas dominados
- Botón para compartir en LinkedIn (solo el texto del botón)
Formato HTML con <div class="card"> y estilos inline para el certificado. Sin <html> ni <body>.`);

  const secciones = [
    { icono: '👋', titulo: 'Bienvenida + Quick Win', contenido: bienvenida },
    { icono: '1️⃣', titulo: `M1: ${temas[0].split('—')[0].trim()}`, contenido: modulos[0] },
    { icono: '2️⃣', titulo: `M2: ${temas[1].split('—')[0].trim()}`, contenido: modulos[1] },
    { icono: '3️⃣', titulo: `M3: ${temas[2].split('—')[0].trim()}`, contenido: modulos[2] },
    { icono: '4️⃣', titulo: `M4: ${temas[3].split('—')[0].trim()}`, contenido: modulos[3] },
    { icono: '5️⃣', titulo: `M5: ${temas[4].split('—')[0].trim()}`, contenido: modulos[4] },
    { icono: '🎓', titulo: 'Examen + Certificado', contenido: examen },
  ];

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'mini_curso', secciones);
}

// ── Toolkit ──────────────────────────────────────────────────
async function generarToolkit(nicho) {
  console.log('[Generator] Generando toolkit por secciones...');
  const ctx = [];

  await enviar('📝 Generando sección 1/5 — Checklist Maestro...').catch(() => {});
  const intro = await generarSeccion(`
${bloqueNicho(nicho)}
Escribe la introducción y Checklist Maestro para el toolkit "${nicho.nombre_producto}".

- Quick Win: la primera acción del checklist que da un resultado inmediato (marcar como ✅ en 20 minutos)
  <div class="highlight"> con esa primera victoria </div>
- Cómo usar el toolkit: en qué orden, cuánto tarda implementarlo completo, cómo adaptarlo a tu situación
- Checklist Maestro de 50 ítems ESPECÍFICOS organizados por fases (no genéricos):
  Fase 1 — Configuración inicial (ítems 1-12)
  Fase 2 — Primeros resultados (ítems 13-25)
  Fase 3 — Optimización (ítems 26-38)
  Fase 4 — Escala (ítems 39-50)
  Cada ítem: acción concreta en ${nicho.nicho}, no vaga
  <ul class="checklist"><li>Acción específica: [herramienta real] + [resultado esperado]</li>...</ul>
Formato: <div class="card"> con highlight y checklist. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Checklist Maestro', intro));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 2/5 — Plantillas listas...').catch(() => {});
  const plantillas = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Crea 3 plantillas COMPLETAMENTE LLENADAS y listas para usar en "${nicho.nicho}".
Cada plantilla debe ser práctica, no un ejemplo vacío.

Plantilla 1: La más usada en el día a día de ${nicho.nicho} — tabla con todas las columnas llenadas con datos reales de ejemplo
Plantilla 2: Para tracking o seguimiento de resultados — con fórmulas/valores de referencia explicados
Plantilla 3: Para comunicación o ventas en ${nicho.nicho} — ejemplo completo llenado

Para cada plantilla:
- Nombre y para qué se usa exactamente
- Cómo copiarla a Google Sheets/Notion/Excel (instrucción de 1 clic)
- La plantilla en tabla HTML con datos REALES de ejemplo
- Tip de personalización
Formato: <div class="card"> por cada plantilla. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Plantillas', plantillas));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 3/5 — Stack de Herramientas...').catch(() => {});
  const herramientas = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Crea el Stack Completo de Herramientas para "${nicho.nombre_producto}".
Herramientas base del nicho: ${nicho.herramientas_clave?.join(', ') || 'las esenciales del sector'}

Tabla con mínimo 18 herramientas REALES, agrupadas por categoría:
Columnas: Herramienta | Qué hace exactamente en ${nicho.nicho} | Precio real | ¿Vale la pena? | Alternativa gratis
Para cada herramienta: un tip de uso específico para ${nicho.nicho}
Incluye también: combinaciones de herramientas que funcionan juntas (stack recomendado para principiante vs. avanzado)
Formato: <div class="card"><table>...</table></div> con tips al pie. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Herramientas', herramientas));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 4/5 — Métricas y Alertas...').catch(() => {});
  const metricas = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Crea la sección de Métricas y Señales de Alerta para "${nicho.nombre_producto}".

PARTE 1 — Dashboard de Métricas Clave:
Tabla con las 12 métricas más importantes en ${nicho.nicho}:
Columnas: Métrica | Valor bueno | Valor preocupante | Valor crítico | Cómo medirla (herramienta + dónde)

PARTE 2 — Las 10 Señales de Alerta que cuestan dinero:
Para cada señal: qué es, por qué pasa, qué impacto tiene en $ o tiempo, acción inmediata a tomar (paso a paso)
Formato: tablas HTML y <div class="card">. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Métricas', metricas));
  await delay(DELAY_SECCIONES);

  await enviar('📝 Generando sección 5/5 — Plan 30 Días...').catch(() => {});
  const calendario = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Crea el Plan de Implementación de 30 Días para "${nicho.nombre_producto}".
Al final de estos 30 días, el cliente debe tener: ${nicho.quick_win || 'su primer resultado real y medible'}.

Semana 1 — Configuración y primer resultado (días 1-7): enfocarse en la base
Semana 2 — Primeros clientes/ventas/resultados (días 8-14): generar el primer ingreso o resultado
Semana 3 — Optimización (días 15-21): mejorar lo que funciona, eliminar lo que no
Semana 4 — Escala (días 22-30): multiplicar los resultados

Para cada semana: objetivo claro + acciones diarias específicas + herramientas a usar + resultado esperado al fin de semana.
Usa acordeón:
<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)">📅 Semana N: [Objetivo] — Resultado esperado: [resultado concreto] <span class="arrow">▼</span></div><div class="accordion-body">acciones día a día con herramientas...</div></div>
Sin <html> ni <body>.`);

  const secciones = [
    { icono: '✅', titulo: 'Checklist Maestro', contenido: intro },
    { icono: '📋', titulo: 'Plantillas', contenido: plantillas },
    { icono: '🔧', titulo: 'Herramientas', contenido: herramientas },
    { icono: '📊', titulo: 'Métricas y Alertas', contenido: metricas },
    { icono: '📅', titulo: 'Calendario 30 días', contenido: calendario },
  ];

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'toolkit', secciones);
}
