// ════════════════════════════════════
// NEXUS AGENT — agents/ads/tiktok-ads.js
// Crea y gestiona campañas en TikTok Ads via Marketing API v1.3
// ════════════════════════════════════

import axios from 'axios';

const API = 'https://business-api.tiktok.com/open_api/v1.3';
const TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const ADVERTISER_ID = process.env.TIKTOK_ADVERTISER_ID;
const PIXEL_ID = process.env.TIKTOK_PIXEL_ID;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// GeoNames IDs que usa TikTok para targeting
const LOCATION_IDS = ['6252001', '3996063', '3686110', '3865483', '3895114', '3932488'];
// US=6252001 MX=3996063 CO=3686110 AR=3865483 CL=3895114 PE=3932488

async function tiktokPost(endpoint, body) {
  try {
    const { data } = await axios.post(`${API}${endpoint}`, body, {
      headers: {
        'Access-Token': TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    if (data.code !== 0) {
      throw new Error(`TikTok error ${data.code}: ${data.message}`);
    }
    return data.data;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    throw new Error(`TikTok API: ${msg}`);
  }
}

async function tiktokGet(endpoint, params = {}) {
  try {
    const { data } = await axios.get(`${API}${endpoint}`, {
      headers: { 'Access-Token': TOKEN },
      params: { advertiser_id: ADVERTISER_ID, ...params },
      timeout: 15000
    });
    if (data.code !== 0) throw new Error(`TikTok error ${data.code}: ${data.message}`);
    return data.data;
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

// ── Genera imagen con DALL-E 3 y la sube a TikTok ──
async function generarYSubirImagen(nombre, nicho, hook) {
  if (!OPENAI_KEY) {
    console.warn('[TikTokAds] OPENAI_API_KEY no configurado — sin imagen');
    return null;
  }

  try {
    const prompt = `Vibrant TikTok-style square 1:1 ad image for the Hispanic market in USA. ` +
      `Product: "${nombre}". Niche: ${nicho}. ` +
      `Show a confident, successful Latino person achieving real results related to this niche. ` +
      `Energetic, bold colors (purple, orange, gold), high contrast, professional advertising quality. ` +
      `NO TEXT, NO WORDS, NO LETTERS anywhere — only the scene.`;

    // Usamos URL directa de DALL-E para poder pasarla a TikTok
    const dalleRes = await axios.post(
      'https://api.openai.com/v1/images/generations',
      { model: 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'url' },
      { headers: { Authorization: `Bearer ${OPENAI_KEY}` }, timeout: 90000 }
    );
    const imageUrl = dalleRes.data.data[0].url;
    console.log('[TikTokAds] Imagen generada con DALL-E 3, subiendo a TikTok...');

    // Subir a TikTok via URL (TikTok la descarga directamente)
    const uploadData = await tiktokPost('/file/image/ad/upload/', {
      advertiser_id: ADVERTISER_ID,
      upload_type: 'UPLOAD_BY_URL',
      image_url: imageUrl
    });

    console.log(`[TikTokAds] Imagen subida OK — id: ${uploadData.image_id}`);
    return uploadData.image_id;

  } catch (err) {
    console.warn(`[TikTokAds] Error con imagen (no crítico): ${err.message}`);
    return null;
  }
}

export const tiktokAds = {

  // ── Verifica credenciales antes de intentar publicar ──
  async preflight() {
    if (!TOKEN || !ADVERTISER_ID) {
      throw new Error('TIKTOK_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID no configurados en Railway');
    }
    await tiktokGet('/advertiser/info/', { advertiser_ids: JSON.stringify([ADVERTISER_ID]) });
    console.log('[TikTokAds] Preflight OK');
    return true;
  },

  // ── Crea campaña completa: Campaign → AdGroup → Ad ──
  async crearCampana({ nombre, landingUrl, presupuestoDiario = 2000, nicho, audiencia }) {
    console.log(`[TikTokAds] Creando campaña para: ${nombre}`);
    const presupuesto = Math.max(presupuestoDiario / 100, 20); // min $20/día en TikTok

    // 1. Generar y subir imagen con DALL-E 3
    const imageId = await generarYSubirImagen(nombre, nicho, audiencia?.hook);
    if (!imageId) throw new Error('No se pudo generar imagen — TikTok requiere imagen para image ads');

    // 2. Crear campaña (objetivo TRAFFIC — funciona sin pixel instalado)
    const campaign = await tiktokPost('/campaign/create/', {
      advertiser_id: ADVERTISER_ID,
      campaign_name: `NEXUS | ${nombre} | ${new Date().toISOString().slice(0, 10)}`,
      campaign_type: 'REGULAR_CAMPAIGN',
      objective_type: 'TRAFFIC',
      budget_mode: 'BUDGET_MODE_DAY',
      budget: presupuesto,
      special_industries: []
    });
    console.log(`[TikTokAds] Campaña creada: ${campaign.campaign_id}`);
    await new Promise(r => setTimeout(r, 2000));

    // 3. Crear Ad Group con targeting hispano
    const adGroupBody = {
      advertiser_id: ADVERTISER_ID,
      campaign_id: campaign.campaign_id,
      adgroup_name: `Hispanos ES | ${nicho}`,
      placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
      location_ids: LOCATION_IDS,
      age_groups: ['AGE_25_34', 'AGE_35_44', 'AGE_45_54'],
      languages: ['es'],
      budget_mode: 'BUDGET_MODE_DAY',
      budget: presupuesto,
      schedule_type: 'SCHEDULE_FROM_NOW',
      optimization_goal: 'CLICK',
      billing_event: 'CPC',
      bid_type: 'BID_TYPE_NO_BID',
      open_url: landingUrl
    };
    if (PIXEL_ID) adGroupBody.pixel_id = PIXEL_ID;

    const adGroup = await tiktokPost('/adgroup/create/', adGroupBody);
    console.log(`[TikTokAds] Ad Group creado: ${adGroup.adgroup_id}`);
    await new Promise(r => setTimeout(r, 2000));

    // 4. Crear Ad con imagen
    const adText = (audiencia?.hook || audiencia?.copy || nombre).slice(0, 100);
    const ad = await tiktokPost('/ad/create/', {
      advertiser_id: ADVERTISER_ID,
      campaign_id: campaign.campaign_id,
      adgroup_id: adGroup.adgroup_id,
      creatives: [{
        ad_name: `NEXUS | ${nombre}`,
        ad_format: 'SINGLE_IMAGE',
        ad_text: adText,
        call_to_action: 'SHOP_NOW',
        image_ids: [imageId],
        landing_page_url: landingUrl,
        display_name: 'Aprende Gana y Crece IA'
      }]
    });
    const adId = Array.isArray(ad.ad_ids) ? ad.ad_ids[0] : ad.ad_id;
    console.log(`[TikTokAds] Ad creado: ${adId}`);

    return {
      campaign_id: campaign.campaign_id,
      adset_id: adGroup.adgroup_id,
      ad_id: adId,
      imagen: true
    };
  },

  // ── Obtiene métricas de una campaña ──
  async getMetricas(campaignId) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await tiktokPost('/report/integrated/get/', {
        advertiser_id: ADVERTISER_ID,
        report_type: 'BASIC',
        dimensions: ['campaign_id'],
        metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc'],
        start_date: today,
        end_date: today,
        filtering: [{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify([campaignId]) }]
      });
      const row = data?.list?.[0]?.metrics;
      return {
        gasto: parseFloat(row?.spend || 0),
        impresiones: parseInt(row?.impressions || 0),
        clicks: parseInt(row?.clicks || 0),
        ctr: parseFloat(row?.ctr || 0),
        cpc: parseFloat(row?.cpc || 0)
      };
    } catch (err) {
      console.warn(`[TikTokAds] Error métricas: ${err.message}`);
      return { gasto: 0, impresiones: 0, clicks: 0 };
    }
  }
};
