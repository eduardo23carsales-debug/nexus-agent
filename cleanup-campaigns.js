// Limpia campañas duplicadas/vacías — node cleanup-campaigns.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API = 'https://graph.facebook.com/v25.0';
const TOKEN = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;

// La única campaña buena — tiene adset + creative + ad
const KEEP_ID = '120242710814130636';

async function get(endpoint, params = {}) {
  const { data } = await axios.get(`${API}${endpoint}`, {
    params: { ...params, access_token: TOKEN }, timeout: 15000
  });
  return data;
}

async function del(id) {
  try {
    await axios.delete(`${API}/${id}?access_token=${TOKEN}`);
    return true;
  } catch (e) {
    return false;
  }
}

console.log('=== LIMPIEZA DE CAMPAÑAS ===\n');

// Obtener todas las campañas
const result = await get(`/${AD_ACCOUNT}/campaigns`, {
  fields: 'id,name,status',
  limit: 100
});

const campaigns = result.data || [];
console.log(`Total campañas encontradas: ${campaigns.length}`);

let deleted = 0;
let kept = 0;

for (const camp of campaigns) {
  if (camp.id === KEEP_ID) {
    console.log(`✅ CONSERVANDO: ${camp.id} — ${camp.name}`);
    kept++;
  } else if (camp.name.includes('NEXUS |') || camp.name.includes('TEST-')) {
    const ok = await del(camp.id);
    if (ok) {
      console.log(`🗑️  Eliminada: ${camp.id}`);
      deleted++;
    } else {
      console.log(`⚠️  No se pudo eliminar: ${camp.id}`);
    }
  } else {
    console.log(`⏭️  Ignorando (no es del agente): ${camp.id} — ${camp.name}`);
  }
}

console.log(`\n✅ Listo — ${deleted} eliminadas, ${kept} conservada`);
