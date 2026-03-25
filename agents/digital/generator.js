// ════════════════════════════════════
// NEXUS AGENT — agents/digital/generator.js
// Crea el contenido del producto digital con IA
// ════════════════════════════════════

import { preguntar } from '../../core/claude.js';
import { db } from '../../core/database.js';

const SYSTEM = `Eres un experto creador de productos digitales en español para el
mercado hispano. Creas contenido de alta calidad, práctico y accionable que la gente
paga con gusto. Tu contenido es directo, sin relleno, con ejemplos reales.`;

export async function generarProducto(nicho) {
  console.log(`[Generator] Creando producto: "${nicho.nombre_producto}"...`);

  let contenido = '';

  if (nicho.tipo === 'prompts') {
    contenido = await generarPackPrompts(nicho);
  } else if (nicho.tipo === 'plantilla') {
    contenido = await generarPlantilla(nicho);
  } else {
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

async function generarPackPrompts(nicho) {
  return preguntar(`
Crea un pack de 30 prompts profesionales de IA para: ${nicho.nicho}

Cliente ideal: ${nicho.cliente_ideal}
Problema que resuelve: ${nicho.problema_que_resuelve}

Formato para CADA prompt:
## Prompt #[número]: [nombre del prompt]
**Para qué sirve:** [1 línea]
**El prompt:**
[el prompt completo listo para copiar y pegar en ChatGPT/Claude]
**Ejemplo de resultado:**
[ejemplo breve de lo que produce]

---

Crea 30 prompts variados, todos útiles y listos para usar.
Lenguaje: español, directo, profesional.
`, SYSTEM, 'generator', 4096);
}

async function generarGuiaPDF(nicho) {
  return preguntar(`
Crea una guía completa en español sobre: ${nicho.nicho}

Título: ${nicho.nombre_producto}
Cliente ideal: ${nicho.cliente_ideal}
Problema que resuelve: ${nicho.problema_que_resuelve}

Estructura:
# ${nicho.nombre_producto}

## Introducción (por qué necesitas esto)
[2-3 párrafos directos]

## Sección 1: [tema relevante]
[contenido detallado con pasos concretos]

## Sección 2: [tema relevante]
[contenido detallado con ejemplos reales]

## Sección 3: [tema relevante]
[contenido detallado]

## Los 10 errores más comunes (y cómo evitarlos)
[lista con explicación breve de cada uno]

## Plan de acción — próximos 7 días
[día 1 al día 7, qué hacer exactamente]

## Recursos y herramientas recomendadas
[lista de herramientas gratuitas y de pago]

Extensión: mínimo 2,500 palabras. Contenido real, sin relleno, con ejemplos específicos.
Lenguaje: español neutro pero dinámico.
`, SYSTEM, 'generator', 4096);
}

async function generarPlantilla(nicho) {
  return preguntar(`
Crea una plantilla completa en formato texto/markdown para: ${nicho.nicho}

Título: ${nicho.nombre_producto}
Cliente ideal: ${nicho.cliente_ideal}

La plantilla debe incluir:
1. Instrucciones de uso (cómo copiar a Notion/Excel)
2. La plantilla completa con todas las secciones
3. Ejemplos llenados para que el cliente entienda
4. Tips de personalización

Hazla profesional, lista para usar desde el día 1.
Lenguaje: español, claro y directo.
`, SYSTEM, 'generator', 4096);
}
