// ════════════════════════════════════
// NEXUS AGENT — agents/ads/meta-ads.js
// Crea y gestiona campañas en Meta Ads via Marketing API
// ════════════════════════════════════

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API = 'https://graph.facebook.com/v25.0';
const TOKEN = process.env.META_ACCESS_TOKEN?.trim();
const PIXEL_ID_CLEAN = process.env.META_PIXEL_ID?.trim();
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID; // act_XXXXXXXXX
const PIXEL_ID = process.env.META_PIXEL_ID;
const PAGE_ID = process.env.META_PAGE_ID;

// ── Helper para llamadas a la API ────────────────────────────
async function metaPost(endpoint, params) {
  try {
    // JSON body + access_token como query param (igual que Graph API Explorer)
    const url = `${API}${endpoint}?access_token=${TOKEN}`;
    const { data } = await axios.post(url, params, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
    return data;
  } catch (err) {
    const error = err.response?.data?.error;
    const msg = error?.message || err.message;
    const code = error?.code || err.response?.status;
    const subcode = error?.error_subcode || '';
    const userMsg = error?.error_user_msg || '';
    console.error(`[MetaAds] Error en ${endpoint}: code=${code} subcode=${subcode} msg=${msg} detail=${userMsg}`);
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
    console.log(`[MetaAds] v2 — Creando campaña para: ${nombre} | PAGE_ID=${PAGE_ID} | AD_ACCOUNT=${AD_ACCOUNT}`);

    // 1. Crear campaña
    const campana = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
      name: `NEXUS | ${nombre} | ${new Date().toISOString().slice(0,10)}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false
    });
    console.log(`[MetaAds] Campaña creada: ${campana.id}`);

    // 2. Crear conjunto de anuncios
    console.log(`[MetaAds] Paso 2: creando adset... PAGE_ID="${PAGE_ID}" PIXEL_ID="${PIXEL_ID_CLEAN}" presupuesto=${presupuestoDiario}`);
    const targeting = this.construirTargeting(nicho, audiencia);
    const adsetPayload = {
      name: `Audiencia Principal | ${nicho}`,
      campaign_id: campana.id,
      daily_budget: presupuestoDiario,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      promoted_object: { page_id: PAGE_ID },
      targeting,
      status: 'PAUSED'
    };
    console.log(`[MetaAds] Adset payload:`, JSON.stringify(adsetPayload));
    let adSet;
    try {
      adSet = await metaPost(`/${AD_ACCOUNT}/adsets`, adsetPayload);
      console.log(`[MetaAds] Paso 2 OK: Ad set creado: ${adSet.id}`);
    } catch (e) {
      console.error(`[MetaAds] Paso 2 FALLÓ: ${e.message}`);
      throw e;
    }

    // 3. Crear creative
    console.log(`[MetaAds] Paso 3: creando creative...`);
    let creative;
    try {
      creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
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
      console.log(`[MetaAds] Paso 3 OK: Creative creado: ${creative.id}`);
    } catch (e) {
      console.error(`[MetaAds] Paso 3 FALLÓ: ${e.message}`);
      throw e;
    }

    // 4. Crear anuncio
    console.log(`[MetaAds] Paso 4: creando ad...`);
    let ad;
    try {
      ad = await metaPost(`/${AD_ACCOUNT}/ads`, {
        name: `Anuncio | ${nombre}`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: 'ACTIVE'
      });
      console.log(`[MetaAds] Paso 4 OK: Anuncio creado: ${ad.id}`);
    } catch (e) {
      console.error(`[MetaAds] Paso 4 FALLÓ: ${e.message}`);
      throw e;
    }

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
