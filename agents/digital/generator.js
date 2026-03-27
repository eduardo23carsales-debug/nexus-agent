// ════════════════════════════════════
// NEXUS AGENT — agents/digital/generator.js
// Genera productos como HTML con tabs/acordeón
// Cada sección se genera por separado para evitar truncado
// ════════════════════════════════════

import { preguntarCompleto } from '../../core/claude.js';
import { db } from '../../core/database.js';

// Pausa entre secciones para evitar rate limit de Anthropic
const delay = ms => new Promise(r => setTimeout(r, ms));
const DELAY_SECCIONES = 4000; // 4 segundos entre llamadas

const SYSTEM = `Eres un experto creador de productos digitales premium para el mercado hispano.
Tu misión: crear contenido que haga que el cliente diga "wow, pagué muy poco por esto".

REGLAS DE CALIDAD — OBLIGATORIAS EN CADA SECCIÓN:
1. ESPECIFICIDAD REAL: Nombra herramientas reales (Canva, Notion, TikTok Ads, Shopify, etc.), precios reales ($47/mes, gratis, $0.30/clic), pasos con clicks exactos ("Ve a Configuración > Monetización > Pagos")
2. NÚMEROS CONCRETOS: Porcentajes, tiempos, ingresos posibles, promedios del mercado (23% de margen, $1,200/mes promedio, 3-5 días para primer resultado)
3. EJEMPLOS HISPANOS: Casos con nombres reales latinos (María de Guadalajara, Carlos de Miami, etc.), contexto cultural real, métodos de pago locales (Mercado Pago, PayPal, Zelle)
4. ACCIONABLE AL 100%: El lector debe poder ejecutar cada paso HOY, sin necesitar nada más
5. PROGRESIÓN: Cada sección construye sobre la anterior — referencia lo que ya aprendieron
6. CERO RELLENO: Sin frases como "es importante recordar que..." o "como mencionamos antes...". Directo al contenido de valor.
7. EJERCICIO PRÁCTICO: Cada sección termina con algo que el lector hace inmediatamente

Devuelves SOLO el HTML del contenido, sin <html> ni <body>. Contenido denso, rico, específico.`;

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

// ── Helper: genera una sección con Claude — siempre completa ─
async function generarSeccion(prompt, agente = 'generator') {
  const MAX_INTENTOS = 2;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    try {
      const resultado = await preguntarCompleto(prompt, SYSTEM, agente, 8000);
      const limpio = resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      if (limpio.length > 100) return limpio; // válido
      throw new Error('Respuesta demasiado corta');
    } catch (err) {
      if (intento < MAX_INTENTOS - 1) {
        console.log(`[Generator] Sección falló (intento ${intento + 1}): ${err.message} — reintentando en 10s...`);
        await delay(10000);
      } else {
        console.error(`[Generator] Sección falló tras ${MAX_INTENTOS} intentos: ${err.message}`);
        return `<div class="card"><p style="color:#ff6b6b;">⚠️ Esta sección no pudo generarse. Por favor regenera el producto.</p></div>`;
      }
    }
  }
}

// ── Extrae texto plano de HTML para pasar como contexto ──────
function resumirParaContexto(titulo, html) {
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  return `[${titulo}]: ${texto}...`;
}

// ── Construye el bloque de contexto acumulado ─────────────────
function bloqueContexto(historial) {
  if (!historial.length) return '';
  return `\nCONTEXTO DE SECCIONES YA ESCRITAS (mantén coherencia, no repitas, construye sobre esto):\n${historial.join('\n')}\n`;
}

// ── Bloque de especificidad del nicho para cada prompt ────────
function bloqueNicho(nicho) {
  const herramientas = nicho.herramientas_clave?.join(', ') || 'herramientas del sector';
  const quickWin = nicho.quick_win || '';
  const ejemplo = nicho.ejemplo_exito || '';
  return `
DATOS DEL NICHO (úsalos para hacer el contenido específico y no genérico):
- Producto: ${nicho.nombre_producto}
- Nicho exacto: ${nicho.nicho}
- Cliente ideal: ${nicho.cliente_ideal}
- Problema que resuelve: ${nicho.problema_que_resuelve}
- Herramientas clave del sector: ${herramientas}
- Quick win prometido: ${quickWin}
- Ejemplo de éxito de referencia: ${ejemplo}
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
Formato: <div class="card"> con pasos y highlight. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Quick Win', quickWin));
  await delay(DELAY_SECCIONES);

  // ── INTRODUCCIÓN ─────────────────────────────────────────────
  const intro = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe la introducción profunda de la guía "${nicho.nombre_producto}".
- Párrafo 1: Conecta con el dolor real del cliente (${nicho.problema_que_resuelve}) con una historia o situación reconocible
- Párrafo 2: Por qué la mayoría falla en ${nicho.nicho} (error más común, específico)
- Párrafo 3: Qué van a tener cuando terminen esta guía (resultados concretos con números)
- Incluye <div class="highlight"> con la promesa principal de la guía
- Mínimo 600 palabras. Sin frases de relleno. Directo y poderoso.
Formato: <div class="card"><p>...</p></div>. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Introducción', intro));
  await delay(DELAY_SECCIONES);

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
- Mínimo 700 palabras. Herramientas reales con nombres y precios.
Formato: <div class="card"> y elementos HTML. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto(tema1, cap1));
  await delay(DELAY_SECCIONES);

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
- Mínimo 700 palabras. Específico, accionable, con números reales.
Formato: <div class="card"> y elementos HTML. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto(tema2, cap2));
  await delay(DELAY_SECCIONES);

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
- Cada caso mínimo 250 palabras
Formato: <div class="card"> separado por cada caso, con <div class="highlight"> para el resultado. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Casos Reales', cap3));
  await delay(DELAY_SECCIONES);

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

PARTE 2 — Los 10 Errores que Cuestan Dinero:
Lista ordenada de los 10 errores más comunes en ${nicho.nicho}:
- Error específico (no genérico como "no planificar") + por qué pasa + cómo evitarlo + cuánto puede costar ese error
Formato: <table> para herramientas + <div class="card"><ol> para errores. Sin <html> ni <body>.`);
  ctx.push(resumirParaContexto('Herramientas y Errores', recursos));
  await delay(DELAY_SECCIONES);

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
Sin <html> ni <body>.`);

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
