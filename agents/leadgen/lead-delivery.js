// ════════════════════════════════════
// NEXUS AGENT — agents/leadgen/lead-delivery.js
// Entrega leads calificados al vendedor por Telegram
// ════════════════════════════════════

import { db, supabase } from '../../core/database.js';
import { enviar } from '../../core/telegram.js';

const SCORE_EMOJI = {
  10: '🔥', 9: '🔥', 8: '⭐', 7: '✅', 6: '⚠️', 5: '⚠️'
};

// ════════════════════════════════════
// FORMATEAR LEAD PARA EL VENDEDOR
// ════════════════════════════════════

function escaparHTML(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatearLead(lead) {
  const emoji = SCORE_EMOJI[lead.score] || '📋';
  const urgenciaTexto = {
    inmediata: '🚨 INMEDIATA',
    este_mes: '📅 Este mes',
    '3_meses': '🕐 En 3 meses',
    explorando: '👀 Explorando'
  }[lead.urgencia] || lead.urgencia;

  const presupuesto = lead.presupuesto_min && lead.presupuesto_max
    ? `$${Number(lead.presupuesto_min).toLocaleString()} - $${Number(lead.presupuesto_max).toLocaleString()}`
    : lead.presupuesto_max
      ? `Hasta $${Number(lead.presupuesto_max).toLocaleString()}`
      : 'No especificado';

  let mensaje =
    `${emoji} <b>LEAD CALIFICADO — ${lead.score}/10</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚗 <b>Busca:</b> ${escaparHTML(lead.descripcion_necesidad)}\n` +
    `💵 <b>Presupuesto:</b> ${presupuesto}\n` +
    `⏰ <b>Urgencia:</b> ${urgenciaTexto}\n` +
    `📍 <b>Ubicación:</b> ${escaparHTML(lead.ubicacion || 'Miami, FL')}\n`;

  if (lead.nombre) mensaje += `👤 <b>Nombre:</b> ${escaparHTML(lead.nombre)}\n`;
  if (lead.telefono) mensaje += `📱 <b>Teléfono:</b> ${escaparHTML(lead.telefono)}\n`;
  if (lead.email) mensaje += `✉️ <b>Email:</b> ${escaparHTML(lead.email)}\n`;

  mensaje +=
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🧠 <b>Por qué es bueno:</b> ${escaparHTML(lead.razon_score)}\n`;

  if (lead.fuente_url) {
    mensaje += `🔗 <b>Post original:</b> ${escaparHTML(lead.fuente_url)}\n`;
  }

  if (lead.mensaje_original && lead.mensaje_original !== lead.descripcion_necesidad) {
    const preview = lead.mensaje_original.slice(0, 300);
    mensaje += `\n💬 <b>Mensaje original:</b>\n<i>${escaparHTML(preview)}${lead.mensaje_original.length > 300 ? '...' : ''}</i>\n`;
  }

  mensaje += `\n<i>Fuente: ${escaparHTML(lead.fuente)} | ID: ${lead.id.slice(0, 8)}</i>`;

  return mensaje;
}

// ════════════════════════════════════
// ENTREGAR TODOS LOS LEADS CALIFICADOS
// ════════════════════════════════════

export async function entregarLeadsCalificados() {
  // Buscar leads calificados que aún no fueron entregados
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('estado', 'calificado')
    .is('entregado_en', null)
    .order('score', { ascending: false });

  if (error) throw error;

  console.log(`[Delivery] ${leads.length} leads listos para entregar`);

  if (leads.length === 0) {
    console.log('[Delivery] Sin leads nuevos para entregar');
    return 0;
  }

  let entregados = 0;

  for (const lead of leads) {
    try {
      const mensaje = formatearLead(lead);
      await enviar(mensaje);
      await db.entregarLead(lead.id);
      entregados++;

      // Pausa entre mensajes para no spamear Telegram
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[Delivery] Error entregando lead ${lead.id}:`, err.message);
    }
  }

  await db.log('lead-delivery', 'entrega_completada', { entregados });
  console.log(`[Delivery] ${entregados} leads entregados`);

  return entregados;
}

// ════════════════════════════════════
// ENTREGAR UN LEAD ESPECÍFICO
// ════════════════════════════════════

export async function entregarLead(leadId) {
  const lead = await db.getLead(leadId);
  const mensaje = formatearLead(lead);
  await enviar(mensaje);
  await db.entregarLead(leadId);
  return lead;
}
