// ════════════════════════════════════
// NEXUS AGENT v4.0 — index.js
// Orquestador principal — corre 24/7
// ════════════════════════════════════

import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

import { db } from './core/database.js';
import { runMigrations } from './core/migrate.js';
import { alerta, enviar } from './core/telegram.js';
import { brain } from './core/brain.js';
import { email } from './core/email.js';
import { memory } from './core/memory.js';

import { investigarNicho } from './agents/digital/researcher.js';
import { generarProducto } from './agents/digital/generator.js';
import { publicarProducto } from './agents/digital/publisher.js';
import { calificarLeadManual } from './agents/leadgen/lead-qualifier.js';
import { entregarLeadsCalificados } from './agents/leadgen/lead-delivery.js';
import { lanzarCampanaParaProducto } from './agents/advanced/ads-manager.js';
import { validarCampanas } from './agents/ads/campaign-validator.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API = `https://api.telegram.org/bot${TOKEN}`;

let telegramOffset = 0;
let aprobacionPendiente = null; // { tipo, datos, resolve }
let experimentoEnCurso = false;

// ════════════════════════════════════
// INICIALIZACIÓN
// ════════════════════════════════════

async function iniciar() {
  console.log('\n⚡ NEXUS AGENT v4.0 iniciando...\n');

  // Verificar conexiones
  await db.ping();
  console.log('✅ Supabase conectado');

  // Migraciones automáticas
  await runMigrations();

  // Limpiar offset de Telegram para solo leer mensajes nuevos
  try {
    const res = await axios.get(`${API}/getUpdates`, { params: { offset: -1, limit: 1, timeout: 0 } });
    const updates = res.data.result || [];
    if (updates.length > 0) telegramOffset = updates[updates.length - 1].update_id + 1;
  } catch {}
  console.log('✅ Telegram listo');

  await alerta.sistemaOnline();
  console.log('✅ Notificación enviada\n');
}

// ════════════════════════════════════
// LEER COMANDOS DE TELEGRAM
// ════════════════════════════════════

async function leerComandosTelegram() {
  try {
    const res = await axios.get(`${API}/getUpdates`, {
      params: { offset: telegramOffset, limit: 10, timeout: 0 }
    });

    const updates = res.data.result || [];

    for (const update of updates) {
      telegramOffset = update.update_id + 1;
      const msg = update.message;
      if (!msg || String(msg.chat.id) !== String(CHAT_ID)) continue;

      const texto = msg.text?.trim().toUpperCase();
      console.log(`[Telegram] Comando: ${texto}`);

      // Si hay una aprobación pendiente, responderla primero
      if (texto === 'PUBLICAR' || texto === '1') {
        if (aprobacionPendiente && typeof aprobacionPendiente.resolve === 'function') {
          aprobacionPendiente.resolve('PUBLICAR');
          aprobacionPendiente = null;
        } else {
          await enviar('⏳ No hay producto pendiente de publicación.\nUsa <b>LANZAR</b> para generar uno.');
        }
        continue;
      }
      if (texto === 'CANCELAR' || texto === '2') {
        if (aprobacionPendiente && typeof aprobacionPendiente.resolve === 'function') {
          aprobacionPendiente.resolve('CANCELAR');
          aprobacionPendiente = null;
        } else {
          await enviar('ℹ️ No hay publicación pendiente que cancelar.');
        }
        continue;
      }

      // Comandos principales
      if (texto === 'LANZAR') {
        await enviar('🚀 Lanzando nuevo experimento ahora...');
        lanzarExperimento().catch(e => enviar(`❌ Error: ${e.message}`));

      } else if (texto === 'ESTADO') {
        await mostrarEstado();

      } else if (texto === 'REPORTE') {
        await brain.generarResumenDiario();

      } else if (texto === 'AYUDA' || texto === '/START') {
        await enviar(
          `⚡ <b>NEXUS AGENT v4.0 — Comandos</b>\n\n` +
          `<b>LANZAR</b> — Lanza un nuevo producto ahora\n` +
          `<b>ESTADO</b> — Ver experimentos activos\n` +
          `<b>REPORTE</b> — Reporte financiero\n` +
          `<b>PUBLICAR</b> — Aprueba landing pendiente\n` +
          `<b>CANCELAR</b> — Cancela publicación pendiente\n\n` +
          `<i>El sistema también acepta texto libre para calificar leads de carros.</i>`
        );

      } else if (texto && texto.length > 20) {
        // Texto largo = lead manual para calificar
        await enviar('🔍 Calificando lead...');
        try {
          const { calificacion } = await calificarLeadManual(msg.text);
          if (calificacion.es_calificado) {
            await entregarLeadsCalificados();
          } else {
            await enviar(`❌ Lead descartado — Score ${calificacion.score}/10\n${calificacion.razon}`);
          }
        } catch (e) {
          await enviar(`❌ Error calificando: ${e.message}`);
        }
      }
    }
  } catch (err) {
    if (!err.message?.includes('409')) {
      console.error('[Telegram] Error leyendo:', err.message);
    }
  }
}

// ════════════════════════════════════
// LANZAR EXPERIMENTO
// ════════════════════════════════════

async function lanzarExperimento() {
  if (experimentoEnCurso) {
    await enviar('⚠️ Ya hay un experimento en curso. Espera a que termine.');
    return;
  }
  experimentoEnCurso = true;
  console.log('\n[Motor 1] Iniciando nuevo experimento...');

  try {
    // 1. Investigar nicho
    const nicho = await investigarNicho();
    await enviar(
      `🔍 <b>Nicho encontrado: ${nicho.nombre_producto}</b>\n` +
      `Score: ${nicho.score}/100 | Precio: $${nicho.precio}\n` +
      `<i>Generando producto...</i>`
    );

    // 2. Generar contenido
    const contenido = await generarProducto(nicho);

    // 3. Publicar (con aprobación vía Telegram)
    const resultado = await publicarConAprobacion(nicho, contenido);

    if (resultado) {
      await memory.aprenderDeExperimento({ ...nicho, metricas: { revenue: 0 }, aprendizaje: 'recién lanzado' });
      console.log(`[Motor 1] Experimento lanzado: ${resultado.url}`);
    }

  } catch (err) {
    console.error('[Motor 1] Error:', err.message);
    await alerta.errorCritico('motor1', err.message);
  } finally {
    experimentoEnCurso = false;
  }
}

// Versión de publicar que usa el sistema de aprobación del orquestador
async function publicarConAprobacion(nicho, contenido) {
  const { stripeCore } = await import('./core/stripe.js');
  const { deploy } = await import('./core/deploy.js');
  const fs = await import('fs/promises');
  const path = await import('path');

  // Crear producto en Stripe
  const stripeData = await stripeCore.crearProductoCompleto({
    nombre: nicho.nombre_producto,
    descripcion: nicho.problema_que_resuelve,
    precio: nicho.precio
  });

  // Generar HTML
  const { preguntar } = await import('./core/claude.js');
  const beneficios = nicho.puntos_de_venta.map(p => `<li>✅ ${p}</li>`).join('\n');
  const html = await preguntar(`
Crea landing page HTML con estilos inline para: ${nicho.nombre_producto} — $${nicho.precio}
Subtítulo: ${nicho.subtitulo}
Link de pago: ${stripeData.stripe_payment_link}
Beneficios: ${nicho.puntos_de_venta.join(', ')}
Problema: ${nicho.problema_que_resuelve}

Usa SOLO estilos inline. Fondo #0f0f0f, acento #00ff88, texto blanco.
Incluye: hero, beneficios, precio con botón de compra, 2 testimonios, garantía, CTA final.
IMPORTANTE: El HTML debe estar 100% completo, desde <!DOCTYPE> hasta </html> sin cortar nada.
Devuelve SOLO HTML desde <!DOCTYPE> hasta </html>.
`, 'Experto en landing pages de alta conversión para mercado hispano.', 'publisher', 16000);

  // Inyectar Meta Pixel en la landing
  const metaPixel = `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${process.env.META_PIXEL_ID || '2413550065734696'}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${process.env.META_PIXEL_ID || '2413550065734696'}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;

  const htmlLimpio = html
    .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
    .replace('</head>', `${metaPixel}\n</head>`);

  // Guardar preview
  const previewPath = path.join(process.cwd(), 'products', `preview-${Date.now()}.html`);
  await fs.mkdir(path.join(process.cwd(), 'products'), { recursive: true });
  await fs.writeFile(previewPath, htmlLimpio);

  // Pedir aprobación
  await enviar(
    `🎨 <b>LANDING LISTA</b>\n\n` +
    `<b>Producto:</b> ${nicho.nombre_producto}\n` +
    `<b>Precio:</b> $${nicho.precio}\n` +
    `<b>Preview:</b> <code>${previewPath}</code>\n\n` +
    `Escribe <b>PUBLICAR</b> para subir a Vercel\n` +
    `Escribe <b>CANCELAR</b> para descartar`
  );

  // Esperar respuesta (timeout 4h → auto-publicar)
  const decision = await new Promise((resolve) => {
    aprobacionPendiente = { tipo: 'publicar', resolve };
    setTimeout(() => {
      if (aprobacionPendiente) {
        aprobacionPendiente = null;
        resolve('PUBLICAR');
      }
    }, 4 * 60 * 60 * 1000);
  });

  if (decision === 'CANCELAR') return null;

  // Publicar landing page en Vercel
  const url = await deploy.publicarLanding({ nombre: nicho.nombre_producto, html: htmlLimpio, nicho: nicho.nicho });

  // Publicar página del producto (lo que recibe el cliente) en Vercel
  let productoUrl = null;
  try {
    productoUrl = await deploy.publicarLanding({
      nombre: `${nicho.nombre_producto} — Producto`,
      html: contenido,
      nicho: `${nicho.nicho}-producto`
    });
    console.log(`[Publisher] Página del producto: ${productoUrl}`);
  } catch (e) {
    console.error('[Publisher] Error desplegando página de producto:', e.message);
  }

  // Publicar en Gumroad (en paralelo, no bloquea si falla)
  let gumroadUrl = null;
  try {
    const { gumroad } = await import('./core/gumroad.js');
    const gData = await gumroad.crearProducto({
      nombre: nicho.nombre_producto,
      descripcion: `${nicho.subtitulo}\n\n${nicho.problema_que_resuelve}`,
      precio: nicho.precio,
      contenido
    });
    gumroadUrl = gData.gumroad_url;
  } catch (e) {
    console.error('[Gumroad] Error publicando:', e.message);
  }

  const experimento = await db.crearExperimento({
    nicho: nicho.nicho,
    tipo: nicho.tipo || 'guia_pdf',
    nombre: nicho.nombre_producto,
    descripcion: nicho.subtitulo,
    url,
    stripe_product_id: stripeData.stripe_product_id,
    stripe_payment_link: stripeData.stripe_payment_link,
    precio: nicho.precio,
    estado: 'corriendo',
    contenido_producto: contenido,
    landing_html: htmlLimpio,
    producto_url: productoUrl
  });

  await enviar(
    `🚀 <b>PUBLICADO</b>\n` +
    `🌐 Landing: ${url}\n` +
    `📦 Producto: ${productoUrl || 'no disponible'}\n` +
    `💳 Pago: ${stripeData.stripe_payment_link}` +
    (gumroadUrl ? `\n🛒 Gumroad: ${gumroadUrl}` : '')
  );

  // Lanzar campaña de Meta Ads automáticamente
  lanzarCampanaParaProducto(experimento).catch(e =>
    console.error('[AdsManager] Error en background:', e.message)
  );

  return { url, productoUrl, experimento, stripeData };
}

// ════════════════════════════════════
// MOSTRAR ESTADO DEL SISTEMA
// ════════════════════════════════════

async function mostrarEstado() {
  const [exps, financiero, memStats] = await Promise.all([
    db.getExperimentosActivos(),
    db.getResumenFinanciero(),
    memory.getStats()
  ]);

  let msg = `📊 <b>ESTADO DEL SISTEMA</b>\n━━━━━━━━━━━━━\n`;
  msg += `🧪 Experimentos activos: ${exps.length}\n`;

  for (const exp of exps.slice(0, 5)) {
    msg += `  • ${exp.nombre} — $${exp.metricas?.revenue || 0}\n`;
  }

  msg += `\n💰 Revenue digital: $${financiero.digital.ingresos.toFixed(2)}\n`;
  msg += `💰 Revenue leads: $${financiero.leadgen.ingresos.toFixed(2)}\n`;
  msg += `🧠 Memorias: ${memStats.total}\n`;
  msg += `\n<i>Sistema corriendo 24/7</i>`;

  await enviar(msg);
}

// ════════════════════════════════════
// CRON JOBS — TAREAS AUTOMÁTICAS
// ════════════════════════════════════

function iniciarCrons() {
  // Cada hora — revisar pagos y entregar productos
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Revisando pagos nuevos...');
    try {
      const entregados = await email.procesarPagosNuevos();
      if (entregados > 0) console.log(`[Cron] ${entregados} productos entregados`);
    } catch (err) {
      console.error('[Cron] Error pagos:', err.message);
    }
  });

  // Cada 5 segundos — leer comandos de Telegram (respuesta rápida)
  setInterval(async () => {
    await leerComandosTelegram();
  }, 5000);

  // Cada 6 horas — validar campañas de Meta Ads
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron] Validando campañas Meta Ads...');
    try { await validarCampanas(); } catch (err) { console.error('[Cron] Error validando campañas:', err.message); }
  });

  // Cada día a las 9am — lanzar nuevo experimento
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Lanzando experimento diario...');
    await lanzarExperimento();
  });

  // Cada día a las 8pm — reporte diario
  cron.schedule('0 20 * * *', async () => {
    console.log('[Cron] Generando reporte diario...');
    await brain.generarResumenDiario();
  });

  console.log('✅ Crons activos: pagos (1h), comandos (5seg), experimento (9am), reporte (8pm)');
}

// ════════════════════════════════════
// ARRANQUE
// ════════════════════════════════════

await iniciar();
iniciarCrons();

console.log('\n🚀 NEXUS AGENT corriendo. Escribe AYUDA en Telegram para ver comandos.\n');
