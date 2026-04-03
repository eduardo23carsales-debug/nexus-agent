// ════════════════════════════════════
// NEXUS AGENT — agents/ads/google-ads.js
// Crea campañas de Search en Google Ads via REST API v17
// ════════════════════════════════════

import axios from 'axios';
import { preguntar, MODEL_SONNET } from '../../core/claude.js';

const API = 'https://googleads.googleapis.com/v17';
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '');
const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;

// Ubicaciones hispanas (GeoTargetConstants de Google)
const LOCATIONS = [
  'geoTargetConstants/2840', // US
  'geoTargetConstants/2484', // Mexico
  'geoTargetConstants/2170', // Colombia
  'geoTargetConstants/2032', // Argentina
  'geoTargetConstants/2152', // Chile
  'geoTargetConstants/2604', // Peru
];

// ── Obtener access token usando el refresh token ──
async function getAccessToken() {
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }, { timeout: 10000 });
  return data.access_token;
}

// ── Helper para llamadas a la API ──
async function googlePost(endpoint, body, accessToken) {
  try {
    const { data } = await axios.post(`${API}/customers/${CUSTOMER_ID}${endpoint}`, body, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': DEV_TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.details?.[0]?.errors?.[0]?.message
      || err.response?.data?.error?.message
      || err.message;
    throw new Error(`Google Ads API: ${msg}`);
  }
}

// ── Generar keywords y copy RSA con Claude ──
async function generarContenidoConIA(nombreProducto, nicho, landingUrl, precio, precioLifetime) {
  const raw = await preguntar(
    `Eres experto en Google Ads Search para el mercado hispano en EE.UU.\n\n` +
    `Producto: "${nombreProducto}"\nNicho: ${nicho}\nPrecio: $${precio} (básico) / $${precioLifetime} (lifetime)\n\n` +
    `Genera exactamente esto en JSON válido:\n` +
    `{\n` +
    `  "keywords": ["kw1","kw2",...], // 12 palabras clave en español, mezcla intención alta (quiero comprar, cómo ganar, guía para...) con long-tail. Sin comillas adicionales.\n` +
    `  "headlines": ["h1","h2",...], // 12 titulares RSA en español, MAX 30 caracteres cada uno, directos y con beneficio claro\n` +
    `  "descriptions": ["d1","d2","d3","d4"] // 4 descripciones RSA en español, MAX 90 caracteres cada una\n` +
    `}\n\n` +
    `IMPORTANTE: JSON puro, sin explicaciones, sin markdown.`,
    'Experto en Google Ads Search para mercado hispano.', 'google-ads', 2000, MODEL_SONNET
  );

  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    // Fallback mínimo si Claude no devuelve JSON válido
    return {
      keywords: [`cómo ${nicho}`, `guía ${nicho}`, `aprende ${nicho}`, `ganar dinero ${nicho}`],
      headlines: [`Guía Completa: ${nombreProducto.slice(0, 20)}`, 'Descárgala Ahora', 'Resultado Garantizado'],
      descriptions: [`Todo lo que necesitas para ${nicho}. Acceso inmediato desde $${precio}.`, `Más de 1,000 hispanos ya lo lograron. Empieza hoy con garantía de 30 días.`]
    };
  }
}

export const googleAds = {

  // ── Verificar credenciales ──
  async preflight() {
    if (!CUSTOMER_ID || !DEV_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      throw new Error('Faltan variables: GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN');
    }
    const token = await getAccessToken();
    await axios.get(`${API}/customers/${CUSTOMER_ID}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'developer-token': DEV_TOKEN }
    });
    console.log('[GoogleAds] Preflight OK');
    return true;
  },

  // ── Crear campaña completa de Search ──
  async crearCampana({ nombre, landingUrl, presupuestoDiario = 2000, nicho, precio, precioLifetime }) {
    console.log(`[GoogleAds] Creando campaña Search para: ${nombre}`);
    const presupuestoMicros = presupuestoDiario * 10000; // centavos → micros ($20 = 2,000,000,000 micros)
    const accessToken = await getAccessToken();

    // 1. Generar keywords y copy con Claude
    const contenidoIA = await generarContenidoConIA(nombre, nicho, landingUrl, precio, precioLifetime);
    console.log(`[GoogleAds] IA generó ${contenidoIA.keywords.length} keywords, ${contenidoIA.headlines.length} headlines`);

    // 2. Crear presupuesto
    const budgetRes = await googlePost('/campaignBudgets:mutate', {
      operations: [{
        create: {
          name: `Budget NEXUS | ${nombre} | ${new Date().toISOString().slice(0, 10)}`,
          amountMicros: presupuestoMicros,
          deliveryMethod: 'STANDARD'
        }
      }]
    }, accessToken);
    const budgetResourceName = budgetRes.results[0].resourceName;
    console.log(`[GoogleAds] Presupuesto creado: ${budgetResourceName}`);

    // 3. Crear campaña de Search
    const campaignRes = await googlePost('/campaigns:mutate', {
      operations: [{
        create: {
          name: `NEXUS | ${nombre} | ${new Date().toISOString().slice(0, 10)}`,
          status: 'ENABLED',
          advertisingChannelType: 'SEARCH',
          campaignBudget: budgetResourceName,
          biddingStrategyType: 'MAXIMIZE_CLICKS',
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
            targetContentNetwork: false
          }
        }
      }]
    }, accessToken);
    const campaignResourceName = campaignRes.results[0].resourceName;
    const campaignId = campaignResourceName.split('/').pop();
    console.log(`[GoogleAds] Campaña creada: ${campaignId}`);

    // 4. Agregar locations (US + hispanos)
    await googlePost('/campaignCriteria:mutate', {
      operations: LOCATIONS.map(loc => ({
        create: {
          campaign: campaignResourceName,
          location: { geoTargetConstant: loc }
        }
      }))
    }, accessToken);

    // 5. Agregar idioma español
    await googlePost('/campaignCriteria:mutate', {
      operations: [{
        create: {
          campaign: campaignResourceName,
          language: { languageConstant: 'languageConstants/1003' } // Spanish
        }
      }]
    }, accessToken);
    console.log(`[GoogleAds] Targeting: 6 países hispanos + español`);

    // 6. Crear Ad Group
    const adGroupRes = await googlePost('/adGroups:mutate', {
      operations: [{
        create: {
          name: `${nicho} — Principal`,
          campaign: campaignResourceName,
          status: 'ENABLED',
          type: 'SEARCH_STANDARD',
          cpcBidMicros: 500000 // $0.50 CPC máximo inicial
        }
      }]
    }, accessToken);
    const adGroupResourceName = adGroupRes.results[0].resourceName;
    const adGroupId = adGroupResourceName.split('/').pop();
    console.log(`[GoogleAds] Ad Group creado: ${adGroupId}`);

    // 7. Agregar keywords (broad match + exact match para las mejores)
    const topKeywords = contenidoIA.keywords.slice(0, 8);
    const keywordOps = topKeywords.flatMap(kw => [
      { create: { adGroup: adGroupResourceName, status: 'ENABLED', keyword: { text: kw, matchType: 'BROAD' } } },
      { create: { adGroup: adGroupResourceName, status: 'ENABLED', keyword: { text: kw, matchType: 'EXACT' } } }
    ]);
    await googlePost('/adGroupCriteria:mutate', { operations: keywordOps }, accessToken);
    console.log(`[GoogleAds] ${topKeywords.length * 2} keywords agregadas`);

    // 8. Crear Responsive Search Ad (RSA)
    const headlines = contenidoIA.headlines.slice(0, 10).map((text, i) => ({
      text: text.slice(0, 30),
      pinnedField: i === 0 ? 'HEADLINE_1' : undefined
    })).filter(h => h.text.length >= 2);

    const descriptions = contenidoIA.descriptions.slice(0, 4).map(text => ({
      text: text.slice(0, 90)
    })).filter(d => d.text.length >= 2);

    await googlePost('/adGroupAds:mutate', {
      operations: [{
        create: {
          adGroup: adGroupResourceName,
          status: 'ENABLED',
          ad: {
            finalUrls: [landingUrl],
            responsiveSearchAd: {
              headlines,
              descriptions,
              path1: 'Guia',
              path2: 'Ahora'
            }
          }
        }
      }]
    }, accessToken);
    console.log(`[GoogleAds] RSA Ad creada con ${headlines.length} headlines y ${descriptions.length} descriptions`);

    return {
      campaign_id: campaignId,
      adset_id: adGroupId,
      keywords: topKeywords.length
    };
  }
};
