// ════════════════════════════════════
// NEXUS AGENT — agents/ads/audience-builder.js
// Construye audiencias optimizadas por nicho con Claude
// ════════════════════════════════════

import { preguntarJSON } from '../../core/claude.js';

const SYSTEM = `Eres un experto en Meta Ads para el mercado hispano/latino en USA y América Latina.
Conoces los intereses, comportamientos y demografía exacta de cada nicho.
Siempre devuelves JSON válido con datos reales y específicos.`;

export async function construirAudiencia(nicho, formato = 'feed') {
  console.log(`[AudienceBuilder] Construyendo audiencia para: ${nicho.nicho} | formato: ${formato}`);

  const esStories = formato === 'stories';
  const instruccionesCopy = esStories
    ? `El formato es Instagram STORIES (imagen vertical 9:16). El copy debe ser MUY corto y directo — la gente hace scroll rápido.
copy: máximo 60 caracteres — golpe directo al dolor, sin rodeos
copy_b: máximo 60 caracteres — promesa del resultado, sin rodeos
headline: máximo 25 caracteres — urgente y claro`
    : `El formato es Facebook/Instagram FEED (imagen cuadrada). Hay más tiempo de lectura.
copy: máximo 125 caracteres — conecta con el dolor del cliente con urgencia
copy_b: máximo 125 caracteres — promesa del resultado positivo y aspiracional
headline: máximo 40 caracteres — título que engancha`;

  const audiencia = await preguntarJSON(`
Construye la audiencia perfecta de Meta Ads para este producto digital:

Nicho: ${nicho.nicho}
Producto: ${nicho.nombre_producto}
Precio: $${nicho.precio}
Cliente ideal: ${nicho.cliente_ideal}
Problema: ${nicho.problema_que_resuelve}
Formato del anuncio: ${esStories ? 'Instagram Stories (9:16 vertical)' : 'Feed cuadrado (1:1)'}

${instruccionesCopy}

Devuelve JSON:
{
  "edad_min": 25,
  "edad_max": 50,
  "intereses": ["interés 1", "interés 2", "interés 3", "interés 4", "interés 5"],
  "copy": "VARIANTE A — ángulo del DOLOR",
  "copy_b": "VARIANTE B — ángulo de la TRANSFORMACIÓN",
  "descripcion": "descripción corta del producto, máximo 30 caracteres",
  "headline": "título del anuncio",
  "razon": "por qué esta audiencia convierte para este nicho"
}

Los intereses deben ser nombres EXACTOS de intereses de Meta Ads en español o inglés.
copy y copy_b deben ser completamente diferentes entre sí.
`, SYSTEM, 'audience-builder');

  console.log(`[AudienceBuilder] Audiencia lista — ${audiencia.intereses?.length} intereses`);
  return audiencia;
}
