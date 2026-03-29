// ════════════════════════════════════
// NEXUS AGENT — agents/ads/audience-builder.js
// Construye audiencias optimizadas por nicho con Claude
// ════════════════════════════════════

import { preguntarJSON } from '../../core/claude.js';

const SYSTEM = `Eres un experto en Meta Ads para el mercado hispano/latino en USA y América Latina.
Conoces los intereses, comportamientos y demografía exacta de cada nicho.
Siempre devuelves JSON válido con datos reales y específicos.`;

export async function construirAudiencia(nicho) {
  console.log(`[AudienceBuilder] Construyendo audiencia para: ${nicho.nicho}`);

  const audiencia = await preguntarJSON(`
Construye la audiencia perfecta de Meta Ads para este producto digital:

Nicho: ${nicho.nicho}
Producto: ${nicho.nombre_producto}
Precio: $${nicho.precio}
Cliente ideal: ${nicho.cliente_ideal}
Problema: ${nicho.problema_que_resuelve}

Devuelve JSON:
{
  "edad_min": 25,
  "edad_max": 50,
  "intereses": ["interés 1", "interés 2", "interés 3", "interés 4", "interés 5"],
  "copy": "VARIANTE A — ángulo del DOLOR: conecta con el problema urgente del cliente, máximo 125 caracteres",
  "copy_b": "VARIANTE B — ángulo de la TRANSFORMACIÓN: promesa del resultado positivo y aspiracional, máximo 125 caracteres",
  "descripcion": "descripción corta del producto, máximo 30 caracteres",
  "headline": "título del anuncio, máximo 40 caracteres",
  "razon": "por qué esta audiencia convierte para este nicho"
}

Los intereses deben ser nombres EXACTOS de intereses de Meta Ads en español o inglés.
copy y copy_b deben ser completamente diferentes entre sí: uno ataca el dolor, el otro vende la transformación.
`, SYSTEM, 'audience-builder');

  console.log(`[AudienceBuilder] Audiencia lista — ${audiencia.intereses?.length} intereses`);
  return audiencia;
}
