// ════════════════════════════════════
// NEXUS AGENT — agents/digital/generator.js
// Crea el producto digital como HTML bonito y profesional
// Soporta: prompts, plantilla, guia_pdf, mini_curso, toolkit
// ════════════════════════════════════

import { preguntar } from '../../core/claude.js';
import { db } from '../../core/database.js';

const SYSTEM = `Eres un diseñador experto en productos digitales premium para el mercado hispano.
Creas productos en HTML completo con estilos inline — bonitos, profesionales, con colores,
secciones bien definidas y formato que justifica el precio. El cliente abre el link y ve
algo que vale lo que pagó. Siempre devuelves HTML completo desde <!DOCTYPE> hasta </html>.`;

const ESTILOS_BASE = `
  body { margin:0; font-family:'Segoe UI',Arial,sans-serif; background:#0f0f0f; color:#e0e0e0; }
  .header { background:linear-gradient(135deg,#1a1a2e,#16213e); padding:60px 20px; text-align:center; border-bottom:3px solid #00ff88; }
  .header h1 { color:#00ff88; font-size:2.2em; margin:0 0 12px; line-height:1.3; }
  .header p { color:#aaa; font-size:1.1em; margin:0; max-width:600px; margin:0 auto; }
  .badge { display:inline-block; background:#00ff88; color:#000; padding:6px 16px; border-radius:20px; font-size:0.85em; font-weight:bold; margin-bottom:20px; }
  .container { max-width:800px; margin:0 auto; padding:40px 20px; }
  .section { background:#1a1a1a; border-radius:12px; padding:32px; margin-bottom:24px; border-left:4px solid #00ff88; }
  .section h2 { color:#00ff88; font-size:1.4em; margin:0 0 16px; }
  .section h3 { color:#fff; font-size:1.1em; margin:20px 0 10px; }
  .section p { color:#ccc; line-height:1.8; margin:0 0 12px; }
  .section ul, .section ol { color:#ccc; line-height:2; padding-left:20px; }
  .section li { margin-bottom:4px; }
  .highlight { background:#0d2818; border:1px solid #00ff88; border-radius:8px; padding:20px; margin:16px 0; }
  .highlight p { color:#00ff88; margin:0; font-weight:600; }
  .tip { background:#1a1500; border:1px solid #ffcc00; border-radius:8px; padding:16px; margin:12px 0; }
  .tip p { color:#ffcc00; margin:0; font-size:0.95em; }
  .prompt-box { background:#111; border:1px solid #333; border-radius:8px; padding:20px; margin:16px 0; font-family:monospace; font-size:0.9em; color:#00ff88; white-space:pre-wrap; line-height:1.6; }
  .module { background:#161616; border:1px solid #222; border-radius:12px; padding:24px; margin-bottom:20px; }
  .module-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .module-num { background:#00ff88; color:#000; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.1em; flex-shrink:0; }
  .module h2 { color:#fff; margin:0; font-size:1.2em; }
  .checklist li { list-style:none; padding:8px 0; border-bottom:1px solid #222; color:#ccc; }
  .checklist li:before { content:"☐ "; color:#00ff88; font-size:1.2em; }
  .footer { background:#111; padding:32px 20px; text-align:center; margin-top:40px; border-top:1px solid #222; }
  .footer p { color:#555; font-size:0.85em; margin:0; }
  .tag { display:inline-block; background:#1a2a1a; color:#00ff88; border:1px solid #00ff88; padding:3px 10px; border-radius:12px; font-size:0.8em; margin:3px; }
`;

export async function generarProducto(nicho) {
  console.log(`[Generator] Creando producto tipo "${nicho.tipo}": "${nicho.nombre_producto}"...`);

  let html = '';

  if (nicho.tipo === 'prompts') {
    html = await generarPackPrompts(nicho);
  } else if (nicho.tipo === 'plantilla') {
    html = await generarPlantilla(nicho);
  } else if (nicho.tipo === 'guia_pdf') {
    html = await generarGuiaPDF(nicho);
  } else if (nicho.tipo === 'mini_curso') {
    html = await generarMiniCurso(nicho);
  } else if (nicho.tipo === 'toolkit') {
    html = await generarToolkit(nicho);
  } else {
    console.log(`[Generator] Tipo desconocido "${nicho.tipo}" — usando guía PDF`);
    html = await generarGuiaPDF(nicho);
  }

  // Limpiar posibles bloques de código
  html = html.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

  await db.log('generator', 'producto_generado', {
    nicho: nicho.nicho,
    tipo: nicho.tipo,
    chars: html.length
  });

  console.log(`[Generator] Producto creado — ${html.length} caracteres`);
  return html;
}

// ── Pack de 30 Prompts ───────────────────────────────────────
async function generarPackPrompts(nicho) {
  return preguntar(`
Crea un pack de 30 prompts profesionales de IA como página HTML completa y bonita.

Producto: ${nicho.nombre_producto}
Nicho: ${nicho.nicho}
Cliente ideal: ${nicho.cliente_ideal}
Problema: ${nicho.problema_que_resuelve}

Estructura HTML EXACTA (usa estos estilos inline):

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${nicho.nombre_producto}</title>
<style>${ESTILOS_BASE}</style>
</head>
<body>

<div class="header">
  <span class="badge">⚡ ${nicho.tipo.toUpperCase()} PREMIUM</span>
  <h1>${nicho.nombre_producto}</h1>
  <p>${nicho.subtitulo}</p>
</div>

<div class="container">

  <!-- INTRODUCCIÓN -->
  <div class="section">
    <h2>🎯 Cómo usar este pack</h2>
    [Instrucciones claras en 3-4 párrafos: cómo copiar los prompts, dónde usarlos, cómo personalizarlos]
  </div>

  <!-- 30 PROMPTS — uno por sección -->
  [Para CADA uno de los 30 prompts, usa este formato:]
  <div class="section">
    <h2>Prompt #[N]: [Nombre descriptivo]</h2>
    <p><strong>Para qué sirve:</strong> [1 línea concreta]</p>
    <div class="prompt-box">[EL PROMPT COMPLETO listo para copiar — con variables en MAYÚSCULAS]</div>
    <div class="tip"><p>💡 Tip: [Consejo para sacarle más provecho a este prompt]</p></div>
    <p><strong>Ejemplo de resultado:</strong> [Ejemplo breve y realista]</p>
  </div>

  <!-- BONUS -->
  <div class="section">
    <h2>🎁 Bonus: Cómo combinar estos prompts</h2>
    [Estrategia para usar varios prompts en secuencia para lograr resultados más potentes]
  </div>

</div>

<div class="footer">
  <p>© 2026 ${nicho.nombre_producto} — Todos los derechos reservados</p>
</div>

</body>
</html>

IMPORTANTE: Crea los 30 prompts REALES y COMPLETOS. Cada prompt debe ser profesional, específico para el nicho, listo para copiar y pegar. No uses placeholders genéricos.
Devuelve SOLO el HTML completo.
`, SYSTEM, 'generator', 12000);
}

// ── Plantilla ────────────────────────────────────────────────
async function generarPlantilla(nicho) {
  return preguntar(`
Crea una plantilla profesional completa como página HTML bonita.

Producto: ${nicho.nombre_producto}
Nicho: ${nicho.nicho}
Cliente ideal: ${nicho.cliente_ideal}
Problema: ${nicho.problema_que_resuelve}

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${nicho.nombre_producto}</title>
<style>${ESTILOS_BASE}</style>
</head>
<body>

<div class="header">
  <span class="badge">📋 PLANTILLA PREMIUM</span>
  <h1>${nicho.nombre_producto}</h1>
  <p>${nicho.subtitulo}</p>
</div>

<div class="container">

  <div class="section">
    <h2>📖 Cómo usar esta plantilla</h2>
    [Instrucciones paso a paso — cómo copiarla a Notion, Google Sheets o Excel]
  </div>

  <div class="section">
    <h2>📋 La Plantilla Completa</h2>
    [La plantilla REAL con todas las secciones, usando tablas HTML donde aplique]
    [Con ejemplos llenados de forma realista]
  </div>

  <div class="section">
    <h2>✅ Ejemplo Completamente Llenado</h2>
    [Ejemplo real y completo de cómo se usa — como si fuera un cliente real del nicho]
  </div>

  <div class="section">
    <h2>💡 Tips de Uso Avanzado</h2>
    [6-8 tips específicos para sacar el máximo provecho]
  </div>

  <div class="section">
    <h2>⚠️ Errores Comunes y Cómo Evitarlos</h2>
    [Los 5 errores más frecuentes con solución concreta]
  </div>

</div>

<div class="footer">
  <p>© 2026 ${nicho.nombre_producto} — Todos los derechos reservados</p>
</div>

</body>
</html>

Devuelve SOLO el HTML completo con contenido REAL, no placeholders.
`, SYSTEM, 'generator', 12000);
}

// ── Guía PDF ─────────────────────────────────────────────────
async function generarGuiaPDF(nicho) {
  return preguntar(`
Crea una guía profesional completa como página HTML bonita.

Producto: ${nicho.nombre_producto}
Nicho: ${nicho.nicho}
Cliente ideal: ${nicho.cliente_ideal}
Problema: ${nicho.problema_que_resuelve}

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${nicho.nombre_producto}</title>
<style>${ESTILOS_BASE}</style>
</head>
<body>

<div class="header">
  <span class="badge">📘 GUÍA PREMIUM</span>
  <h1>${nicho.nombre_producto}</h1>
  <p>${nicho.subtitulo}</p>
</div>

<div class="container">

  <div class="section">
    <h2>Por qué necesitas esto ahora</h2>
    [Introducción poderosa — 3 párrafos que conectan con el dolor del cliente]
  </div>

  <div class="section">
    <h2>Capítulo 1: [Fundamentos]</h2>
    [Contenido detallado con conceptos clave — mínimo 400 palabras]
    <div class="highlight"><p>[Punto clave que el lector debe recordar]</p></div>
  </div>

  <div class="section">
    <h2>Capítulo 2: [El Método Paso a Paso]</h2>
    [Pasos numerados y detallados — mínimo 400 palabras]
  </div>

  <div class="section">
    <h2>Capítulo 3: [Casos Reales del Mercado Hispano]</h2>
    [3 casos de uso reales con nombres hispanos y resultados específicos]
  </div>

  <div class="section">
    <h2>Capítulo 4: Herramientas y Recursos</h2>
    [Lista de herramientas gratuitas y de pago con descripción de para qué sirve cada una]
  </div>

  <div class="section">
    <h2>⚠️ Los 10 Errores Más Comunes</h2>
    <ol>[10 errores con explicación y cómo corregirlos]</ol>
  </div>

  <div class="section">
    <h2>📅 Tu Plan de Acción — 7 Días</h2>
    [Día 1 al día 7: qué hacer exactamente cada día, muy específico]
  </div>

</div>

<div class="footer">
  <p>© 2026 ${nicho.nombre_producto} — Todos los derechos reservados</p>
</div>

</body>
</html>

Devuelve SOLO el HTML completo con mínimo 3,000 palabras de contenido REAL.
`, SYSTEM, 'generator', 12000);
}

// ── Mini Curso ───────────────────────────────────────────────
async function generarMiniCurso(nicho) {
  return preguntar(`
Crea un mini curso premium completo como página HTML bonita con 5 módulos.

Producto: ${nicho.nombre_producto}
Nicho: ${nicho.nicho}
Cliente ideal: ${nicho.cliente_ideal}
Problema: ${nicho.problema_que_resuelve}

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${nicho.nombre_producto}</title>
<style>${ESTILOS_BASE}</style>
</head>
<body>

<div class="header">
  <span class="badge">🎓 MINI CURSO PREMIUM</span>
  <h1>${nicho.nombre_producto}</h1>
  <p>${nicho.subtitulo}</p>
</div>

<div class="container">

  <div class="section">
    <h2>Bienvenida al Curso</h2>
    [Mensaje motivador personal — qué van a lograr, cuánto tarda, cómo aprovechar el curso]
  </div>

  [5 MÓDULOS — usa este formato para cada uno:]
  <div class="module">
    <div class="module-header">
      <div class="module-num">[N]</div>
      <h2>Módulo [N]: [Nombre del Módulo]</h2>
    </div>
    <p style="color:#888;font-size:0.9em;">⏱️ Tiempo estimado: [X] minutos</p>

    <div class="section">
      <h3>Lección [N].1: [Título]</h3>
      [Contenido completo de la lección — mínimo 350 palabras, práctico y específico]
      <div class="highlight"><p>[Punto clave de esta lección]</p></div>
    </div>

    <div class="section">
      <h3>Lección [N].2: [Título]</h3>
      [Contenido completo — mínimo 350 palabras]
    </div>

    <div class="tip">
      <p>✅ Tarea del Módulo [N]: [Ejercicio concreto que el alumno puede hacer hoy mismo]</p>
    </div>
  </div>

  <div class="section">
    <h2>🎯 Examen Final</h2>
    [5 preguntas con 4 opciones cada una y respuestas marcadas]
  </div>

  <div class="section">
    <h2>📜 Certificado de Completación</h2>
    <div style="border:2px solid #00ff88;padding:32px;text-align:center;border-radius:12px;">
      <h3 style="color:#00ff88;">Certificado de Completación</h3>
      <p style="color:#ccc;">Este documento certifica que has completado exitosamente</p>
      <h2 style="color:#fff;">${nicho.nombre_producto}</h2>
      <p style="color:#888;">Fecha: _______________</p>
      <p style="color:#888;">Nombre: _______________</p>
    </div>
  </div>

</div>

<div class="footer">
  <p>© 2026 ${nicho.nombre_producto} — Todos los derechos reservados</p>
</div>

</body>
</html>

Devuelve SOLO el HTML completo con mínimo 4,000 palabras de contenido REAL en los módulos.
`, SYSTEM, 'generator', 12000);
}

// ── Toolkit ──────────────────────────────────────────────────
async function generarToolkit(nicho) {
  return preguntar(`
Crea un toolkit profesional completo como página HTML bonita.

Producto: ${nicho.nombre_producto}
Nicho: ${nicho.nicho}
Cliente ideal: ${nicho.cliente_ideal}
Problema: ${nicho.problema_que_resuelve}

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${nicho.nombre_producto}</title>
<style>${ESTILOS_BASE}</style>
</head>
<body>

<div class="header">
  <span class="badge">🔧 TOOLKIT PREMIUM</span>
  <h1>${nicho.nombre_producto}</h1>
  <p>${nicho.subtitulo}</p>
</div>

<div class="container">

  <div class="section">
    <h2>📖 Cómo usar este toolkit</h2>
    [Instrucciones rápidas — empieza a usarlo en 5 minutos]
  </div>

  <div class="section">
    <h2>✅ Checklist Maestro</h2>
    <ul class="checklist">
      [40-50 ítems de acción concretos organizados por etapa/fase]
    </ul>
  </div>

  <div class="section">
    <h2>📋 Plantillas Incluidas</h2>
    [3 plantillas reales con ejemplos llenados usando tablas HTML]
  </div>

  <div class="section">
    <h2>🔧 Stack de Herramientas Recomendadas</h2>
    [Herramientas por categoría: nombre, para qué sirve, precio, link como texto]
  </div>

  <div class="section">
    <h2>📊 Métricas Clave a Monitorear</h2>
    [KPIs específicos del nicho con valores de referencia y cómo medirlos]
  </div>

  <div class="section">
    <h2>🚨 Señales de Alerta</h2>
    [10 señales de que algo está mal — con solución inmediata para cada una]
  </div>

  <div class="section">
    <h2>📅 Calendario de Implementación — 30 Días</h2>
    [Semana 1, 2, 3 y 4 con acciones específicas cada día]
  </div>

</div>

<div class="footer">
  <p>© 2026 ${nicho.nombre_producto} — Todos los derechos reservados</p>
</div>

</body>
</html>

Devuelve SOLO el HTML completo con contenido REAL y específico para el nicho.
`, SYSTEM, 'generator', 12000);
}
