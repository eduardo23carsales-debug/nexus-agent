// ════════════════════════════════════
// NEXUS AGENT — agents/digital/generator.js
// Crea el contenido del producto digital con IA
// Soporta: prompts, plantilla, guia_pdf, mini_curso, toolkit
// ════════════════════════════════════

import { preguntar } from '../../core/claude.js';
import { db } from '../../core/database.js';

const SYSTEM = `Eres un experto creador de productos digitales en español para el
mercado hispano. Creas contenido de alta calidad, práctico y accionable que la gente
paga con gusto. Tu contenido es directo, sin relleno, con ejemplos reales y específicos.`;

export async function generarProducto(nicho) {
  console.log(`[Generator] Creando producto tipo "${nicho.tipo}": "${nicho.nombre_producto}"...`);

  let contenido = '';

  if (nicho.tipo === 'prompts') {
    contenido = await generarPackPrompts(nicho);
  } else if (nicho.tipo === 'plantilla') {
    contenido = await generarPlantilla(nicho);
  } else if (nicho.tipo === 'guia_pdf') {
    contenido = await generarGuiaPDF(nicho);
  } else if (nicho.tipo === 'mini_curso') {
    contenido = await generarMiniCurso(nicho);
  } else if (nicho.tipo === 'toolkit') {
    contenido = await generarToolkit(nicho);
  } else {
    // Fallback — guía genérica para cualquier tipo no reconocido
    console.log(`[Generator] Tipo desconocido "${nicho.tipo}" — usando guía PDF`);
    contenido = await generarGuiaPDF(nicho);
  }

  await db.log('generator', 'producto_generado', {
    nicho: nicho.nicho,
    tipo: nicho.tipo,
    chars: contenido.length
  });

  console.log(`[Generator] Producto creado — ${contenido.length} caracteres`);
  return contenido;
}

// ── Pack de 30 Prompts de IA ─────────────────────────────────
async function generarPackPrompts(nicho) {
  return preguntar(`
Crea un pack de 30 prompts profesionales de IA en español para: ${nicho.nicho}

Cliente ideal: ${nicho.cliente_ideal}
Problema que resuelve: ${nicho.problema_que_resuelve}

Formato EXACTO para CADA prompt:
## Prompt #[número]: [nombre descriptivo]
**Para qué sirve:** [1 línea concreta]
**El prompt:**
[el prompt completo listo para copiar y pegar en ChatGPT o Claude]
**Ejemplo de resultado:**
[ejemplo breve y realista de lo que produce este prompt]

---

Instrucciones:
- 30 prompts variados, cada uno resuelve una situación específica diferente
- Los prompts deben ser listos para usar, no genéricos
- Incluye variables entre [corchetes] donde el usuario personaliza
- Lenguaje español neutro, directo, profesional
`, SYSTEM, 'generator', 12000);
}

// ── Plantilla Notion/Excel ───────────────────────────────────
async function generarPlantilla(nicho) {
  return preguntar(`
Crea una plantilla completa en formato Markdown para: ${nicho.nicho}

Título: ${nicho.nombre_producto}
Cliente ideal: ${nicho.cliente_ideal}
Problema que resuelve: ${nicho.problema_que_resuelve}

La plantilla debe incluir:

# ${nicho.nombre_producto}

## 📖 Cómo usar esta plantilla
[Instrucciones paso a paso — cómo copiarla a Notion, Google Sheets o Excel]

## 📋 La Plantilla Completa
[La plantilla con TODAS las secciones, filas, columnas o campos necesarios]
[Usa tablas Markdown donde aplique]

## ✅ Ejemplo Llenado
[Un ejemplo completo y realista de cómo se ve la plantilla en uso]

## 💡 Tips de Uso
[5-8 consejos para sacarle el máximo provecho]

## ⚠️ Errores Comunes
[Los 5 errores más frecuentes y cómo evitarlos]

Hazla profesional y lista para usar desde el día 1.
Extensión mínima: 1,500 palabras.
Lenguaje: español claro y directo.
`, SYSTEM, 'generator', 12000);
}

// ── Guía PDF ─────────────────────────────────────────────────
async function generarGuiaPDF(nicho) {
  return preguntar(`
Crea una guía completa y profesional en español sobre: ${nicho.nicho}

Título: ${nicho.nombre_producto}
Cliente ideal: ${nicho.cliente_ideal}
Problema que resuelve: ${nicho.problema_que_resuelve}

Estructura COMPLETA:

# ${nicho.nombre_producto}

## Introducción
[Por qué este tema importa ahora — 3 párrafos directos y motivadores]

## Capítulo 1: [Fundamentos — qué necesitas saber primero]
[Contenido detallado con conceptos clave explicados de forma simple]

## Capítulo 2: [El método — cómo hacerlo paso a paso]
[Pasos concretos y accionables, numerados]

## Capítulo 3: [Casos reales — ejemplos del mercado hispano]
[3 casos de uso reales con resultados específicos]

## Capítulo 4: [Herramientas y recursos]
[Lista de herramientas gratuitas y de pago con para qué sirve cada una]

## Los 10 errores más comunes (y cómo evitarlos)
[Lista con explicación práctica de cada error]

## Plan de acción — próximos 7 días
[Día 1 al día 7: qué hacer exactamente cada día]

## Conclusión y próximos pasos
[Motivación + qué sigue después de aplicar esta guía]

Extensión mínima: 3,000 palabras. Contenido real, sin relleno.
Usa ejemplos concretos del mercado hispano/latinoamericano.
Lenguaje: español neutro pero dinámico.
`, SYSTEM, 'generator', 12000);
}

// ── Mini Curso (5 módulos) ───────────────────────────────────
async function generarMiniCurso(nicho) {
  return preguntar(`
Crea un mini curso completo en español sobre: ${nicho.nicho}

Título: ${nicho.nombre_producto}
Cliente ideal: ${nicho.cliente_ideal}
Problema que resuelve: ${nicho.problema_que_resuelve}

Estructura del curso (5 módulos):

# ${nicho.nombre_producto}
## Bienvenida al curso
[Mensaje motivador + qué van a lograr al terminar]

---

## MÓDULO 1: [Nombre — Fundamentos]
**Objetivo:** [Qué aprende el alumno en este módulo]
**Duración estimada:** [X minutos de lectura]

### Lección 1.1: [tema]
[Contenido completo de la lección — mínimo 300 palabras]

### Lección 1.2: [tema]
[Contenido completo de la lección — mínimo 300 palabras]

### ✅ Tarea del Módulo 1
[Ejercicio práctico concreto que el alumno hace hoy]

---

## MÓDULO 2: [Nombre — El Método]
[Misma estructura: objetivo, duración, 2 lecciones, tarea]

---

## MÓDULO 3: [Nombre — Herramientas]
[Misma estructura]

---

## MÓDULO 4: [Nombre — Casos Reales]
[Misma estructura — incluye 2 casos del mercado hispano]

---

## MÓDULO 5: [Nombre — Acción y Escala]
[Misma estructura — enfocado en pasar a la acción]

---

## 🎓 Examen Final
[5 preguntas de opción múltiple con respuestas]

## 📜 Certificado de Completación
[Texto del certificado que el alumno puede imprimir]

Extensión mínima: 4,000 palabras. Contenido práctico y accionable.
Lenguaje: español dinámico, como un buen profesor.
`, SYSTEM, 'generator', 12000);
}

// ── Toolkit / Checklist Profesional ─────────────────────────
async function generarToolkit(nicho) {
  return preguntar(`
Crea un toolkit profesional completo en español para: ${nicho.nicho}

Título: ${nicho.nombre_producto}
Cliente ideal: ${nicho.cliente_ideal}
Problema que resuelve: ${nicho.problema_que_resuelve}

El toolkit debe incluir:

# ${nicho.nombre_producto}

## 📖 Cómo usar este toolkit
[Instrucciones rápidas — 5 minutos para empezar]

## ✅ Checklist Maestro
[Lista completa de verificación con 30-50 ítems organizados por etapa]
Formato: - [ ] Ítem de acción concreto

## 📋 Plantillas Incluidas
[3-5 plantillas listas para usar, con ejemplos llenados]

## 🔧 Stack de Herramientas Recomendadas
[Herramientas organizadas por categoría: gratuitas vs de pago, con link y para qué sirve]

## 📊 Métricas Clave a Monitorear
[KPIs específicos de este nicho con valores de referencia]

## 🚨 Señales de Alerta
[10 señales de que algo está mal y cómo corregirlo]

## 📅 Calendario de Implementación
[Plan semana a semana para los primeros 30 días]

## 🎯 Guía de Referencia Rápida
[1 página con los puntos más importantes — para tener siempre a la mano]

Extensión mínima: 2,500 palabras. Contenido ultra-práctico.
Lenguaje: español directo, formato de referencia rápida.
`, SYSTEM, 'generator', 12000);
}
