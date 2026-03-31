// ════════════════════════════════════
// NEXUS AGENT — agents/advanced/ads-manager.js
// Orquestador: lanza campañas automáticamente cuando se publica un producto
// ════════════════════════════════════

import { metaAds } from '../ads/meta-ads.js';
import { construirAudiencia } from '../ads/audience-builder.js';
import { db, supabase } from '../../core/database.js';
import { enviar } from '../../core/telegram.js';
import { preguntar, MODEL_SONNET } from '../../core/claude.js';

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
      cliente_ideal: experimento.cliente_ideal || experimento.descripcion,
      problema_que_resuelve: experimento.problema_que_resuelve || experimento.descripcion
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
      landing_page_views: 0,
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
      `🪝 Hook A: "${audiencia.hook}"\n` +
      (audiencia.hook_b ? `🪝 Hook B: "${audiencia.hook_b}"\n` : '') +
      `📝 Copy A: "${audiencia.copy}"\n` +
      (audiencia.copy_b ? `📝 Copy B: "${audiencia.copy_b}"\n` : '') +
      (audiencia.objecion_principal ? `🚧 Objeción #1: "${audiencia.objecion_principal}"\n` : '') +
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

// ── LEADCAMP: campaña para oferta libre con URL + WhatsApp ──
export async function lanzarCampanaLeadCamp({ oferta, landingUrl, whatsappNum }) {
  console.log(`[AdsManager] LeadCamp iniciando: ${oferta.slice(0, 50)}`);

  try {
    await metaAds.preflight();

    // Generar 3 variantes de copy con Claude
    const copiesRaw = await preguntar(
      `Eres un experto en copywriting para Meta Ads dirigido al mercado hispano en EE.UU.\n\n` +
      `Oferta del cliente: "${oferta}"\n\n` +
      `Genera exactamente 3 copies cortos para anuncios de Meta Ads en español.\n` +
      `Cada copy: máximo 125 caracteres, directo, atractivo, con la oferta clara.\n` +
      `Copy 1: ángulo emocional (familia, sueño, aspiración)\n` +
      `Copy 2: ángulo precio/valor (cifras exactas, oferta concreta)\n` +
      `Copy 3: ángulo urgencia (tiempo limitado, actúa ya)\n\n` +
      `Formato EXACTO (solo esto):\n` +
      `COPY1: [texto]\nCOPY2: [texto]\nCOPY3: [texto]`,
      'Experto en publicidad digital para mercado hispano en EE.UU.',
      'leadcamp',
      600,
      MODEL_SONNET
    );

    const copies = (copiesRaw.match(/COPY\d:\s*(.+)/g) || [])
      .map(l => l.replace(/COPY\d:\s*/, '').trim())
      .filter(Boolean);

    if (copies.length === 0) copies.push(oferta.slice(0, 125));

    // Lanzar campaña en Meta
    const campanaData = await metaAds.crearCampanaLeadCamp({
      oferta,
      landingUrl,
      whatsappNum,
      copies,
      presupuestoDiario: parseInt(process.env.ADS_PER_PRODUCT_DAILY || '20') * 100
    });

    // Guardar en DB (sin experiment_id — no es un producto digital)
    try {
      await supabase.from('campaigns').insert({
        experiment_id: null,
        plataforma: 'meta',
        campaign_id_externo: campanaData.campaign_id,
        adset_id: campanaData.adset_id,
        nombre: `LEADCAMP: ${oferta.slice(0, 50)}`,
        estado: 'activo',
        presupuesto_diario: parseInt(process.env.ADS_PER_PRODUCT_DAILY || '20') * 100,
        gasto_total: 0,
        impresiones: 0,
        clicks: 0,
        conversiones: 0,
        landing_page_views: 0,
        revenue_generado: 0
      });
    } catch (dbErr) {
      console.warn('[AdsManager] LeadCamp no se guardó en DB (no crítico):', dbErr.message);
    }

    await enviar(
      `📢 <b>LEADCAMP ACTIVA</b>\n━━━━━━━━━━━━━\n` +
      `📋 <b>Oferta:</b> ${oferta.slice(0, 100)}\n` +
      `🌐 <b>Landing:</b> ${landingUrl}\n` +
      (whatsappNum ? `💬 <b>WhatsApp:</b> ${whatsappNum}\n` : '') +
      `📝 <b>${copies.length} variantes</b> de copy creadas\n` +
      `🖼 Imagen: ${campanaData.imagenes > 0 ? 'generada con IA ✅' : 'sin imagen (DALL-E falló)'}\n` +
      `💰 Presupuesto: $${parseInt(process.env.ADS_PER_PRODUCT_DAILY || '20')}/día\n` +
      `⚡ <b>Campaña ACTIVA en Meta Ads</b>`
    );

    return campanaData;

  } catch (err) {
    console.error('[AdsManager] LeadCamp error:', err.message);
    await enviar(`❌ <b>LEADCAMP falló</b>\nError: ${err.message}`);
    return null;
  }
}
