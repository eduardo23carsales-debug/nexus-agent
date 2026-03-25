// ════════════════════════════════════
// NEXUS AGENT — agents/leadgen/lead-hunter.js
// Busca compradores reales de carros en Miami
// Fuentes: Craigslist RSS + input manual por Telegram
// ════════════════════════════════════

import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db, supabase } from '../../core/database.js';
import { alerta } from '../../core/telegram.js';

const parser = new Parser({ timeout: 10000 });

// Keywords que indican intención real de compra
const KEYWORDS_COMPRA = [
  'looking for', 'want to buy', 'want to purchase', 'need a car',
  'searching for', 'in the market for', 'budget', 'pre-approved',
  'financing', 'cash buyer', 'busco carro', 'quiero comprar',
  'necesito auto', 'buscando vehiculo', 'cuánto cuesta'
];

// Señales de baja calidad (descartar)
const KEYWORDS_BASURA = [
  'for sale', 'selling', 'vendo', 'se vende', 'price drop',
  'scam', 'spam', 'free', 'gratis', 'click here'
];

// ════════════════════════════════════
// FUENTE 1 — CRAIGSLIST MIAMI RSS
// ════════════════════════════════════

async function cazarEnCraigslist() {
  const urls = [
    // Cars & trucks wanted — Miami
    'https://miami.craigslist.org/search/wto?format=rss',
    // Con keywords de compra
    'https://miami.craigslist.org/search/wto?query=looking+for+car&format=rss',
    'https://miami.craigslist.org/search/wto?query=want+to+buy+car&format=rss',
  ];

  const leadsEncontrados = [];

  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);

      for (const item of feed.items || []) {
        const texto = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();

        // Filtro de calidad básico
        const tieneIntencion = KEYWORDS_COMPRA.some(k => texto.includes(k.toLowerCase()));
        const esBasura = KEYWORDS_BASURA.some(k => texto.includes(k.toLowerCase()));

        if (!tieneIntencion || esBasura) continue;

        // Extrae presupuesto si lo menciona
        const presupuesto = extraerPresupuesto(texto);

        leadsEncontrados.push({
          nombre: null,
          telefono: null,
          email: null,
          industria: 'automotive',
          descripcion_necesidad: item.title,
          presupuesto_min: presupuesto.min,
          presupuesto_max: presupuesto.max,
          urgencia: 'este_mes',
          ubicacion: 'Miami, FL',
          fuente: 'craigslist',
          fuente_url: item.link,
          mensaje_original: item.contentSnippet?.slice(0, 1000) || item.title
        });
      }
    } catch (err) {
      console.error(`[Hunter] Error en Craigslist RSS: ${err.message}`);
    }
  }

  return leadsEncontrados;
}

// ════════════════════════════════════
// FUENTE 2 — CRAIGSLIST WEB (búsqueda adicional)
// ════════════════════════════════════

async function cazarEnCraigslistWeb() {
  const leadsEncontrados = [];

  try {
    const { data } = await axios.get(
      'https://miami.craigslist.org/search/cto?query=looking+for+car+budget&sort=date',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
    );

    const $ = cheerio.load(data);

    $('.cl-search-result').each((i, el) => {
      if (i >= 20) return false; // máx 20 resultados

      const titulo = $(el).find('.titlestring').text().trim();
      const link = $(el).find('a.titlestring').attr('href');
      const texto = titulo.toLowerCase();

      const tieneIntencion = KEYWORDS_COMPRA.some(k => texto.includes(k.toLowerCase()));
      const esBasura = KEYWORDS_BASURA.some(k => texto.includes(k.toLowerCase()));

      if (!tieneIntencion || esBasura || !titulo) return;

      const presupuesto = extraerPresupuesto(texto);

      leadsEncontrados.push({
        nombre: null,
        telefono: null,
        email: null,
        industria: 'automotive',
        descripcion_necesidad: titulo,
        presupuesto_min: presupuesto.min,
        presupuesto_max: presupuesto.max,
        urgencia: 'este_mes',
        ubicacion: 'Miami, FL',
        fuente: 'craigslist_web',
        fuente_url: link ? `https://miami.craigslist.org${link}` : null,
        mensaje_original: titulo
      });
    });
  } catch (err) {
    console.error(`[Hunter] Error en Craigslist web: ${err.message}`);
  }

  return leadsEncontrados;
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

function extraerPresupuesto(texto) {
  // Busca patrones como "$10,000", "10k", "under 15k", "budget 12000"
  const matches = texto.match(/\$?([\d,]+)k?/gi) || [];
  const numeros = matches
    .map(m => {
      const n = parseFloat(m.replace(/[$,]/g, ''));
      return m.toLowerCase().includes('k') ? n * 1000 : n;
    })
    .filter(n => n >= 2000 && n <= 100000); // rango realista de carros

  if (numeros.length === 0) return { min: null, max: null };
  if (numeros.length === 1) return { min: numeros[0] * 0.8, max: numeros[0] };
  return { min: Math.min(...numeros), max: Math.max(...numeros) };
}

async function yaExisteEnDB(fuenteUrl) {
  if (!fuenteUrl) return false;
  const { data } = await supabase
    .from('leads')
    .select('id')
    .eq('fuente_url', fuenteUrl)
    .limit(1);
  return data && data.length > 0;
}

// ════════════════════════════════════
// FUNCIÓN PRINCIPAL — corre el hunt
// ════════════════════════════════════

export async function cazarLeads() {
  console.log('[Hunter] Iniciando búsqueda de leads en Miami...');
  await db.log('lead-hunter', 'hunt_iniciado', { fuentes: ['craigslist_rss', 'craigslist_web'] });

  const [rssLeads, webLeads] = await Promise.all([
    cazarEnCraigslist(),
    cazarEnCraigslistWeb()
  ]);

  const todos = [...rssLeads, ...webLeads];
  console.log(`[Hunter] Encontrados ${todos.length} candidatos`);

  let nuevos = 0;

  for (const lead of todos) {
    // Evitar duplicados
    if (await yaExisteEnDB(lead.fuente_url)) continue;

    await db.crearLead(lead);
    nuevos++;
  }

  console.log(`[Hunter] ${nuevos} leads nuevos guardados en DB`);
  await db.log('lead-hunter', 'hunt_completado', { candidatos: todos.length, nuevos });

  return nuevos;
}
