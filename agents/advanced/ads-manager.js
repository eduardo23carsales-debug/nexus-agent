// ════════════════════════════════════
// NEXUS AGENT — agents/advanced/ads-manager.js
// Orquestador: lanza campañas automáticamente cuando se publica un producto
// ════════════════════════════════════

import { metaAds } from '../ads/meta-ads.js';
import { construirAudiencia } from '../ads/audience-builder.js';
import { db, supabase } from '../../core/database.js';
import { enviar } from '../../core/telegram.js';

const PRESUPUESTO_DIARIO = parseInt(process.env.ADS_PER_PRODUCT_DAILY || '20') * 100; // en centavos (mínimo $20 para que Meta aprenda)

export async function lanzarCampanaParaProducto(experimento) {
  console.log(`[AdsManager] Lanzando campaña para: ${experimento.nombre}`);

  try {
    // 1. Preflight — verifica token, Ad Account y Page antes de intentar publicar
    await metaAds.preflight();

    const formato = experimento.formato_ad || 'feed';

    // 2. Construir audiencia con IA (copy adaptado al formato)
    const audiencia = await construirAudiencia({
      nicho: experimento.nicho,
      nombre_producto: experimento.nombre,
      precio: experimento.precio,
      cliente_ideal: experimento.descripcion,
      problema_que_resuelve: experimento.descripcion
    }, formato);

    // 3. Lanzar campaña en Meta con formato correcto
    const campanaData = await metaAds.crearCampana({
      nombre: experimento.nombre,
      landingUrl: experimento.url,
      presupuestoDiario: PRESUPUESTO_DIARIO,
      nicho: experimento.nicho,
      audiencia,
      formato
    });

    // 4. Guardar en DB
    await supabase.from('campaigns').insert({
      experiment_id: experimento.id,
      plataforma: 'meta',
      campaign_id_externo: campanaData.campaign_id,
      adset_id: campanaData.adset_id,
      nombre: experimento.nombre,
      estado: 'activo',
      presupuesto_diario: PRESUPUESTO_DIARIO,
      gasto_total: 0,
      impresiones: 0,
      clicks: 0,
      conversiones: 0,
      revenue_generado: 0
    });

    // 5. Notificar
    const formatoLabel = formato === 'stories' ? '📱 Instagram Stories (9:16 vertical)' : '🖥 Facebook/Instagram Feed (1:1)';
    await enviar(
      `📢 <b>CAMPAÑA META ADS LANZADA</b>\n\n` +
      `<b>Producto:</b> ${experimento.nombre}\n` +
      `💰 Presupuesto: $${PRESUPUESTO_DIARIO / 100}/día\n` +
      `${formatoLabel}\n` +
      `🖼 Imágenes: ${campanaData.imagenes || 1} variantes (dolor / transformación / comunidad)\n` +
      `📝 Copy A: "${audiencia.copy}"\n` +
      (audiencia.copy_b ? `📝 Copy B: "${audiencia.copy_b}"\n` : '') +
      `🎯 Total anuncios: ${campanaData.total_ads || 1}\n` +
      `⏳ Decisión en 72 horas — Meta elige el ganador`
    );

    console.log(`[AdsManager] Campaña lanzada exitosamente`);
    return campanaData;

  } catch (err) {
    console.error('[AdsManager] Error lanzando campaña:', err.response?.data?.error?.message || err.message);
    await enviar(`⚠️ <b>Meta Ads</b>: No se pudo lanzar campaña para "${experimento.nombre}"\nError: ${err.message}`);
    return null;
  }
}
