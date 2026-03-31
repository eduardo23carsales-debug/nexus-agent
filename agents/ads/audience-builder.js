// ════════════════════════════════════
// NEXUS AGENT — agents/ads/audience-builder.js
// Construye audiencias optimizadas por nicho con Claude
// ════════════════════════════════════

import { preguntarJSON } from '../../core/claude.js';

const SYSTEM = `Eres un experto en Meta Ads para el mercado hispano/latino en USA.
Conoces exactamente qué copy detiene el scroll, qué imágenes generan clics y qué audiencias compran.
Tu objetivo es maximizar CTR y conversiones, no solo impresiones.
Siempre devuelves JSON válido con datos reales, específicos y comprobados.`;

export async function construirAudiencia(nicho, formato = 'feed') {
  console.log(`[AudienceBuilder] Construyendo audiencia para: ${nicho.nicho} | formato: ${formato}`);

  const esStories = formato === 'stories';
  const instruccionesCopy = esStories
    ? `El formato es Instagram STORIES (imagen vertical 9:16). La gente hace scroll muy rápido.
hook: máximo 8 palabras — primera línea que detiene el scroll, provoca o sorprende (empieza con pregunta o cifra)
copy: máximo 60 caracteres — golpe directo al dolor, sin rodeos, con emoji al inicio
copy_b: máximo 60 caracteres — promesa del resultado, con cifra concreta si aplica, emoji al inicio
headline: máximo 25 caracteres — urgente, específico, clickable`
    : `El formato es Facebook/Instagram FEED. Hay algo más de tiempo de lectura pero el scroll es rápido.
hook: máximo 10 palabras — primera línea que detiene el scroll (pregunta directa, cifra impactante, o dato sorprendente)
copy: máximo 125 caracteres — conecta con el dolor exacto del cliente, urgencia real, emoji al inicio
copy_b: máximo 125 caracteres — resultado específico y aspiracional con cifra concreta, emoji al inicio
headline: máximo 40 caracteres — título que engancha y promete resultado claro`;

  const audiencia = await preguntarJSON(`
Construye la audiencia y copy perfectos de Meta Ads para este producto:

Nicho: ${nicho.nicho}
Producto: ${nicho.nombre_producto}
Precio: $${nicho.precio}
Cliente ideal: ${nicho.cliente_ideal}
Problema principal: ${nicho.problema_que_resuelve}
Formato del anuncio: ${esStories ? 'Instagram Stories (9:16 vertical)' : 'Feed cuadrado (1:1)'}

${instruccionesCopy}

REGLAS DE COPY QUE CONVIERTEN:
- Usa palabras específicas del dolor real del cliente (no genéricas)
- Incluye cifras cuando sea posible ($, %, tiempo)
- El hook debe provocar una reacción emocional inmediata
- copy y copy_b deben ser completamente distintos entre sí
- Empieza con emoji relevante en copy y copy_b
- Escribe como habla un latino en USA, no como un texto formal

Devuelve JSON exactamente así:
{
  "edad_min": 25,
  "edad_max": 50,
  "intereses": ["interés exacto 1", "interés exacto 2", "interés exacto 3", "interés exacto 4", "interés exacto 5"],
  "hook": "primera línea que para el scroll — ángulo del DOLOR, pregunta o cifra impactante",
  "hook_b": "primera línea alternativa — ángulo de URGENCIA o ESCASEZ, completamente distinta a hook",
  "copy": "VARIANTE A — ángulo del DOLOR con emoji",
  "copy_b": "VARIANTE B — ángulo de RESULTADO con emoji",
  "objecion_principal": "la excusa #1 que usa este cliente para NO comprar (máx 15 palabras)",
  "descripcion": "descripción corta del producto, máximo 30 caracteres",
  "headline": "título clickable que promete resultado",
  "razon": "por qué esta audiencia y este copy convierten para este nicho específico"
}

Los intereses deben ser nombres EXACTOS y específicos de intereses de Meta Ads (en inglés preferiblemente).
`, SYSTEM, 'audience-builder');

  console.log(`[AudienceBuilder] Audiencia lista — ${audiencia.intereses?.length} intereses | hook: "${audiencia.hook}"`);
  return audiencia;
}
