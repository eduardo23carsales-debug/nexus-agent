// ════════════════════════════════════
// NEXUS AGENT — agents/leadgen/lead-qualifier.js
// Califica leads con IA — score 1-10
// Solo pasan los que valen la pena enviar al dealer
// ════════════════════════════════════

import { brain } from '../../core/brain.js';
import { db } from '../../core/database.js';

// ════════════════════════════════════
// CALIFICAR TODOS LOS LEADS PENDIENTES
// ════════════════════════════════════

export async function calificarLeadsPendientes() {
  const pendientes = await db.getLeadsPendientes('automotive');
  console.log(`[Qualifier] ${pendientes.length} leads pendientes de calificar`);

  let calificados = 0;
  let descartados = 0;

  for (const lead of pendientes) {
    try {
      // Marcar como "calificando"
      await db.updateLead(lead.id, { estado: 'calificando' });

      // IA evalúa el lead
      const resultado = await brain.calificarLead(lead);

      // Guardar resultado en DB
      await db.updateLead(lead.id, {
        score: resultado.score,
        razon_score: resultado.razon,
        es_calificado: resultado.es_calificado,
        urgencia: resultado.urgencia_real || lead.urgencia,
        estado: resultado.es_calificado ? 'calificado' : 'perdido',
        motivo_perdida: !resultado.es_calificado ? `Score bajo: ${resultado.razon}` : null
      });

      if (resultado.es_calificado) {
        calificados++;
        console.log(`[Qualifier] ✅ Lead calificado — Score ${resultado.score}/10: ${lead.descripcion_necesidad?.slice(0, 60)}`);
      } else {
        descartados++;
        console.log(`[Qualifier] ❌ Descartado — Score ${resultado.score}/10: ${resultado.razon}`);
      }

      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`[Qualifier] Error calificando lead ${lead.id}:`, err.message);
      await db.updateLead(lead.id, { estado: 'nuevo' }); // devolver a la cola
    }
  }

  console.log(`[Qualifier] Resultado: ${calificados} calificados, ${descartados} descartados`);
  await db.log('lead-qualifier', 'calificacion_completada', { calificados, descartados });

  return { calificados, descartados };
}

// ════════════════════════════════════
// CALIFICAR UN SOLO LEAD (input manual)
// ════════════════════════════════════

export async function calificarLeadManual(textoLibre) {
  // Crea el lead en DB desde texto libre (venido de Telegram)
  const lead = await db.crearLead({
    industria: 'automotive',
    descripcion_necesidad: textoLibre.slice(0, 500),
    mensaje_original: textoLibre,
    fuente: 'manual_telegram',
    ubicacion: 'Miami, FL',
    estado: 'calificando'
  });

  // IA lo califica
  const resultado = await brain.calificarLead(lead);

  await db.updateLead(lead.id, {
    score: resultado.score,
    razon_score: resultado.razon,
    es_calificado: resultado.es_calificado,
    urgencia: resultado.urgencia_real || 'este_mes',
    estado: resultado.es_calificado ? 'calificado' : 'perdido',
    motivo_perdida: !resultado.es_calificado ? resultado.razon : null
  });

  return { lead: { ...lead, ...resultado }, calificacion: resultado };
}
