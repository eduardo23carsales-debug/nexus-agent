// ════════════════════════════════════
// NEXUS AGENT — agents/digital/generator.js
// Genera productos como HTML con tabs/acordeón
// Cada sección se genera por separado para evitar truncado
// ════════════════════════════════════

import { preguntar } from '../../core/claude.js';
import { db } from '../../core/database.js';

const SYSTEM = `Eres un experto creador de productos digitales premium para el mercado hispano.
Creas contenido de alta calidad, práctico y accionable. Devuelves SOLO el contenido solicitado,
sin introducciones ni comentarios extra. Contenido real, específico, sin relleno.`;

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
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f0f0f; color: #e0e0e0; }
.header { background: linear-gradient(135deg,#1a1a2e,#16213e); padding: 48px 20px; text-align: center; border-bottom: 3px solid #00ff88; }
.badge { display: inline-block; background: #00ff88; color: #000; padding: 6px 18px; border-radius: 20px; font-size: 0.8em; font-weight: bold; margin-bottom: 16px; letter-spacing: 1px; }
.header h1 { color: #fff; font-size: clamp(1.4em, 4vw, 2.2em); margin-bottom: 12px; line-height: 1.3; }
.header p { color: #aaa; font-size: 1em; max-width: 600px; margin: 0 auto; }
.layout { display: flex; min-height: calc(100vh - 200px); }
.sidebar { width: 240px; flex-shrink: 0; background: #111; border-right: 1px solid #222; padding: 20px 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.tab-btn { display: block; width: 100%; text-align: left; background: none; border: none; color: #aaa; padding: 14px 20px; cursor: pointer; font-size: 0.9em; transition: all 0.2s; border-left: 3px solid transparent; line-height: 1.4; }
.tab-btn:hover { background: #1a1a1a; color: #fff; }
.tab-btn.active { background: #1a2a1a; color: #00ff88; border-left-color: #00ff88; font-weight: 600; }
.content { flex: 1; padding: 40px; max-width: 800px; overflow-y: auto; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
.card { background: #1a1a1a; border-radius: 10px; padding: 24px; margin-bottom: 20px; border-left: 4px solid #00ff88; }
.card h3 { color: #fff; margin-bottom: 12px; font-size: 1.05em; }
.card p, .card li { color: #ccc; line-height: 1.8; }
.card ul, .card ol { padding-left: 20px; }
.card li { margin-bottom: 6px; }
.prompt-box { background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 20px; margin: 12px 0; font-family: monospace; font-size: 0.88em; color: #00ff88; white-space: pre-wrap; line-height: 1.7; position: relative; }
.copy-btn { position: absolute; top: 10px; right: 10px; background: #00ff88; color: #000; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8em; font-weight: bold; }
.highlight { background: #0d2818; border: 1px solid #00ff88; border-radius: 8px; padding: 16px; margin: 12px 0; color: #00ff88; font-weight: 600; }
.tip { background: #1a1500; border: 1px solid #ffcc00; border-radius: 8px; padding: 14px; margin: 12px 0; color: #ffcc00; font-size: 0.9em; }
.checklist li { list-style: none; padding: 10px 0; border-bottom: 1px solid #1a1a1a; color: #ccc; }
.checklist li::before { content: "☐ "; color: #00ff88; font-size: 1.1em; }
.accordion-item { background: #1a1a1a; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
.accordion-header { padding: 16px 20px; cursor: pointer; color: #fff; display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
.accordion-header:hover { background: #222; }
.accordion-body { padding: 0 20px 20px; color: #ccc; line-height: 1.8; display: none; }
.accordion-body p { margin-bottom: 12px; }
.accordion-body ul { padding-left: 20px; }
.arrow { transition: transform 0.2s; color: #00ff88; }
.open .arrow { transform: rotate(180deg); }
.open .accordion-body { display: block; }
.mobile-menu { display: none; background: #111; padding: 12px 20px; border-bottom: 1px solid #222; }
.mobile-select { width: 100%; background: #1a1a1a; color: #fff; border: 1px solid #333; padding: 10px; border-radius: 6px; font-size: 0.95em; }
.footer { background: #111; padding: 24px; text-align: center; border-top: 1px solid #1a1a1a; }
.footer p { color: #444; font-size: 0.82em; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th { background: #1a2a1a; color: #00ff88; padding: 10px 12px; text-align: left; font-size: 0.9em; }
td { padding: 10px 12px; border-bottom: 1px solid #1a1a1a; color: #ccc; font-size: 0.9em; }
@media (max-width: 640px) {
  .sidebar { display: none; }
  .mobile-menu { display: block; }
  .layout { flex-direction: column; }
  .content { padding: 24px 16px; }
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
  <select class="mobile-select" onchange="showTab(this.value)">
    ${secciones.map((s, i) => `<option value="${i}">${s.icono} ${s.titulo}</option>`).join('')}
  </select>
</div>

<div class="layout">
  <nav class="sidebar">${tabs}</nav>
  <main class="content">${panels}</main>
</div>

<div class="footer">
  <p>© 2026 ${titulo} — Todos los derechos reservados · Producto Premium</p>
</div>

<script>
function showTab(i) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + i)?.classList.add('active');
  document.getElementById('btn-' + i)?.classList.add('active');
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

// ── Helper: genera una sección con Claude ────────────────────
async function generarSeccion(prompt, agente = 'generator') {
  const resultado = await preguntar(prompt, SYSTEM, agente, 4000);
  return resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
}

// ── Pack de 30 Prompts ───────────────────────────────────────
async function generarPackPrompts(nicho) {
  console.log('[Generator] Generando prompts por bloques...');

  const intro = await generarSeccion(`
Escribe la sección de introducción para un pack de prompts de IA sobre: ${nicho.nicho}
Cliente: ${nicho.cliente_ideal}. Problema: ${nicho.problema_que_resuelve}
Incluye: cómo usar los prompts, dónde pegarlos (ChatGPT/Claude), cómo personalizar las variables en MAYÚSCULAS.
Formato: párrafos HTML con <p> y <div class="tip">. Sin <html> ni <body>. Solo el contenido interior.`);

  const prompts1 = await generarSeccion(`
Crea los prompts #1 al #10 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Para cada prompt usa EXACTAMENTE este formato HTML:
<div class="card">
  <h3>Prompt #N: [Nombre descriptivo]</h3>
  <p><strong>Para qué sirve:</strong> [1 línea concreta]</p>
  <div class="prompt-box"><button class="copy-btn">Copiar</button>[EL PROMPT COMPLETO con variables en MAYÚSCULAS]</div>
  <div class="tip">💡 Tip: [Consejo específico para este prompt]</div>
  <p><strong>Resultado esperado:</strong> [Ejemplo realista]</p>
</div>
Sin <html> ni <body>. Solo los 10 divs.`);

  const prompts2 = await generarSeccion(`
Crea los prompts #11 al #20 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Misma estructura HTML que antes:
<div class="card"><h3>Prompt #N...</h3>...prompt-box...tip...</div>
Sin <html> ni <body>. Solo los 10 divs.`);

  const prompts3 = await generarSeccion(`
Crea los prompts #21 al #30 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Misma estructura HTML:
<div class="card"><h3>Prompt #N...</h3>...prompt-box...tip...</div>
Sin <html> ni <body>. Solo los 10 divs.`);

  const bonus = await generarSeccion(`
Crea una sección "Cómo combinar estos prompts" para: ${nicho.nicho}
Explica 3 flujos de trabajo donde se usan varios prompts en secuencia para lograr resultados potentes.
Formato HTML con <div class="card"> y <p>. Sin <html> ni <body>.`);

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

  const intro = await generarSeccion(`
Escribe la introducción de una guía sobre: ${nicho.nicho}
Título: ${nicho.nombre_producto}. Cliente: ${nicho.cliente_ideal}. Problema: ${nicho.problema_que_resuelve}
3 párrafos poderosos que conectan con el dolor del cliente y prometen la solución.
Formato: <div class="card"><p>...</p></div>. Sin <html> ni <body>.`);

  const cap1 = await generarSeccion(`
Escribe el Capítulo 1 de una guía sobre: ${nicho.nicho}
Tema: Fundamentos — qué necesitas saber primero. Mínimo 500 palabras.
Incluye conceptos clave, una sección destacada con <div class="highlight">, y una lista ordenada de pasos.
Formato: <div class="card"> y elementos HTML. Sin <html> ni <body>.`);

  const cap2 = await generarSeccion(`
Escribe el Capítulo 2 de una guía sobre: ${nicho.nicho}
Tema: El método paso a paso. Mínimo 500 palabras.
Pasos numerados detallados con ejemplos del mercado hispano. Incluye un <div class="tip"> con consejo clave.
Formato: <div class="card"> y elementos HTML. Sin <html> ni <body>.`);

  const cap3 = await generarSeccion(`
Escribe el Capítulo 3 con 3 casos reales del mercado hispano/latinoamericano sobre: ${nicho.nicho}
Usa nombres hispanos reales. Incluye situación inicial, qué hicieron, resultado específico con números.
Formato: <div class="card"> por cada caso. Sin <html> ni <body>.`);

  const recursos = await generarSeccion(`
Crea una sección de herramientas y recursos para: ${nicho.nicho}
Incluye: tabla HTML con herramientas (nombre, para qué sirve, precio, gratuita/pago), y los 10 errores más comunes en lista ordenada.
Formato: <table><tr><th>...</th></tr></table> y <div class="card"><ol>. Sin <html> ni <body>.`);

  const plan = await generarSeccion(`
Crea el Plan de Acción de 7 días para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Día 1 al día 7: qué hacer exactamente cada día, muy específico y accionable.
Usa acordeón HTML:
<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)">📅 Día N: [Título] <span class="arrow">▼</span></div><div class="accordion-body"><p>...</p></div></div>
Sin <html> ni <body>.`);

  const secciones = [
    { icono: '🎯', titulo: 'Introducción', contenido: intro },
    { icono: '📚', titulo: 'Fundamentos', contenido: cap1 },
    { icono: '🔧', titulo: 'El Método', contenido: cap2 },
    { icono: '💡', titulo: 'Casos Reales', contenido: cap3 },
    { icono: '🛠️', titulo: 'Herramientas y Errores', contenido: recursos },
    { icono: '📅', titulo: 'Plan 7 Días', contenido: plan },
  ];

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'guia_pdf', secciones);
}

// ── Plantilla ────────────────────────────────────────────────
async function generarPlantilla(nicho) {
  console.log('[Generator] Generando plantilla por secciones...');

  const instrucciones = await generarSeccion(`
Escribe las instrucciones de uso para una plantilla sobre: ${nicho.nicho}
Título: ${nicho.nombre_producto}. Cliente: ${nicho.cliente_ideal}
Incluye: cómo copiarla a Notion/Google Sheets/Excel, cómo personalizarla, tiempo estimado de setup.
Formato: <div class="card"><p>...</p></div>. Sin <html> ni <body>.`);

  const plantilla = await generarSeccion(`
Crea la plantilla COMPLETA para: ${nicho.nicho}
Incluye todas las secciones, filas y columnas necesarias. Usa tablas HTML donde aplique.
Formato: <div class="card"><table>...</table></div> y secciones con <div class="card">. Sin <html> ni <body>.`);

  const ejemplo = await generarSeccion(`
Crea un ejemplo COMPLETAMENTE llenado de la plantilla para: ${nicho.nicho}
Usa datos realistas de un cliente hispanohablante típico. Muestra la plantilla en uso real.
Formato: <div class="card"> con tablas HTML llenadas y texto explicativo. Sin <html> ni <body>.`);

  const tips = await generarSeccion(`
Crea 2 secciones:
1. Tips avanzados para usar la plantilla de: ${nicho.nicho} (6-8 tips específicos)
2. Los 5 errores más comunes al usar este tipo de plantilla (con solución para cada uno)
Formato: <div class="card"><ul>...</ul></div>. Sin <html> ni <body>.`);

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

  const bienvenida = await generarSeccion(`
Escribe el mensaje de bienvenida para un mini curso sobre: ${nicho.nicho}
Título: ${nicho.nombre_producto}. Cliente: ${nicho.cliente_ideal}
Incluye: qué van a lograr, cuánto dura el curso, cómo aprovecharlo mejor. Tono motivador y personal.
Formato: <div class="card"><p>...</p></div> con <div class="highlight"> para el objetivo principal. Sin <html> ni <body>.`);

  const temas = [
    'Fundamentos — qué necesitas saber primero',
    'El método — cómo hacerlo paso a paso',
    'Herramientas y recursos esenciales',
    'Casos reales del mercado hispano',
    'Acción — implementa todo hoy'
  ];
  const modulos = [];
  for (let i = 0; i < 5; i++) {
    const n = i + 1;
    console.log(`[Generator] Generando módulo ${n}/5...`);
    const contenido = await generarSeccion(`
Escribe el Módulo ${n} de un mini curso sobre: ${nicho.nicho}
Tema: ${temas[i]}. Cliente: ${nicho.cliente_ideal}
Incluye:
- Objetivo del módulo (1 línea)
- Lección ${n}.1: [título] — mínimo 300 palabras de contenido real
- Lección ${n}.2: [título] — mínimo 300 palabras de contenido real
- Tarea práctica que el alumno puede hacer HOY

Usa acordeón para las lecciones:
<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)">📝 Lección ${n}.1: [Título] <span class="arrow">▼</span></div><div class="accordion-body"><p>contenido...</p></div></div>
Y termina con: <div class="tip">✅ Tarea: [ejercicio concreto]</div>
Sin <html> ni <body>.`);
    modulos.push(contenido);
  }

  const examen = await generarSeccion(`
Crea el examen final (5 preguntas de opción múltiple) y el certificado de completación para: ${nicho.nombre_producto}
Preguntas con 4 opciones cada una, respuesta correcta marcada con ✅.
El certificado: div con borde verde, título "Certificado de Completación", nombre del curso, espacio para nombre y fecha.
Formato HTML con <div class="card">. Sin <html> ni <body>.`);

  const secciones = [
    { icono: '👋', titulo: 'Bienvenida', contenido: bienvenida },
    { icono: '1️⃣', titulo: 'Módulo 1', contenido: modulos[0] },
    { icono: '2️⃣', titulo: 'Módulo 2', contenido: modulos[1] },
    { icono: '3️⃣', titulo: 'Módulo 3', contenido: modulos[2] },
    { icono: '4️⃣', titulo: 'Módulo 4', contenido: modulos[3] },
    { icono: '5️⃣', titulo: 'Módulo 5', contenido: modulos[4] },
    { icono: '🎓', titulo: 'Examen y Certificado', contenido: examen },
  ];

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'mini_curso', secciones);
}

// ── Toolkit ──────────────────────────────────────────────────
async function generarToolkit(nicho) {
  console.log('[Generator] Generando toolkit por secciones...');

  const intro = await generarSeccion(`
Escribe la introducción y checklist maestro para un toolkit sobre: ${nicho.nicho}
Incluye: cómo usar el toolkit, y un checklist de 40 ítems organizados por fase/etapa.
Checklist: <ul class="checklist"><li>acción concreta</li>...</ul>
Formato: <div class="card">. Sin <html> ni <body>.`);

  const plantillas = await generarSeccion(`
Crea 3 plantillas prácticas listas para usar sobre: ${nicho.nicho}
Cada plantilla con: nombre, instrucciones de uso, la plantilla con tabla HTML y ejemplo llenado.
Formato: <div class="card"> por cada plantilla. Sin <html> ni <body>.`);

  const herramientas = await generarSeccion(`
Crea el stack de herramientas recomendadas para: ${nicho.nicho}
Tabla HTML con columnas: Herramienta | Para qué sirve | Precio | Categoría
Agrupa por categorías. Mínimo 15 herramientas.
Formato: <div class="card"><table>...</table></div>. Sin <html> ni <body>.`);

  const metricas = await generarSeccion(`
Crea 2 secciones para: ${nicho.nicho}
1. Métricas clave a monitorear (tabla: métrica, valor referencia, cómo medirla)
2. Las 10 señales de alerta con solución inmediata para cada una
Formato: <div class="card"> con tablas y listas HTML. Sin <html> ni <body>.`);

  const calendario = await generarSeccion(`
Crea el calendario de implementación de 30 días para: ${nicho.nicho}
Organizado en 4 semanas. Usa acordeón por semana:
<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)">📅 Semana N: [Objetivo] <span class="arrow">▼</span></div><div class="accordion-body">acciones día a día...</div></div>
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
