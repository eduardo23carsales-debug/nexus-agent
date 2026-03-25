// Test del pipeline completo de leads
// Hunt → Qualify → Deliver

import { cazarLeads } from './agents/leadgen/lead-hunter.js';
import { calificarLeadsPendientes, calificarLeadManual } from './agents/leadgen/lead-qualifier.js';
import { entregarLeadsCalificados } from './agents/leadgen/lead-delivery.js';

console.log('═══════════════════════════════════');
console.log('  NEXUS AGENT — TEST PIPELINE LEADS');
console.log('═══════════════════════════════════\n');

// ── PASO 1: Cazar leads en Craigslist
console.log('PASO 1 — Cazando leads en Craigslist Miami...');
const nuevos = await cazarLeads();
console.log(`→ ${nuevos} leads nuevos encontrados\n`);

// ── PASO 2: Si no encontró nada en Craigslist, inyectar un lead manual de prueba
if (nuevos === 0) {
  console.log('PASO 2 — Craigslist sin resultados. Insertando lead manual de prueba...');
  const { calificacion } = await calificarLeadManual(
    "Hi, I'm looking for a reliable sedan in Miami. Budget around $12,000-$15,000. " +
    "Interested in Honda Civic or Toyota Corolla 2019-2022. Clean title preferred. " +
    "I have financing pre-approved and ready to buy this week."
  );
  console.log(`→ Lead manual calificado: Score ${calificacion.score}/10 — ${calificacion.razon}\n`);
} else {
  // ── PASO 2: Calificar los leads encontrados
  console.log('PASO 2 — Calificando leads con IA...');
  const resultado = await calificarLeadsPendientes();
  console.log(`→ ${resultado.calificados} calificados, ${resultado.descartados} descartados\n`);
}

// ── PASO 3: Entregar leads calificados por Telegram
console.log('PASO 3 — Enviando leads calificados a Telegram...');
const entregados = await entregarLeadsCalificados();
console.log(`→ ${entregados} leads enviados a tu Telegram\n`);

console.log('═══════════════════════════════════');
console.log('  PIPELINE COMPLETADO');
console.log('  Revisa tu Telegram para ver los leads');
console.log('═══════════════════════════════════');
