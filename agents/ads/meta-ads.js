// ════════════════════════════════════
// NEXUS AGENT — agents/ads/meta-ads.js
// Crea y gestiona campañas en Meta Ads via Marketing API
// ════════════════════════════════════

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID; // act_XXXXXXXXX
const PIXEL_ID = process.env.META_PIXEL_ID;
const PAGE_ID = process.env.META_PAGE_ID;

// ── Helper para llamadas a la API ────────────────────────────
async function metaPost(endpoint, params) {
  const { data } = await axios.post(`${API}${endpoint}`, {
    ...params,
    access_token: TOKEN
  });
  return data;
}

async function metaGet(endpoint, params = {}) {
  const { data } = await axios.get(`${API}${endpoint}`, {
    params: { ...params, access_token: TOKEN }
  });
  return data;
}

export const metaAds = {

  // ── Crear campaña completa para un producto ──────────────
  async crearCampana({ nombre, landingUrl, presupuestoDiario = 500, nicho, audiencia }) {
    console.log(`[MetaAds] Creando campaña para: ${nombre}`);

    // 1. Crear campaña
    const campana = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
      name: `NEXUS | ${nombre} | ${new Date().toISOString().slice(0,10)}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'ACTIVE',
      special_ad_categories: []
    });
    console.log(`[MetaAds] Campaña creada: ${campana.id}`);

    // 2. Crear conjunto de anuncios
    const targeting = this.construirTargeting(nicho, audiencia);
    const adSet = await metaPost(`/${AD_ACCOUNT}/adsets`, {
      name: `Audiencia Principal | ${nicho}`,
      campaign_id: campana.id,
      daily_budget: presupuestoDiario, // en centavos: 500 = $5
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting,
      status: 'ACTIVE',
      start_time: new Date().toISOString()
    });
    console.log(`[MetaAds] Ad set creado: ${adSet.id}`);

    // 3. Crear creative
    const creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
      name: `Creative | ${nombre}`,
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          link: landingUrl,
          message: audiencia.copy,
          name: nombre,
          description: audiencia.descripcion,
          call_to_action: {
            type: 'LEARN_MORE',
            value: { link: landingUrl }
          }
        }
      }
    });
    console.log(`[MetaAds] Creative creado: ${creative.id}`);

    // 4. Crear anuncio
    const ad = await metaPost(`/${AD_ACCOUNT}/ads`, {
      name: `Anuncio | ${nombre}`,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'ACTIVE'
    });
    console.log(`[MetaAds] Anuncio creado: ${ad.id}`);

    return {
      campaign_id: campana.id,
      adset_id: adSet.id,
      creative_id: creative.id,
      ad_id: ad.id
    };
  },

  // ── Construir targeting por nicho ────────────────────────
  construirTargeting(nicho, audiencia) {
    return {
      age_min: audiencia.edad_min || 25,
      age_max: audiencia.edad_max || 50,
      genders: [1, 2],
      locales: [236], // español
      geo_locations: {
        countries: ['US', 'MX', 'CO', 'AR', 'CL', 'PE', 'ES'],
        location_types: ['home', 'recent']
      },
      flexible_spec: [{
        interests: (audiencia.intereses || []).map(i => ({ name: i }))
      }]
    };
  },

  // ── Obtener métricas de una campaña ─────────────────────
  async getMetricas(campaignId) {
    try {
      const { data } = await metaGet(`/${campaignId}/insights`, {
        fields: 'spend,impressions,clicks,ctr,cpc,actions',
        date_preset: 'lifetime'
      });

      if (!data?.length) return { spend: 0, clicks: 0, impressions: 0, conversiones: 0, ctr: 0 };

      const m = data[0];
      const compras = m.actions?.find(a => a.action_type === 'purchase')?.value || 0;

      return {
        spend: parseFloat(m.spend || 0),
        clicks: parseInt(m.clicks || 0),
        impressions: parseInt(m.impressions || 0),
        conversiones: parseInt(compras),
        ctr: parseFloat(m.ctr || 0)
      };
    } catch (err) {
      console.error('[MetaAds] Error obteniendo métricas:', err.response?.data?.error?.message || err.message);
      return { spend: 0, clicks: 0, impressions: 0, conversiones: 0, ctr: 0 };
    }
  },

  // ── Pausar campaña ───────────────────────────────────────
  async pausarCampana(campaignId) {
    await metaPost(`/${campaignId}`, { status: 'PAUSED' });
    console.log(`[MetaAds] Campaña pausada: ${campaignId}`);
  },

  // ── Escalar presupuesto ──────────────────────────────────
  async escalarPresupuesto(adSetId, nuevoPresupuesto) {
    await metaPost(`/${adSetId}`, { daily_budget: nuevoPresupuesto });
    console.log(`[MetaAds] Presupuesto actualizado: $${nuevoPresupuesto / 100}/día`);
  },

  // ── Verificar que el token funcione ─────────────────────
  async ping() {
    if (!TOKEN) throw new Error('META_ACCESS_TOKEN no configurado');
    const data = await metaGet('/me', { fields: 'id,name' });
    return { ok: true, user: data.name };
  }
};
