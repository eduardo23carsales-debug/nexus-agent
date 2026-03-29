// ════════════════════════════════════
// NEXUS AGENT — agents/ads/campaign-validator.js
// Monitorea métricas y decide escalar/pausar/matar campañas
// ════════════════════════════════════

import { metaAds } from './meta-ads.js';
import { db, supabase } from '../../core/database.js';
import { enviar } from '../../core/telegram.js';

const MIN_ROAS_ESCALAR = 1.5;
const MAX_ROAS_MATAR = 0.3;
const GASTO_MAX_SIN_VENTAS = 15; // $15 sin ventas → matar
const HORAS_DECISION = 72;

export async function validarCampanas() {
  console.log('[CampaignValidator] Revisando campañas activas...');

  const { data: campanas } = await supabase
    .from('campaigns')
    .select('*, experiments(nombre, precio)')
    .in('estado', ['activo', 'escalando'])
    .eq('plataforma', 'meta');

  if (!campanas?.length) {
    console.log('[CampaignValidator] No hay campañas activas');
    return;
  }

  for (const campana of campanas) {
    try {
      await evaluarCampana(campana);
    } catch (err) {
      console.error(`[CampaignValidator] Error en campaña ${campana.id}:`, err.message);
    }
  }
}

async function evaluarCampana(campana) {
  const metricas = await metaAds.getMetricas(campana.campaign_id_externo);
  const precio = campana.experiments?.precio || 47;

  const revenue = metricas.conversiones * precio;
  const roas = metricas.spend > 0 ? revenue / metricas.spend : 0;
  const cpa = metricas.conversiones > 0 ? metricas.spend / metricas.conversiones : 0;
  const horasActiva = (Date.now() - new Date(campana.fecha_inicio).getTime()) / (1000 * 60 * 60);

  // Actualizar métricas en DB
  await supabase.from('campaigns').update({
    gasto_total: metricas.spend,
    impresiones: metricas.impressions,
    clicks: metricas.clicks,
    conversiones: metricas.conversiones,
    revenue_generado: revenue,
    ctr: metricas.ctr,
    cpa,
    roas,
    fecha_ultimo_update: new Date().toISOString()
  }).eq('id', campana.id);

  console.log(`[CampaignValidator] ${campana.nombre} — Gasto: $${metricas.spend} | ROAS: ${roas.toFixed(2)}x | Ventas: ${metricas.conversiones}`);

  // Solo tomar decisiones después de 72h o si ya gastó mucho sin ventas
  const listo_para_decidir = horasActiva >= HORAS_DECISION;
  const gasto_sin_ventas = metricas.spend >= GASTO_MAX_SIN_VENTAS && metricas.conversiones === 0;

  if (!listo_para_decidir && !gasto_sin_ventas) {
    // Actualización de progreso cada 6h
    await enviar(
      `📊 <b>UPDATE CAMPAÑA</b>\n\n` +
      `<b>Producto:</b> ${campana.nombre}\n` +
      `💰 Gastado: $${metricas.spend.toFixed(2)}\n` +
      `👆 Clicks: ${metricas.clicks} | CTR: ${metricas.ctr.toFixed(2)}%\n` +
      `🛒 Ventas: ${metricas.conversiones}\n` +
      `📈 ROAS: ${roas.toFixed(2)}x\n` +
      `⏳ Decisión en: ${Math.max(0, HORAS_DECISION - horasActiva).toFixed(0)}h`
    );
    return;
  }

  // ── DECISIONES ──────────────────────────────────────────

  if (gasto_sin_ventas) {
    // Matar — gastó $15+ sin ninguna venta
    await metaAds.pausarCampana(campana.campaign_id_externo);
    await supabase.from('campaigns').update({
      estado: 'muerto',
      decision: 'matar',
      razon_decision: `Gastó $${metricas.spend} sin ninguna venta`,
      fecha_decision: new Date().toISOString()
    }).eq('id', campana.id);

    await enviar(
      `💀 <b>CAMPAÑA PAUSADA</b>\n\n` +
      `<b>Producto:</b> ${campana.nombre}\n` +
      `💸 Gastado: $${metricas.spend.toFixed(2)} sin ventas\n` +
      `🔴 Decisión: Campaña detenida\n` +
      `💡 El nicho necesita mejor copy o diferente audiencia`
    );

  } else if (roas >= MIN_ROAS_ESCALAR) {
    // Escalar — ROAS positivo
    const nuevoPresupuesto = Math.min(campana.presupuesto_diario * 2, 5000); // máx $50/día
    await metaAds.escalarPresupuesto(campana.campaign_id_externo, nuevoPresupuesto); // CBO: escalar en campaña
    await supabase.from('campaigns').update({
      estado: 'escalando',
      presupuesto_diario: nuevoPresupuesto,
      decision: 'escalar',
      razon_decision: `ROAS ${roas.toFixed(2)}x > ${MIN_ROAS_ESCALAR}x mínimo`,
      fecha_decision: new Date().toISOString()
    }).eq('id', campana.id);

    await enviar(
      `🚀 <b>ESCALANDO CAMPAÑA</b>\n\n` +
      `<b>Producto:</b> ${campana.nombre}\n` +
      `📈 ROAS: ${roas.toFixed(2)}x\n` +
      `💰 Revenue: $${revenue.toFixed(2)}\n` +
      `⬆️ Presupuesto: $${campana.presupuesto_diario/100}/día → $${nuevoPresupuesto/100}/día`
    );

  } else if (roas < MAX_ROAS_MATAR) {
    // Matar — ROAS muy bajo
    await metaAds.pausarCampana(campana.campaign_id_externo);
    await supabase.from('campaigns').update({
      estado: 'muerto',
      decision: 'matar',
      razon_decision: `ROAS ${roas.toFixed(2)}x < ${MAX_ROAS_MATAR}x mínimo`,
      fecha_decision: new Date().toISOString()
    }).eq('id', campana.id);

    await enviar(
      `💀 <b>CAMPAÑA PAUSADA</b>\n\n` +
      `<b>Producto:</b> ${campana.nombre}\n` +
      `📉 ROAS: ${roas.toFixed(2)}x — no rentable\n` +
      `💸 Gasto: $${metricas.spend.toFixed(2)} | Revenue: $${revenue.toFixed(2)}\n` +
      `🔴 Decisión: Campaña detenida`
    );

  } else {
    // Borderline — mantener y reportar
    await enviar(
      `⚠️ <b>CAMPAÑA BORDERLINE</b>\n\n` +
      `<b>Producto:</b> ${campana.nombre}\n` +
      `📊 ROAS: ${roas.toFixed(2)}x (necesita > ${MIN_ROAS_ESCALAR}x)\n` +
      `💰 Gasto: $${metricas.spend.toFixed(2)} | Revenue: $${revenue.toFixed(2)}\n` +
      `⏳ Dando 48h más para mejorar`
    );
  }
}
