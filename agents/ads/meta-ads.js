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
  try {
    const { data } = await axios.post(`${API}${endpoint}`, {
      ...params,
      access_token: TOKEN
    }, { timeout: 15000 });
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    const code = err.response?.data?.error?.code || err.response?.status;
    throw new Error(`Meta API error ${code}: ${msg}`);
  }
}

async function metaGet(endpoint, params = {}) {
  try {
    const { data } = await axios.get(`${API}${endpoint}`, {
      params: { ...params, access_token: TOKEN },
      timeout: 15000
    });
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    const code = err.response?.data?.error?.code || err.response?.status;
    throw new Error(`Meta API error ${code}: ${msg}`);
  }
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
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false
    });
    console.log(`[MetaAds] Campaña creada: ${campana.id}`);

    // 2. Crear conjunto de anuncios
    const targeting = this.construirTargeting(nicho, audiencia);
    const adSet = await metaPost(`/${AD_ACCOUNT}/adsets`, {
      name: `Audiencia Principal | ${nicho}`,
      campaign_id: campana.id,
      daily_budget: presupuestoDiario,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status: 'ACTIVE'
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
    // Nota: flexible_spec con intereses requiere IDs de Meta, no strings.
    // Usamos targeting demográfico + geográfico amplio para máximo alcance.
    return {
      age_min: audiencia.edad_min || 25,
      age_max: audiencia.edad_max || 55,
      genders: [1, 2],
      geo_locations: {
        countries: ['US', 'MX', 'CO', 'AR', 'CL', 'PE', 'ES']
      },
      targeting_automation: { advantage_audience: 0 }
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
      console.warn(`[MetaAds] ⚠️ getMetricas falló para campaña ${campaignId} — los datos del dashboard mostrarán ceros. Error: ${err.response?.data?.error?.message || err.message}`);
      return { spend: 0, clicks: 0, impressions: 0, conversiones: 0, ctr: 0, error: true };
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
  },

  // ── Preflight completo antes de lanzar campaña ───────────
  async preflight() {
    const errores = [];

    // 1. Token válido
    if (!TOKEN) {
      errores.push('META_ACCESS_TOKEN no configurado');
    } else {
      try {
        await metaGet('/me', { fields: 'id,name' });
      } catch (err) {
        errores.push(`Token inválido o expirado (${err.message}) — regenera en developers.facebook.com/tools/explorer`);
      }
    }

    // 2. Ad Account accesible
    if (!AD_ACCOUNT) {
      errores.push('META_AD_ACCOUNT_ID no configurado');
    } else {
      try {
        await metaGet(`/${AD_ACCOUNT}`, { fields: 'id,name,account_status' });
      } catch (err) {
        errores.push(`Ad Account ${AD_ACCOUNT} inaccesible — verifica permisos en Business Manager`);
      }
    }

    // 3. Page accesible
    if (!PAGE_ID) {
      errores.push('META_PAGE_ID no configurado');
    } else {
      try {
        await metaGet(`/${PAGE_ID}`, { fields: 'id,name' });
      } catch (err) {
        errores.push(`Page ${PAGE_ID} inaccesible — verifica que la page esté asignada al token`);
      }
    }

    if (errores.length > 0) {
      throw new Error(`Preflight Meta fallido:\n${errores.map(e => `• ${e}`).join('\n')}`);
    }

    return { ok: true };
  }
};
