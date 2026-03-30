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
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const PIXEL_ID = process.env.META_PIXEL_ID;
const PAGE_ID = process.env.META_PAGE_ID;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

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

// ── Generar una imagen con DALL-E 3 y subirla a Meta ──────────
async function generarYSubirUnaImagen(prompt, etiqueta, size = '1024x1024') {
  const dalleRes = await axios.post(
    'https://api.openai.com/v1/images/generations',
    { model: 'dall-e-3', prompt, n: 1, size, response_format: 'b64_json' },
    { headers: { Authorization: `Bearer ${OPENAI_KEY}` }, timeout: 90000 }
  );
  const b64 = dalleRes.data.data[0].b64_json;
  const uploadRes = await metaPost(`/${AD_ACCOUNT}/adimages`, { bytes: b64 });
  const imageHash = Object.values(uploadRes.images || {})[0]?.hash;
  if (!imageHash) throw new Error('No se obtuvo hash de imagen');
  console.log(`[MetaAds] Imagen ${etiqueta} subida — hash: ${imageHash}`);
  return imageHash;
}

// ── Generar 3 variantes de imagen en paralelo ────────────────
async function generarImagenesVariantes(nombre, nicho, formato = 'feed') {
  if (!OPENAI_KEY) {
    console.warn('[MetaAds] OPENAI_API_KEY no configurado — sin imágenes');
    return [];
  }

  // Stories necesita imagen vertical 9:16, Feed usa cuadrada 1:1
  const size = formato === 'stories' ? '1024x1792' : '1024x1024';
  const orientacion = formato === 'stories' ? 'vertical 9:16 for Instagram Stories' : 'square 1:1 for Facebook Feed';

  const variantes = [
    {
      etiqueta: 'A (dolor)',
      prompt: `Eye-catching Facebook/Instagram ad image ${orientacion} for the Hispanic market in USA. Product: "${nombre}". Niche: ${nicho}. PAIN ANGLE: show a stressed, frustrated Hispanic person facing their biggest problem. Urgent, tense mood. Bold red and dark orange colors with high contrast. IMPORTANT: Add a bold white text overlay in Spanish with a short 3-5 word pain hook (e.g. "¿Cansado de no avanzar?"). Text must be large, readable, centered. Photorealistic style, professional ad quality.`
    },
    {
      etiqueta: 'B (transformación)',
      prompt: `Eye-catching Facebook/Instagram ad image ${orientacion} for the Hispanic market in USA. Product: "${nombre}". Niche: ${nicho}. TRANSFORMATION ANGLE: show a confident, successful Hispanic person celebrating real results — smiling, holding money or achievement. Optimistic mood. Bold green and gold colors with high contrast. IMPORTANT: Add a bold white text overlay in Spanish with a short 3-5 word success hook (e.g. "Tu momento es ahora"). Text must be large, readable, centered. Photorealistic style, professional ad quality.`
    },
    {
      etiqueta: 'C (comunidad)',
      prompt: `Eye-catching Facebook/Instagram ad image ${orientacion} for the Hispanic market in USA. Product: "${nombre}". Niche: ${nicho}. SOCIAL PROOF ANGLE: show a group of 3-4 happy Latinos celebrating success together — team feeling, authentic community. Trust and warmth. Bold blue and white colors with high contrast. IMPORTANT: Add a bold white text overlay in Spanish with a short 3-5 word social proof hook (e.g. "Miles ya lo lograron"). Text must be large, readable, centered. Photorealistic style, professional ad quality.`
    }
  ];

  console.log(`[MetaAds] Generando 3 variantes ${size} en paralelo con DALL-E 3...`);
  const results = await Promise.allSettled(
    variantes.map(v => generarYSubirUnaImagen(v.prompt, v.etiqueta, size))
  );

  const hashes = results
    .map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.warn(`[MetaAds] ⚠️ Variante ${variantes[i].etiqueta} falló: ${r.reason?.message}`);
      return null;
    })
    .filter(Boolean);

  console.log(`[MetaAds] ${hashes.length}/3 imágenes ${size} generadas OK`);
  return hashes;
}

export const metaAds = {

  // ── Crear campaña completa con variantes A/B ────────────
  async crearCampana({ nombre, landingUrl, presupuestoDiario = 500, nicho, audiencia, formato = 'feed' }) {
    console.log(`[MetaAds] v9 — Campaña A/B para: ${nombre} | formato: ${formato} | PAGE_ID=${PAGE_ID}`);

    // 1. Generar 3 variantes de imagen en paralelo con el tamaño correcto
    const imageHashes = await generarImagenesVariantes(nombre, nicho, formato);

    // 2. Crear campaña con CBO — presupuesto en campaña, Meta distribuye entre adsets
    const campana = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
      name: `NEXUS | ${nombre} | ${new Date().toISOString().slice(0,10)}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'ACTIVE',
      special_ad_categories: [],
      daily_budget: presupuestoDiario,        // CBO: presupuesto total en la campaña
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP' // Meta distribuye al adset ganador
    });
    console.log(`[MetaAds] Campaña CBO creada: ${campana.id} | $${presupuestoDiario/100}/día`);
    await new Promise(r => setTimeout(r, 3000));

    const targeting = this.construirTargeting(nicho, audiencia, formato);
    const adsetBase = {
      campaign_id: campana.id,
      // Sin daily_budget — el presupuesto lo controla CBO a nivel campaña
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      promoted_object: { page_id: PAGE_ID },
      dsa_beneficiary: 'Aprende Gana y Crece IA',
      dsa_payor: 'Aprende Gana y Crece IA',
      targeting,
      status: 'ACTIVE'
    };

    // 3. Adset A — copy del dolor (principal)
    console.log(`[MetaAds] Creando adset A (copy dolor)...`);
    const adSetA = await metaPost(`/${AD_ACCOUNT}/adsets`, {
      ...adsetBase,
      name: `Copy-A Dolor | ${nicho}`
    });
    console.log(`[MetaAds] Adset A creado: ${adSetA.id}`);

    // 4. Ads en adset A — uno por cada variante de imagen
    const adsA = [];
    const etiquetas = ['Dolor', 'Transformacion', 'Comunidad'];
    for (let i = 0; i < imageHashes.length; i++) {
      try {
        await new Promise(r => setTimeout(r, 1000));
        const linkData = {
          link: landingUrl,
          message: audiencia.copy,
          name: audiencia.headline || nombre,   // headline generado por IA, más clickable
          description: audiencia.descripcion,
          call_to_action: { type: 'GET_OFFER', value: { link: landingUrl } },
          image_hash: imageHashes[i]
        };
        const creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
          name: `Creative A-${etiquetas[i]} | ${nombre}`,
          object_story_spec: { page_id: PAGE_ID, link_data: linkData }
        });
        const ad = await metaPost(`/${AD_ACCOUNT}/ads`, {
          name: `Ad A-${etiquetas[i]} | ${nombre}`,
          adset_id: adSetA.id,
          creative: { creative_id: creative.id },
          status: 'ACTIVE'
        });
        adsA.push(ad.id);
        console.log(`[MetaAds] Ad A-${etiquetas[i]} creado: ${ad.id}`);
      } catch (e) {
        console.warn(`[MetaAds] ⚠️ Ad A-${etiquetas[i]} falló: ${e.message}`);
      }
    }

    // 5. Adset B — copy de transformación (A/B test) con imagen principal
    let adSetBId = null;
    if (audiencia.copy_b && imageHashes.length > 0) {
      try {
        await new Promise(r => setTimeout(r, 2000));
        console.log(`[MetaAds] Creando adset B (copy transformación)...`);
        const adSetB = await metaPost(`/${AD_ACCOUNT}/adsets`, {
          ...adsetBase,
          name: `Copy-B Transformacion | ${nicho}`
        });
        adSetBId = adSetB.id;
        console.log(`[MetaAds] Adset B creado: ${adSetB.id}`);

        await new Promise(r => setTimeout(r, 1000));
        const linkDataB = {
          link: landingUrl,
          message: audiencia.copy_b,
          name: audiencia.headline || nombre,
          description: audiencia.descripcion,
          call_to_action: { type: 'GET_OFFER', value: { link: landingUrl } },
          image_hash: imageHashes[0]
        };
        const creativeB = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
          name: `Creative B-Transformacion | ${nombre}`,
          object_story_spec: { page_id: PAGE_ID, link_data: linkDataB }
        });
        const adB = await metaPost(`/${AD_ACCOUNT}/ads`, {
          name: `Ad B-Transformacion | ${nombre}`,
          adset_id: adSetB.id,
          creative: { creative_id: creativeB.id },
          status: 'ACTIVE'
        });
        console.log(`[MetaAds] Ad B creado: ${adB.id}`);
      } catch (e) {
        console.warn(`[MetaAds] ⚠️ Adset B falló (no crítico): ${e.message}`);
      }
    }

    const totalAds = adsA.length + (adSetBId ? 1 : 0);
    console.log(`[MetaAds] Campaña lista — ${totalAds} anuncios, ${imageHashes.length} imágenes, ${adSetBId ? '2 copies A/B' : '1 copy'}`);

    return {
      campaign_id: campana.id,
      adset_id: adSetA.id,       // principal (usado por el validator para escalar)
      adset_b_id: adSetBId,
      total_ads: totalAds,
      imagenes: imageHashes.length
    };
  },

  // ── Construir targeting por nicho y formato ──────────────
  construirTargeting(nicho, audiencia, formato = 'feed') {
    const base = {
      age_min: audiencia.edad_min || 25,
      age_max: audiencia.edad_max || 55,
      genders: [1, 2],
      geo_locations: {
        countries: ['US']
      },
      // Idioma español — filtra solo hispanohablantes en USA
      locales: [6],
      // Advantage+ Audience — Meta usa su propio ML para encontrar compradores
      // Es el método de mejor rendimiento actual (2025)
      targeting_automation: { advantage_audience: 1 }
    };

    // Intereses como sugerencias para Advantage+ (Meta los usa como punto de partida)
    if (audiencia.intereses?.length > 0) {
      base.flexible_spec = [{
        interests: audiencia.intereses.map(i => ({ name: i }))
      }];
    }

    if (formato === 'stories') {
      // Instagram Stories — placement específico, CPC $1.83 vs $3.35 Feed
      base.publisher_platforms = ['instagram'];
      base.instagram_positions = ['story'];
    }
    // Feed: sin restricción de placement → Meta optimiza en todos los placements

    return base;
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

  // ── Verificar que una campaña existe y su estado en Meta ─
  async verificarEstadoCampana(campaignId) {
    try {
      const data = await metaGet(`/${campaignId}`, {
        fields: 'id,status,effective_status'
      });
      return { existe: true, status: data.status, effective_status: data.effective_status };
    } catch (err) {
      return { existe: false, error: err.message };
    }
  },

  // ── Pausar campaña ───────────────────────────────────────
  async pausarCampana(campaignId) {
    await metaPost(`/${campaignId}`, { status: 'PAUSED' });
    console.log(`[MetaAds] Campaña pausada: ${campaignId}`);
  },

  // ── Activar campaña ──────────────────────────────────────
  async activarCampana(campaignId) {
    await metaPost(`/${campaignId}`, { status: 'ACTIVE' });
    console.log(`[MetaAds] Campaña activada: ${campaignId}`);
  },

  // ── Escalar presupuesto ──────────────────────────────────
  async escalarPresupuesto(adSetId, nuevoPresupuesto) {
    await metaPost(`/${adSetId}`, { daily_budget: nuevoPresupuesto });
    console.log(`[MetaAds] Presupuesto actualizado: $${nuevoPresupuesto / 100}/día`);
  },

  // ── Campaña LeadCamp — oferta libre con URL + WhatsApp ──
  async crearCampanaLeadCamp({ oferta, landingUrl, whatsappNum, copies, presupuestoDiario = 2000 }) {
    console.log(`[MetaAds] LeadCamp: ${oferta.slice(0, 50)}`);

    // 1. Generar imagen con DALL-E para la oferta
    let imageHash = null;
    if (OPENAI_KEY) {
      try {
        imageHash = await generarYSubirUnaImagen(
          `Professional advertising image for this offer targeting Hispanic market in USA: "${oferta}". Eye-catching, professional, Miami Florida vibe. No text in the image.`,
          'LeadCamp', '1024x1024'
        );
      } catch (e) {
        console.warn('[MetaAds] LeadCamp imagen falló (no crítico):', e.message);
      }
    }

    // 2. Crear campaña CBO
    const campana = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
      name: `LEADCAMP | ${oferta.slice(0, 40)} | ${new Date().toISOString().slice(0, 10)}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'ACTIVE',
      special_ad_categories: [],
      daily_budget: presupuestoDiario,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
    });
    console.log(`[MetaAds] LeadCamp campaña creada: ${campana.id}`);
    await new Promise(r => setTimeout(r, 3000));

    // 3. Construir URL destino (WhatsApp si hay número, si no la landing)
    const waNum = whatsappNum ? whatsappNum.replace(/\D/g, '') : null;
    const waUrl = waNum
      ? `https://wa.me/${waNum}?text=${encodeURIComponent(`Hola, vi tu anuncio: "${oferta.slice(0, 60)}"... Me interesa más información`)}`
      : landingUrl;

    const targeting = {
      age_min: 25,
      age_max: 60,
      genders: [1, 2],
      geo_locations: { countries: ['US'] },
      targeting_automation: { advantage_audience: 0 }
    };

    const adsetBase = {
      campaign_id: campana.id,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      promoted_object: { page_id: PAGE_ID },
      dsa_beneficiary: 'Aprende Gana y Crece IA',
      dsa_payor: 'Aprende Gana y Crece IA',
      targeting,
      status: 'ACTIVE'
    };

    // 4. Crear un adset + ad por cada copy
    const adsCreados = [];
    const etiquetas = ['Emocional', 'Precio', 'Urgencia'];
    for (let i = 0; i < copies.length; i++) {
      try {
        await new Promise(r => setTimeout(r, 2000));
        const adset = await metaPost(`/${AD_ACCOUNT}/adsets`, {
          ...adsetBase,
          name: `LeadCamp Copy-${etiquetas[i] || i + 1}`
        });

        const linkData = {
          link: waUrl,
          message: copies[i],
          name: oferta.slice(0, 40),
          description: `🌐 ${landingUrl}`,
          call_to_action: { type: 'LEARN_MORE', value: { link: waUrl } }
        };
        if (imageHash) linkData.image_hash = imageHash;

        const creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
          name: `LeadCamp Creative-${etiquetas[i] || i + 1}`,
          object_story_spec: { page_id: PAGE_ID, link_data: linkData }
        });
        const ad = await metaPost(`/${AD_ACCOUNT}/ads`, {
          name: `LeadCamp Ad-${etiquetas[i] || i + 1}`,
          adset_id: adset.id,
          creative: { creative_id: creative.id },
          status: 'ACTIVE'
        });
        adsCreados.push({ adset_id: adset.id, ad_id: ad.id });
        console.log(`[MetaAds] LeadCamp Ad-${i + 1} creado: ${ad.id}`);
      } catch (e) {
        console.warn(`[MetaAds] ⚠️ LeadCamp Copy-${i + 1} falló: ${e.message}`);
      }
    }

    return {
      campaign_id: campana.id,
      adset_id: adsCreados[0]?.adset_id || null,
      total_ads: adsCreados.length,
      imagenes: imageHash ? 1 : 0
    };
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
