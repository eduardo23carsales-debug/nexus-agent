// Test final DSA fix — node test-meta-adset.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API = 'https://graph.facebook.com/v25.0';
const TOKEN = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const PAGE_ID = process.env.META_PAGE_ID;

async function post(endpoint, payload) {
  const url = `${API}${endpoint}?access_token=${TOKEN}`;
  try {
    const { data } = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }, timeout: 15000
    });
    return data;
  } catch (err) {
    const e = err.response?.data?.error;
    console.log('❌ Error:', JSON.stringify(err.response?.data, null, 2));
    throw new Error(`code=${e?.code} subcode=${e?.error_subcode}`);
  }
}
async function del(id) {
  try { await axios.delete(`${API}/${id}?access_token=${TOKEN}`); console.log(`🗑️  Eliminado: ${id}`); }
  catch (e) { console.log(`⚠️  No eliminado: ${id}`); }
}

console.log('=== TEST FINAL — DSA + LATAM sin ES ===\n');

// Crear campaña
const camp = await post(`/${AD_ACCOUNT}/campaigns`, {
  name: `TEST-DSA-${Date.now()}`,
  objective: 'OUTCOME_TRAFFIC',
  status: 'PAUSED',
  special_ad_categories: [],
  is_adset_budget_sharing_enabled: false
});
console.log('✅ Campaña creada:', camp.id);
await new Promise(r => setTimeout(r, 2000));

// Adset con DSA y sin ES
try {
  const adset = await post(`/${AD_ACCOUNT}/adsets`, {
    name: 'Test-DSA-adset',
    campaign_id: camp.id,
    daily_budget: 2000,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { page_id: PAGE_ID },
    dsa_beneficiary: 'Aprende Gana y Crece IA',
    dsa_payor: 'Aprende Gana y Crece IA',
    targeting: {
      age_min: 27, age_max: 52,
      genders: [1, 2],
      geo_locations: { countries: ['US', 'MX', 'CO', 'AR', 'CL', 'PE'] },
      targeting_automation: { advantage_audience: 0 }
    },
    status: 'PAUSED'
  });
  console.log('✅✅✅ ADSET CREADO:', adset.id, '— PROBLEMA RESUELTO');
  await del(adset.id);
} catch (e) {
  console.log('❌ Sigue fallando:', e.message);
}

await del(camp.id);
console.log('\n=== FIN ===');
