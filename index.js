// ════════════════════════════════════
// NEXUS AGENT v4.0 — index.js
// Orquestador principal — corre 24/7
// ════════════════════════════════════

import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

import { iniciarAPIServer } from './core/api-server.js';

import { db } from './core/database.js';
import { runMigrations } from './core/migrate.js';
import { alerta, enviar } from './core/telegram.js';
import { brain } from './core/brain.js';
import { email } from './core/email.js';
import { memory } from './core/memory.js';

import { investigarNicho } from './agents/digital/researcher.js';
import { cargarCostoHoy, resetCostoHoy } from './core/claude.js';
import { generarProducto } from './agents/digital/generator.js';
import { publicarProducto } from './agents/digital/publisher.js';
import { calificarLeadManual } from './agents/leadgen/lead-qualifier.js';
import { entregarLeadsCalificados } from './agents/leadgen/lead-delivery.js';
import { lanzarCampanaParaProducto, lanzarCampanaLeadCamp } from './agents/advanced/ads-manager.js';
import { validarCampanas } from './agents/ads/campaign-validator.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API = `https://api.telegram.org/bot${TOKEN}`;

let telegramOffset = 0;
let aprobacionPendiente = null; // { tipo, datos, nicho, resolve }
let experimentoEnCurso = false;
let telegramPollingActivo = false; // evita llamadas concurrentes al polling
let cancelarFlag = false; // CANCELAR en cualquier momento del proceso

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

  // Cargar costo Claude acumulado hoy (sobrevive reinicios de Railway)
  await cargarCostoHoy();

  // Limpiar offset de Telegram para solo leer mensajes nuevos
  try {
    const res = await axios.get(`${API}/getUpdates`, { params: { offset: -1, limit: 1, timeout: 0 } });
    const updates = res.data.result || [];
    if (updates.length > 0) telegramOffset = updates[updates.length - 1].update_id + 1;
  } catch {}
  console.log('✅ Telegram listo');

  // Detectar si el sistema se reinició con operaciones en curso
  try {
    const [nichoPendiente, experCurso] = await Promise.all([
      db.getEstadoOperacion('nicho_pendiente'),
      db.getEstadoOperacion('experimento_en_curso')
    ]);
    if (nichoPendiente) {
      console.warn('[Startup] Había un nicho pendiente de aprobación antes del reinicio — limpiando.');
      await db.clearEstadoOperacion('nicho_pendiente');
    }
    if (experCurso) {
      console.warn('[Startup] Había un experimento en curso antes del reinicio — limpiando flag.');
      await db.clearEstadoOperacion('experimento_en_curso');
    }
    if (nichoPendiente || experCurso) {
      await enviar('⚠️ El sistema se reinició durante una operación en curso.\nUsa <b>LANZAR</b> para retomar cuando estés listo.').catch(() => {});
    }
  } catch (e) {
    console.warn('[Startup] No se pudo verificar estado previo:', e.message);
  }

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
        } else if (experimentoEnCurso) {
          cancelarFlag = true;
          await enviar('🛑 Cancelando... el proceso se detiene al terminar el paso actual.');
        } else {
          await enviar('ℹ️ No hay nada en curso que cancelar.');
        }
        continue;
      }

      if (texto === 'OTRO' || texto === '3') {
        if (aprobacionPendiente && typeof aprobacionPendiente.resolve === 'function') {
          aprobacionPendiente.resolve('OTRO');
          aprobacionPendiente = null;
        } else {
          await enviar('ℹ️ No hay nicho pendiente. Usa <b>LANZAR</b> para buscar uno.');
        }
        continue;
      }

      // Comandos principales
      if (texto === 'RELANZMETA') {
        await enviar('🔄 Buscando último producto publicado...');
        try {
          const { supabase } = await import('./core/database.js');
          const { data: exps } = await supabase
            .from('experiments')
            .select('id, nombre, nicho, url, precio, descripcion, cliente_ideal, problema_que_resuelve, formato_ad')
            .order('fecha_inicio', { ascending: false })
            .limit(1);
          if (!exps?.length) {
            await enviar('❌ No hay productos publicados todavía.');
          } else {
            const exp = exps[0];
            await enviar(`🚀 Relanzando campaña Meta Ads para:\n<b>${exp.nombre}</b>`);
            const { lanzarCampanaParaProducto } = await import('./agents/advanced/ads-manager.js');
            await lanzarCampanaParaProducto(exp);
          }
        } catch (e) {
          await enviar(`❌ Error: ${e.message}`);
        }

      } else if (texto === 'TESTMETA') {
        await enviar('🔍 Verificando conexión con Meta Ads...');
        try {
          const { metaAds } = await import('./agents/ads/meta-ads.js');
          await metaAds.preflight();
          await enviar('✅ <b>Meta Ads OK</b>\n\nToken válido, Ad Account accesible y Page accesible.\nListo para lanzar campañas.');
        } catch (e) {
          await enviar(`❌ <b>Meta Ads FALLÓ</b>\n\n${e.message}`);
        }

      } else if (texto === 'TESTTIKTOK') {
        await enviar('🎵 Verificando conexión con TikTok Ads...');
        try {
          const { tiktokAds } = await import('./agents/ads/tiktok-ads.js');
          await tiktokAds.preflight();
          await enviar('✅ <b>TikTok Ads OK</b>\n\nToken válido y Advertiser accesible.\nListo para lanzar campañas en TikTok.');
        } catch (e) {
          await enviar(`❌ <b>TikTok Ads FALLÓ</b>\n\n${e.message}\n\nAsegúrate de tener TIKTOK_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID en Railway.`);
        }

      } else if (texto === 'TESTGOOGLE') {
        await enviar('🔍 Verificando conexión con Google Ads...');
        try {
          const { googleAds } = await import('./agents/ads/google-ads.js');
          await googleAds.preflight();
          await enviar('✅ <b>Google Ads OK</b>\n\nCredenciales válidas y cuenta accesible.\nListo para lanzar campañas de Search en Google.');
        } catch (e) {
          await enviar(`❌ <b>Google Ads FALLÓ</b>\n\n${e.message}`);
        }

      } else if (texto === 'TESTHOTMART') {
        await enviar('🔥 Verificando conexión con Hotmart...');
        try {
          const { hotmart } = await import('./core/hotmart.js');
          const r = await hotmart.ping();
          await enviar(`✅ <b>Hotmart OK</b>\n\nCredenciales válidas. Productos activos: ${r.productos}\nWebhook URL: https://${process.env.MY_DOMAIN}/webhook/hotmart`);
        } catch (e) {
          await enviar(`❌ <b>Hotmart FALLÓ</b>\n\n${e.message}\n\nConfigura en Railway:\n• HOTMART_CLIENT_ID\n• HOTMART_CLIENT_SECRET\n• HOTMART_WEBHOOK_TOKEN (opcional)`);
        }

      } else if (texto === 'LANZAR') {
        await enviar('🚀 Lanzando nuevo experimento ahora...');
        lanzarExperimento().catch(e => enviar(`❌ Error: ${e.message}`));

      } else if (texto === 'ESTADO') {
        await mostrarEstado();

      } else if (texto === 'REPORTE') {
        await brain.generarResumenDiario();

      } else if (texto === 'AYUDA' || texto === '/START') {
        await enviar(
          `⚡ <b>NEXUS AGENT v4.3 — Comandos</b>\n\n` +
          `<b>LANZAR</b> — Busca y presenta el mejor nicho\n` +
          `<b>PUBLICAR</b> — Aprueba el nicho y genera el producto\n` +
          `<b>OTRO</b> — Rechaza el nicho y busca uno diferente\n` +
          `<b>CANCELAR</b> — Cancela sin lanzar nada\n\n` +
          `<b>ESTADO</b> — Ver experimentos activos\n` +
          `<b>REPORTE</b> — Reporte financiero\n` +
          `<b>TESTMETA</b> — Verifica conexión Meta Ads\n` +
          `<b>TESTTIKTOK</b> — Verifica conexión TikTok Ads\n` +
          `<b>TESTGOOGLE</b> — Verifica conexión Google Ads\n` +
          `<b>TESTHOTMART</b> — Verifica conexión Hotmart\n` +
          `<b>RELANZMETA</b> — Relanza campaña Meta del último producto\n\n` +
          `<b>LEADCAMP</b> — Lanza campaña para cualquier oferta tuya\n` +
          `<i>Escribe libre: LEADCAMP + tu oferta + tu página web + WhatsApp (opcional)</i>\n` +
          `<i>Ej: LEADCAMP Elantra 2026 $299/mes Miami https://miweb.com +13055551234</i>\n\n` +
          `<i>Puedes escribir OTRO varias veces hasta encontrar un nicho que te convenza.</i>`
        );

      } else if (texto?.startsWith('LEADCAMP')) {
        // Escribe libre — el sistema detecta la URL y el WhatsApp donde sea que estén
        const rawMsg = msg.text.trim().replace(/^LEADCAMP\s*/i, '');

        // Extraer URL (http o www)
        const urlMatch = rawMsg.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
        let landingUrl = urlMatch ? urlMatch[0] : null;
        if (landingUrl && landingUrl.startsWith('www.')) landingUrl = 'https://' + landingUrl;

        // Extraer número WhatsApp (formato +1... o variantes)
        const waMatch = rawMsg.match(/\+\d[\d\s\-]{7,14}/);
        const whatsappNum = waMatch ? waMatch[0].replace(/[\s\-]/g, '') : null;

        // La oferta es el texto libre sin URL ni teléfono
        const oferta = rawMsg
          .replace(urlMatch?.[0] || '', '')
          .replace(waMatch?.[0] || '', '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (!landingUrl || !oferta) {
          await enviar(
            `❌ Necesito al menos tu <b>página web</b> y la <b>descripción de la oferta</b>.\n\n` +
            `Escribe libre, por ejemplo:\n` +
            `<code>LEADCAMP Elantra 2026 $1,000 down $299/mes Miami, mi página https://miweb.com WhatsApp +13055551234</code>\n\n` +
            `El WhatsApp es opcional.`
          );
        } else {
          await enviar(`⚙️ Entendido. Creando copies y lanzando campaña...`);
          lanzarCampanaLeadCamp({ oferta, landingUrl, whatsappNum }).catch(e => enviar(`❌ Error: ${e.message}`));
        }

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
  cancelarFlag = false;
  await db.setEstadoOperacion('experimento_en_curso', { inicio: new Date().toISOString() }).catch(() => {});
  console.log('\n[Motor 1] Iniciando nuevo experimento...');

  try {
    // Loop: busca → muestra → espera → si OTRO repite, si PUBLICAR avanza
    let nichoAprobado = null;

    while (!nichoAprobado) {
      // 1. Investigar nicho (busca 5 candidatos internamente, filtra score >= 82)
      const nicho = await investigarNicho();

      // 2. Mostrar nicho y pedir aprobación
      const tipoLabel = {
        'mini_curso': '🎓 Mini Curso',
        'guia_pdf': '📘 Guía PDF',
        'plantilla': '📋 Plantilla',
        'toolkit': '🔧 Toolkit',
        'prompts': '⚡ Pack de Prompts'
      }[nicho.tipo] || `📦 ${nicho.tipo}`;

      const scoreEmoji = nicho.score >= 90 ? '🔥' : nicho.score >= 85 ? '✅' : nicho.score >= 82 ? '👍' : '⚠️';

      await enviar(
        `🔍 <b>Nicho encontrado:</b> ${nicho.nombre_producto}\n` +
        `📦 <b>Tipo:</b> ${tipoLabel}\n` +
        `${scoreEmoji} Score: <b>${nicho.score}/100</b> | 💵 Precio: $${nicho.precio}\n` +
        `👥 ${nicho.subgrupo_latino || ''}\n` +
        `🎯 <i>${nicho.subtitulo}</i>\n` +
        `💡 ${nicho.problema_que_resuelve}\n` +
        `📊 ${nicho.razon_score || ''}\n\n` +
        `<b>PUBLICAR</b> — generar y lanzar\n` +
        `<b>OTRO</b> — buscar nicho diferente\n` +
        `<b>CANCELAR</b> — cancelar`
      );

      // 3. Guardar nicho en DB por si el sistema se reinicia durante la espera
      await db.setEstadoOperacion('nicho_pendiente', { nicho, guardado_en: new Date().toISOString() }).catch(() => {});

      // Esperar decisión (timeout 4h)
      const decision = await new Promise((resolve) => {
        aprobacionPendiente = { tipo: 'publicar', nicho, resolve };
        setTimeout(async () => {
          if (aprobacionPendiente) {
            aprobacionPendiente = null;
            try { await enviar('⏰ 4 horas sin respuesta — nicho cancelado automáticamente.\nUsa <b>LANZAR</b> cuando estés listo.'); } catch {}
            resolve('CANCELAR');
          }
        }, 4 * 60 * 60 * 1000);
      });

      // Decisión recibida — limpiar el nicho pendiente de DB
      await db.clearEstadoOperacion('nicho_pendiente').catch(() => {});

      if (decision === 'PUBLICAR') {
        nichoAprobado = nicho;

      } else if (decision === 'OTRO') {
        await memory.rechazarNicho(nicho);
        await enviar(`🔄 Descartado. Buscando otro nicho...`);
        console.log(`[Motor 1] Nicho rechazado: "${nicho.nicho}" — a blacklist`);
        await new Promise(r => setTimeout(r, 3000));
        // continúa el while → busca de nuevo

      } else {
        // CANCELAR
        await enviar('❌ Búsqueda cancelada.');
        return;
      }
    }

    // 4. Aprobado — generar y publicar
    await enviar('⚙️ Aprobado. Generando producto y landing page...');
    const resultado = await publicarAutomatico(nichoAprobado);

    if (resultado) {
      // No guardamos en memoria hasta tener datos reales — evita contaminar el contexto con revenue=0
      console.log(`[Motor 1] Experimento lanzado: ${resultado.url}`);
    }

  } catch (err) {
    console.error('[Motor 1] Error:', err.message);
    await alerta.errorCritico('motor1', err.message);
  } finally {
    experimentoEnCurso = false;
    await db.clearEstadoOperacion('experimento_en_curso').catch(() => {});
    await db.clearEstadoOperacion('nicho_pendiente').catch(() => {});
  }
}

// Genera, publica y lanza campaña — corre todo automático tras aprobación
async function publicarAutomatico(nicho) {
  const { stripeCore } = await import('./core/stripe.js');
  const { deploy } = await import('./core/deploy.js');
  const { preguntar, MODEL_SONNET } = await import('./core/claude.js');

  if (cancelarFlag) { cancelarFlag = false; await enviar('🛑 Proceso cancelado.'); return null; }

  // Generar contenido del producto y landing en paralelo
  await enviar('📝 Generando contenido del producto...');
  const contenido = await generarProducto(nicho);

  // Validar que el producto se generó completo y con estructura HTML real
  // El generator usa tab-panel (divs), no <section>
  const productoValido = contenido &&
    contenido.length >= 5000 &&
    contenido.includes('</html>') &&
    contenido.includes('tab-panel') &&
    contenido.split('tab-panel').length >= 4;
  if (!productoValido) {
    throw new Error(`Producto generado incompleto o sin estructura (${contenido?.length || 0} chars). Abortando para no publicar contenido roto.`);
  }

  if (cancelarFlag) { cancelarFlag = false; await enviar('🛑 Proceso cancelado.'); return null; }

  // Crear producto en Stripe
  await enviar('💳 Creando producto en Stripe...');
  const stripeData = await stripeCore.crearProductoCompleto({
    nombre: nicho.nombre_producto,
    descripcion: nicho.problema_que_resuelve,
    precio: nicho.precio
  });

  if (cancelarFlag) { cancelarFlag = false; await enviar('🛑 Proceso cancelado.'); return null; }

  // Generar landing page HTML
  await enviar('🎨 Generando landing page...');
  const html = await preguntar(`
Crea landing page HTML con estilos inline para: ${nicho.nombre_producto} — $${nicho.precio}
Subtítulo: ${nicho.subtitulo}
Link de pago: ${stripeData.stripe_payment_link}
Beneficios: ${Array.isArray(nicho.puntos_de_venta) ? nicho.puntos_de_venta.join(', ') : nicho.puntos_de_venta || ''}
Problema: ${nicho.problema_que_resuelve}

Usa SOLO estilos inline. Fondo #0f0f0f, acento #00ff88, texto blanco.
Incluye: hero, beneficios, precio con botón de compra, 2 testimonios, garantía, CTA final.
PROHIBIDO: No incluyas módulos, temario, curriculum, índice ni secciones de "lo que aprenderás" — eso es parte del producto entregable, no de la landing de venta.
IMPORTANTE: El HTML debe estar 100% completo, desde <!DOCTYPE> hasta </html> sin cortar nada.
Devuelve SOLO HTML desde <!DOCTYPE> hasta </html>.
`, 'Experto en landing pages de alta conversión para mercado hispano.', 'publisher', 16000, MODEL_SONNET);

  // Inyectar Meta Pixel
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

  const stripeLink = stripeData.stripe_payment_link;

  let htmlLimpio = html
    .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
    .replace('</head>', `${metaPixel}\n</head>`);

  // ── Garantizar que el payment link esté en los botones de compra ──
  // Claude a veces usa href="#" o href="" como placeholder
  htmlLimpio = htmlLimpio
    .replace(/href="#"/g, `href="${stripeLink}"`)
    .replace(/href=""\s/g, `href="${stripeLink}" `)
    .replace(/href="\[LINK[^\]]*\]"/gi, `href="${stripeLink}"`)
    .replace(/href="PAYMENT_LINK"/gi, `href="${stripeLink}"`);

  // Si el link de Stripe sigue sin aparecer, agregar botón fijo flotante
  if (!htmlLimpio.includes('stripe.com') && !htmlLimpio.includes(stripeLink)) {
    const stickyBtn = `\n<div style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;text-align:center;padding:0 16px">
  <a href="${stripeLink}" style="display:inline-block;background:#00ff88;color:#000;font-weight:800;font-size:1.05em;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 4px 24px rgba(0,255,136,0.45);white-space:nowrap">
    💳 COMPRAR AHORA — $${nicho.precio}
  </a>
</div>`;
    htmlLimpio = htmlLimpio.replace('</body>', `${stickyBtn}\n</body>`);
  }

  // Validar que la landing page se generó completa y con estructura HTML real
  const landingValida = htmlLimpio &&
    htmlLimpio.length >= 3000 &&
    htmlLimpio.includes('</html>') &&
    htmlLimpio.includes('<body');
  if (!landingValida) {
    throw new Error(`Landing page incompleta o sin estructura (${htmlLimpio?.length || 0} chars). Abortando para no publicar página rota.`);
  }

  // Desplegar landing y producto en un solo proyecto Vercel
  await enviar('🚀 Subiendo a Vercel...');
  const { landingUrl: url, productoUrl } = await deploy.publicarCompleto({
    nombre: nicho.nombre_producto,
    htmlLanding: htmlLimpio,
    htmlProducto: contenido,
    nicho: nicho.nicho
  });

  // Publicar en Gumroad (con URL real del producto en Vercel)
  let gumroadUrl = null;
  try {
    const { gumroad } = await import('./core/gumroad.js');
    const gData = await gumroad.crearProducto({
      nombre: nicho.nombre_producto,
      descripcion: `${nicho.subtitulo}\n\n${nicho.problema_que_resuelve}`,
      precio: nicho.precio,
      productoUrl
    });
    gumroadUrl = gData.gumroad_url;
    console.log(`[Gumroad] Publicado: ${gumroadUrl}`);
  } catch (e) {
    console.error('[Gumroad] Error publicando:', e.message);
  }

  // Publicar en Hotmart (canal adicional de ventas)
  let hotmartUrl = null;
  let hotmartId = null;
  try {
    const { hotmart } = await import('./core/hotmart.js');
    const hData = await hotmart.crearProducto({
      nombre: nicho.nombre_producto,
      descripcion: `${nicho.subtitulo}\n\n${nicho.problema_que_resuelve}`,
      precio: nicho.precio,
      productoUrl
    });
    hotmartUrl = hData.hotmart_url;
    hotmartId = hData.hotmart_id;
    console.log(`[Hotmart] Publicado: ${hotmartUrl}`);
  } catch (e) {
    console.error('[Hotmart] Error publicando:', e.message);
  }

  const experimento = await db.crearExperimento({
    nicho: nicho.nicho,
    tipo: nicho.tipo || 'guia_pdf',
    nombre: nicho.nombre_producto,
    descripcion: nicho.subtitulo,
    cliente_ideal: nicho.cliente_ideal || '',
    problema_que_resuelve: nicho.problema_que_resuelve || '',
    url,
    stripe_product_id: stripeData.stripe_product_id,
    stripe_payment_link: stripeData.stripe_payment_link,
    precio: nicho.precio,
    formato_ad: nicho.formato_ad_recomendado || 'feed',
    estado: 'corriendo',
    contenido_producto: contenido,
    landing_html: htmlLimpio,
    producto_url: productoUrl,
    gumroad_url: gumroadUrl,
    hotmart_id: hotmartId ? String(hotmartId) : null,
    hotmart_url: hotmartUrl
  });

  await enviar(
    `✅ <b>PUBLICADO Y ACTIVO</b>\n━━━━━━━━━━━━━\n` +
    `🌐 Landing: ${url}\n` +
    `📦 Producto: ${productoUrl || 'pendiente'}\n` +
    `💳 Stripe: ${stripeData.stripe_payment_link}` +
    (gumroadUrl ? `\n🛒 Gumroad: ${gumroadUrl}` : '') +
    (hotmartUrl ? `\n🔥 Hotmart: ${hotmartUrl}` : '') +
    `\n\n⚡ Lanzando campaña Meta Ads...`
  );

  // Lanzar campaña Meta Ads automáticamente
  lanzarCampanaParaProducto(experimento).catch(async (e) => {
    console.error('[AdsManager] Error en background:', e.message);
    await alerta.errorCritico('ads-manager', `⚠️ Campaña Meta Ads falló para "${experimento.nombre}":\n${e.message}\n\nUsa <b>RELANZMETA</b> para reintentarlo.`).catch(() => {});
  });

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

  // Cada 30 minutos — detectar carritos abandonados y enviar emails
  cron.schedule('*/30 * * * *', async () => {
    try {
      await email.procesarCarritosAbandonados();
    } catch (err) {
      console.error('[Cron] Error carritos abandonados:', err.message);
    }
  });

  // Cada 5 segundos — leer comandos de Telegram (respuesta rápida)
  setInterval(async () => {
    if (telegramPollingActivo) return; // evita acumulación si Telegram está lento
    telegramPollingActivo = true;
    try { await leerComandosTelegram(); } finally { telegramPollingActivo = false; }
  }, 5000);

  // Cada 6 horas — secuencia post-compra (días 1, 3, 7, 14)
  cron.schedule('0 */6 * * *', async () => {
    try {
      const enviados = await email.procesarSecuenciaPostCompra();
      if (enviados > 0) console.log(`[Cron] Secuencia post-compra: ${enviados} emails enviados`);
    } catch (err) {
      console.error('[Cron] Error secuencia post-compra:', err.message);
    }
  });

  // Cada 6 horas — validar campañas de Meta Ads
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron] Validando campañas Meta Ads...');
    try { await validarCampanas(); } catch (err) { console.error('[Cron] Error validando campañas:', err.message); }
  });

  // Cada día a las 9am hora local — lanzar nuevo experimento
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Lanzando experimento diario...');
    await lanzarExperimento();
  }, { timezone: 'America/New_York' });

  // Cada día a las 8pm hora local — reporte diario
  cron.schedule('0 20 * * *', async () => {
    console.log('[Cron] Generando reporte diario...');
    await brain.generarResumenDiario();
  }, { timezone: 'America/New_York' });

  // Cada día a medianoche hora local — resetear contador de gasto Claude
  cron.schedule('0 0 * * *', () => {
    resetCostoHoy();
    console.log('[Cron] Contador de gasto Claude reseteado para nuevo día.');
  }, { timezone: 'America/New_York' });

  console.log('✅ Crons activos: pagos (1h), carritos abandonados (30min), comandos (5seg), experimento (9am), reporte (8pm)');
}

// ════════════════════════════════════
// ARRANQUE
// ════════════════════════════════════

await iniciar();
iniciarAPIServer();
iniciarCrons();

console.log('\n🚀 NEXUS AGENT corriendo. Escribe AYUDA en Telegram para ver comandos.\n');
