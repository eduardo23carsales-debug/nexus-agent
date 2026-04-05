import axios from 'axios';
const TOKEN = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const API = 'https://graph.facebook.com/v25.0';

async function check() {
  const camps = await axios.get(`${API}/${AD_ACCOUNT}/campaigns`, {
    params: { 
      fields: 'id,name,status,effective_status,created_time',
      limit: 10,
      access_token: TOKEN 
    }
  });
  console.log('CAMPAÑAS ACTIVAS/PAUSADAS:');
  for (const c of camps.data.data) {
    console.log(`  ${c.status} | ${c.effective_status} | ${c.id} | ${c.created_time}`);
    const adsets = await axios.get(`${API}/${c.id}/adsets`, {
      params: { fields: 'id,name,status,effective_status', access_token: TOKEN }
    });
    if (adsets.data.data.length > 0) {
      for (const a of adsets.data.data) {
        console.log(`    ADSET: ${a.status} | ${a.name}`);
        const ads = await axios.get(`${API}/${a.id}/ads`, {
          params: { fields: 'id,name,status,effective_status', access_token: TOKEN }
        });
        for (const ad of ads.data.data) {
          console.log(`      AD: ${ad.status} | ${ad.effective_status} | ${ad.name}`);
        }
      }
    } else {
      console.log(`    (sin adsets visibles)`);
    }
  }
}

check().catch(e => console.error('ERROR:', e.response?.data || e.message));
