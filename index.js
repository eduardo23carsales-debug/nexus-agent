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
import { enviarArchivo } from './core/telegram.js';
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
      if (texto === 'REGENERAR') {
        if (experimentoEnCurso) {
          await enviar('⚠️ Ya hay un proceso en curso. Espera a que termine.');
        } else {
          await enviar('🔄 Regenerando producto del último experimento...');
          experimentoEnCurso = true;
          regenerarUltimoProducto().catch(async (e) => {
            console.error('[Regenerar] Error:', e.message);
            await alerta.errorCritico('regenerar', e.message);
          }).finally(() => { experimentoEnCurso = false; });
        }

      } else if (texto === 'RELANZMETA') {
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

      } else if (texto === 'HOTMART') {
        // Guía completa paso a paso para publicar en Hotmart manualmente
        try {
          const { supabase } = await import('./core/database.js');
          const { data: exps } = await supabase
            .from('experiments')
            .select('*')
            .order('fecha_inicio', { ascending: false })
            .limit(1);

          if (!exps?.length) {
            await enviar('❌ No hay productos publicados todavía. Usa <b>LANZAR</b> primero.');
          } else {
            const exp = exps[0];
            if (exp.hotmart_url && !exp.hotmart_url.includes('undefined')) {
              await enviar(
                `🔥 <b>Hotmart ya configurado</b>\n\n` +
                `📦 ${exp.nombre}\n` +
                `🔗 ${exp.hotmart_url}\n\n` +
                `Para cambiar el link usa:\n<code>SETHOTMART https://pay.hotmart.com/XXXX [keyword]</code>`
              );
            } else {
              const nombreCorto = exp.nombre.slice(0, 22).replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '').toLowerCase();
              const desc = `${exp.descripcion || ''}\n\n${exp.problema_que_resuelve || ''}`.trim();
              const nichoKeywords = (exp.nicho || '').toLowerCase().replace(/[^a-z0-9\sáéíóúñü]/g, '').split(' ').filter(w => w.length > 3).slice(0, 6).join(', ');
              const nombreKeywords = exp.nombre.toLowerCase().replace(/[^a-z0-9\sáéíóúñü]/g, '').split(' ').filter(w => w.length > 3).slice(0, 4).join(', ');
              const tagsHotmart = `${nichoKeywords}, ${nombreKeywords}, latinos usa, español`.replace(/,\s*,/g, ',').slice(0, 255);
              const publicoObj = exp.cliente_ideal || `Latinos en USA que quieren ${exp.nicho} pero no saben por dónde empezar`;
              const ventajas = [
                `✅ Acceso inmediato después de la compra`,
                `✅ Guía paso a paso en español, sin tecnicismos`,
                `✅ ${exp.nombre} — actualizado ${new Date().getFullYear()}`,
                `✅ Herramientas y plantillas listas para usar`,
                `✅ Ejemplos reales con resultados concretos`,
                `✅ Garantía de 7 días sin preguntas`
              ].join('\n');
              const descAfiliados = `Buscamos afiliados con audiencia latina en USA — grupos de Facebook, TikTok, YouTube o email.\n\n✅ Dolor muy real: ${(exp.problema_que_resuelve || exp.descripcion || '').slice(0, 120)}\n✅ Precio accesible: $${exp.precio} — fácil de vender\n✅ 40% comisión por venta\n✅ Garantía 7 días — reduce chargebacks\n\nIdeal para creators de contenido financiero y comunidades latinas.`;
              const promptImagen = `Diseña una imagen de portada para un ebook digital. Título principal: "${exp.nombre}". Estilo: profesional, moderno, oscuro con acento dorado. Fondo degradado azul marino oscuro. Texto en blanco y dorado. Incluye un ícono o ilustración minimalista relacionada con el tema. Formato 1000x1000px. Sin marcos ni bordes decorativos.`;

              // Mensaje 1 — Datos básicos + Pasos 1-3
              await enviar(
                `🔥 <b>GUÍA HOTMART — PASO A PASO</b>\n━━━━━━━━━━━━━\n\n` +
                `<b>📋 PASO 1 — Crear producto</b>\n` +
                `Hotmart → Productos → + Crear → eBook\n\n` +
                `<b>Nombre:</b>\n<code>${exp.nombre}</code>\n\n` +
                `<b>Idioma:</b> Español\n` +
                `<b>Tipo:</b> eBook\n\n` +
                `━━━━━━━━━━━━━\n` +
                `<b>📋 PASO 2 — Precio y garantía</b>\n` +
                `Moneda: USD\n` +
                `<b>Precio:</b> <code>${exp.precio}</code>\n` +
                `Garantía: 7 días\n` +
                `Pago: Único\n\n` +
                `━━━━━━━━━━━━━\n` +
                `<b>📋 PASO 3 — Página de Venta</b>\n` +
                `<code>${exp.url}</code>`
              );

              await new Promise(r => setTimeout(r, 1000));

              // Mensaje 2 — Pasos 4-5
              await enviar(
                `<b>📋 PASO 4 — Páginas de Agradecimiento</b>\n` +
                `URL para Compras Aprobadas:\n<code>${exp.producto_url || exp.url}</code>\n` +
                `⚠️ Espera que Vercel cargue antes de pegar el link\n\n` +
                `━━━━━━━━━━━━━\n` +
                `<b>📋 PASO 5 — Configuración página de pago</b>\n` +
                `Email soporte: <code>eduardo23carsales@gmail.com</code>\n` +
                `Nombre factura: <code>${nombreCorto}</code>\n` +
                `✅ Activar: PayPal, Apple Pay, Google Pay\n` +
                `✅ Activar: Solicitar teléfono en poscompra\n` +
                `→ Guardar\n\n` +
                `━━━━━━━━━━━━━\n` +
                `<b>📋 PASO 6 — Info básica / Marketplace</b>\n` +
                `Categoría: Finanzas Personales\n` +
                `Número de páginas: 45\n` +
                `Formato: PDF\n\n` +
                `<b>Público objetivo:</b>\n<code>${publicoObj.slice(0, 500)}</code>\n\n` +
                `<b>Palabras clave:</b>\n<code>${tagsHotmart}</code>\n\n` +
                `<b>Ventajas:</b>\n<code>${ventajas}</code>`
              );

              await new Promise(r => setTimeout(r, 1000));

              // Mensaje 3 — Pasos 7-9
              await enviar(
                `<b>📋 PASO 7 — Contenido del Producto</b>\n` +
                `1. Busca el archivo HTML que te mandé como documento adjunto\n` +
                `2. Descárgalo → ábrelo en Edge\n` +
                `3. Ctrl+P → Impresora: Microsoft Print to PDF → Imprimir\n` +
                `4. Sube ese PDF en Hotmart → Contenido del Producto\n\n` +
                `━━━━━━━━━━━━━\n` +
                `<b>📋 PASO 8 — Programa de Afiliados</b>\n` +
                `Regla: ✅ Todos con 1 clic\n` +
                `Comisión: <code>40</code>%\n` +
                `Norma: Por último clic\n` +
                `Email afiliados: <code>eduardo23carsales@gmail.com</code>\n` +
                `✅ Activar Mercado de Afiliación\n\n` +
                `<b>Tags afiliados:</b>\n<code>${tagsHotmart}</code>\n\n` +
                `<b>Descripción para afiliados:</b>\n<code>${descAfiliados.slice(0, 400)}</code>\n\n` +
                `━━━━━━━━━━━━━\n` +
                `<b>📋 PASO 9 — Finalizar</b>\n` +
                `→ Clic en "Finalizar Registro"\n` +
                `→ Copiar: pay.hotmart.com/XXXX\n` +
                `→ Mandar aquí: <code>SETHOTMART https://pay.hotmart.com/XXXX ${(exp.nombre.split(' ')[2] || exp.nombre.split(' ')[0]).toLowerCase()}</code>`
              );

              await new Promise(r => setTimeout(r, 1000));

              // Mensaje 4 — Imagen DALL-E
              await enviar(
                `<b>🖼️ PASO IMAGEN — Prompt para DALL-E / ChatGPT</b>\n\n` +
                `<code>${promptImagen}</code>`
              );
            }
          }
        } catch (e) {
          await enviar(`❌ Error: ${e.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 300)}`);
        }

      } else if (texto?.startsWith('SETHOTMART')) {
        // Formato: SETHOTMART [link] [keyword opcional para buscar producto]
        const partes = msg.text.trim().replace(/^SETHOTMART\s*/i, '').trim();
        const [hotmartLink, ...keywordPartes] = partes.split(' ');
        const keyword = keywordPartes.join(' ').trim().toLowerCase();

        if (!hotmartLink || !hotmartLink.startsWith('http')) {
          await enviar('❌ Escribe el link completo. Ejemplo:\n<code>SETHOTMART https://pay.hotmart.com/XXXX</code>\n\nSi quieres especificar el producto:\n<code>SETHOTMART https://pay.hotmart.com/XXXX casa</code>');
        } else {
          try {
            const { supabase } = await import('./core/database.js');
            let exp = null;

            if (keyword) {
              // Buscar por keyword en el nombre del experimento
              const { data: exps } = await supabase
                .from('experiments')
                .select('id, nombre')
                .ilike('nombre', `%${keyword}%`)
                .order('fecha_inicio', { ascending: false })
                .limit(1);
              exp = exps?.[0];
              if (!exp) {
                await enviar(`❌ No encontré ningún experimento con "${keyword}" en el nombre.`);
                return;
              }
            } else {
              // Sin keyword: tomar el más recientemente actualizado sin hotmart_url
              const { data: exps } = await supabase
                .from('experiments')
                .select('id, nombre')
                .is('hotmart_url', null)
                .order('updated_at', { ascending: false })
                .limit(1);
              exp = exps?.[0];
              if (!exp) {
                await enviar('❌ No hay experimentos sin link de Hotmart. Usa <b>HOTMART2</b> para forzar actualización del último.');
                return;
              }
            }

            await supabase
              .from('experiments')
              .update({ hotmart_url: hotmartLink })
              .eq('id', exp.id);
            await enviar(`✅ <b>Hotmart guardado</b>\n\n📦 ${exp.nombre}\n🔥 ${hotmartLink}`);
          } catch (e) {
            await enviar(`❌ Error: ${e.message.slice(0, 300)}`);
          }
        }

      } else if (texto === 'HOTMART2') {
        // Fuerza republicar en Hotmart aunque ya tenga URL
        await enviar('🔥 Forzando republicación en Hotmart...');
        try {
          const { supabase } = await import('./core/database.js');
          const { data: exps } = await supabase
            .from('experiments')
            .select('id, nombre, descripcion, precio, url, producto_url')
            .order('fecha_inicio', { ascending: false })
            .limit(1);

          if (!exps?.length) {
            await enviar('❌ No hay productos publicados todavía.');
          } else {
            const exp = exps[0];
            const { hotmart } = await import('./core/hotmart.js');
            const hData = await hotmart.crearProducto({
              nombre: exp.nombre,
              descripcion: exp.descripcion || exp.nombre,
              precio: exp.precio,
              productoUrl: exp.producto_url || exp.url,
              imagenUrl: null
            });
            await supabase
              .from('experiments')
              .update({ hotmart_id: String(hData.hotmart_id), hotmart_url: hData.hotmart_url })
              .eq('id', exp.id);
            await enviar(
              `✅ <b>Publicado en Hotmart</b>\n\n` +
              `📦 Producto: <b>${exp.nombre}</b>\n` +
              `💰 Precio: $${exp.precio}\n` +
              `🔥 Link: ${hData.hotmart_url}`
            );
          }
        } catch (e) {
          const msgSeguro = e.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 400);
          await enviar(`❌ <b>Hotmart falló</b>\n\n${msgSeguro}`);
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
          `<b>REGENERAR</b> — Regenera el producto del último experimento\n` +
          `<b>ESTADO</b> — Ver experimentos activos\n` +
          `<b>REPORTE</b> — Reporte financiero\n` +
          `<b>TESTMETA</b> — Verifica conexión Meta Ads\n` +
          `<b>TESTTIKTOK</b> — Verifica conexión TikTok Ads\n` +
          `<b>TESTGOOGLE</b> — Verifica conexión Google Ads\n` +
          `<b>TESTHOTMART</b> — Verifica conexión Hotmart\n` +
          `<b>RELANZMETA</b> — Relanza campaña Meta del último producto\n` +
          `<b>HOTMART</b> — Ver datos para crear producto en Hotmart\n` +
          `<b>SETHOTMART [link]</b> — Guardar link de Hotmart del último producto\n\n` +
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
// REGENERAR PRODUCTO DEL ÚLTIMO EXPERIMENTO
// ════════════════════════════════════

async function regenerarUltimoProducto() {
  const { supabase } = await import('./core/database.js');
  const { deploy } = await import('./core/deploy.js');

  // Cargar último experimento
  const { data: exps } = await supabase
    .from('experiments')
    .select('*')
    .order('fecha_inicio', { ascending: false })
    .limit(1);

  if (!exps?.length) {
    await enviar('❌ No hay experimentos publicados todavía.');
    return;
  }

  const exp = exps[0];
  await enviar(`🔄 Regenerando: <b>${exp.nombre}</b>\n\nEsto puede tardar unos minutos...`);

  // Reconstruir objeto nicho desde los datos del experimento
  const nicho = {
    nombre_producto: exp.nombre,
    subtitulo: exp.descripcion,
    nicho: exp.nicho,
    tipo: exp.tipo || 'toolkit',
    precio: exp.precio,
    cliente_ideal: exp.cliente_ideal || '',
    problema_que_resuelve: exp.problema_que_resuelve || '',
    puntos_de_venta: [],
    herramientas_clave: [],
    quick_win: '',
    formato_ad_recomendado: exp.formato_ad || 'feed'
  };

  // Regenerar contenido del producto con el fix de HTML aplicado
  const contenido = await generarProducto(nicho);

  const productoValido = contenido &&
    contenido.length >= 5000 &&
    contenido.includes('</html>') &&
    contenido.includes('tab-panel') &&
    contenido.split('tab-panel').length >= 4;

  if (!productoValido) {
    throw new Error(`Producto regenerado incompleto (${contenido?.length || 0} chars).`);
  }

  // Redesplegar en Vercel — mismo proyecto, actualiza el archivo producto/index.html
  await enviar('🚀 Subiendo producto regenerado a Vercel...');
  const { landingUrl, productoUrl } = await deploy.publicarCompleto({
    nombre: exp.nombre,
    htmlLanding: exp.landing_html,
    htmlProducto: contenido,
    nicho: exp.nicho
  });

  // Actualizar contenido en DB
  await supabase
    .from('experiments')
    .update({ contenido_producto: contenido, producto_url: productoUrl })
    .eq('id', exp.id);

  await enviar(
    `✅ <b>Producto regenerado y actualizado</b>\n\n` +
    `📦 <b>${exp.nombre}</b>\n` +
    `🌐 Landing: ${landingUrl}\n` +
    `📦 Producto: ${productoUrl}\n\n` +
    `Todos los módulos regenerados con el fix de estructura HTML.`
  );
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

  // Generar imagen de portada con DALL-E (se reutiliza en Hotmart, Gumroad y Meta Ads)
  await enviar('🎨 Generando imagen de portada con IA...');
  let imagenProducto = null;
  let imagenUrlPublica = null;
  try {
    const { generarImagenProducto, subirImagenPublica } = await import('./core/imagen.js');
    imagenProducto = await generarImagenProducto({
      nombre: nicho.nombre_producto,
      nicho: nicho.nicho,
      subtitulo: nicho.subtitulo,
      precio: nicho.precio
    });
    if (imagenProducto?.b64) {
      imagenUrlPublica = await subirImagenPublica(imagenProducto.b64);
    }
    if (imagenUrlPublica) {
      await enviar(`✅ Imagen generada y lista para todos los canales`);
    }
  } catch (e) {
    console.warn('[Pipeline] Error generando imagen de portada:', e.message);
  }

  // Crear producto en Stripe
  await enviar('💳 Creando producto en Stripe...');
  const stripeData = await stripeCore.crearProductoCompleto({
    nombre: nicho.nombre_producto,
    descripcion: nicho.problema_que_resuelve,
    precio: nicho.precio,
    imagenUrl: imagenUrlPublica
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
      productoUrl,
      imagenUrl: imagenUrlPublica
    });
    gumroadUrl = gData.gumroad_url;
    console.log(`[Gumroad] Publicado: ${gumroadUrl}`);
  } catch (e) {
    console.error('[Gumroad] Error publicando:', e.message);
  }

  // Hotmart no tiene API para crear productos — se crea manualmente.
  // El bot manda los datos listos para pegar y el usuario registra el link con SETHOTMART.
  let hotmartUrl = null;
  let hotmartId = null;

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
    `\n\n⚡ Lanzando campaña Meta Ads...`
  );

  // Generar archivo HTML de acceso para Hotmart (Eduardo lo convierte a PDF en Edge)
  generarArchivoAccesoHotmart(experimento);

  // Instrucciones para crear el producto en Hotmart manualmente
  await enviar(
    `🔥 <b>HOTMART — listo para publicar</b>\n━━━━━━━━━━━━━\n` +
    `📦 <b>${nicho.nombre_producto}</b>\n` +
    `💰 $${nicho.precio} USD\n\n` +
    `📄 El archivo HTML de acceso te llega por aquí como documento adjunto.\n` +
    `→ Descárgalo → ábrelo en Edge → Ctrl+P → Microsoft Print to PDF\n\n` +
    `Escribe <b>HOTMART</b> para ver la guía completa paso a paso con todo listo para copiar.`
  );

  // Lanzar campaña Meta Ads automáticamente
  lanzarCampanaParaProducto(experimento).catch(async (e) => {
    console.error('[AdsManager] Error en background:', e.message);
    await alerta.errorCritico('ads-manager', `⚠️ Campaña Meta Ads falló para "${experimento.nombre}":\n${e.message}\n\nUsa <b>RELANZMETA</b> para reintentarlo.`).catch(() => {});
  });

  return { url, productoUrl, experimento, stripeData };
}

// ════════════════════════════════════
// GENERAR ARCHIVO HTML DE ACCESO PARA HOTMART (PDF)
// ════════════════════════════════════

async function generarArchivoAccesoHotmart(exp) {
  try {
    const nombre = exp.nombre || 'Producto Digital';
    const precio = exp.precio || 47;
    const productoUrl = exp.producto_url || exp.url || '';
    const email_soporte = 'eduardo23carsales@gmail.com';

    const modulos = [
      { icon: '📚', titulo: 'Guía Principal', desc: 'Contenido completo paso a paso en español.' },
      { icon: '📄', titulo: 'Plantillas y Documentos', desc: 'Listos para usar, solo rellena tus datos.' },
      { icon: '🔧', titulo: 'Herramientas del Kit', desc: 'Las mejores herramientas recomendadas para tu caso.' },
      { icon: '📊', titulo: 'Calculadoras y Recursos', desc: 'Toma decisiones con datos reales.' },
      { icon: '🗺️', titulo: 'Plan de Acción', desc: 'Semana a semana qué hacer para ver resultados.' },
      { icon: '🎯', titulo: 'Casos de Éxito', desc: 'Ejemplos reales de personas como tú.' }
    ];

    const modulosHtml = modulos.map(m => `
      <div class="module">
        <div class="icon">${m.icon}</div>
        <h4>${m.titulo}</h4>
        <p>${m.desc}</p>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${nombre} — Acceso al Producto</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #fff; color: #1a1a2e; }
  .page { max-width: 760px; margin: 0 auto; padding: 60px 48px; }
  .header { text-align: center; padding: 48px 40px; background: linear-gradient(135deg, #0F1729 0%, #1a2a4a 100%); border-radius: 16px; margin-bottom: 40px; color: #fff; }
  .badge { display: inline-block; background: rgba(245,166,35,0.15); color: #F5A623; border: 1px solid rgba(245,166,35,0.4); padding: 5px 18px; border-radius: 20px; font-size: 0.72em; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; }
  .header h1 { font-family: 'Poppins', sans-serif; font-size: 1.8em; font-weight: 800; line-height: 1.2; margin-bottom: 14px; color: #fff; }
  .header p { color: #9AA3B8; font-size: 0.95em; line-height: 1.7; max-width: 520px; margin: 0 auto; }
  .access-box { background: linear-gradient(135deg, #0F1729 0%, #1a2a4a 100%); border-radius: 14px; padding: 32px 40px; margin: 32px 0; text-align: center; border: 1px solid rgba(245,166,35,0.3); }
  .access-box .label { color: #9AA3B8; font-size: 0.82em; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; }
  .access-box .url-link { display: block; font-size: 0.82em; color: #F5A623; word-break: break-all; margin-bottom: 20px; font-weight: 600; line-height: 1.6; text-decoration: underline; }
  .access-box .btn { display: inline-block; background: #F5A623; color: #000; font-weight: 800; padding: 16px 44px; border-radius: 10px; text-decoration: none; font-size: 1.05em; margin-bottom: 16px; }
  .access-box .btn-note { color: #9AA3B8; font-size: 0.78em; margin-top: 12px; }
  .section-title { font-family: 'Poppins', sans-serif; font-size: 1.1em; font-weight: 700; color: #1a1a2e; margin: 36px 0 18px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f5; }
  .steps { display: flex; flex-direction: column; gap: 12px; }
  .step { display: flex; gap: 16px; align-items: flex-start; background: #f8f9ff; border-radius: 12px; padding: 16px 20px; border-left: 4px solid #F5A623; }
  .step-num { background: #F5A623; color: #000; font-weight: 800; font-size: 0.82em; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .step-content h4 { font-size: 0.92em; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .step-content p { font-size: 0.85em; color: #555; line-height: 1.6; }
  .modules { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
  .module { background: #f8f9ff; border-radius: 12px; padding: 16px 18px; border-top: 3px solid #4f8ef7; }
  .module .icon { font-size: 1.3em; margin-bottom: 8px; }
  .module h4 { font-size: 0.85em; font-weight: 700; color: #1a1a2e; margin-bottom: 5px; }
  .module p { font-size: 0.78em; color: #666; line-height: 1.5; }
  .guarantee { display: flex; gap: 18px; align-items: center; background: #f0fff8; border: 1px solid #b2f0d4; border-radius: 14px; padding: 22px 26px; margin: 28px 0; }
  .guarantee .icon { font-size: 2.5em; flex-shrink: 0; }
  .guarantee h4 { font-size: 0.95em; font-weight: 700; color: #065f46; margin-bottom: 6px; }
  .guarantee p { font-size: 0.84em; color: #047857; line-height: 1.6; }
  .support { background: #f8f9ff; border-radius: 14px; padding: 24px 28px; text-align: center; margin-top: 28px; }
  .support h4 { font-size: 0.95em; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
  .support p { font-size: 0.85em; color: #666; line-height: 1.7; }
  .support a { color: #F5A623; font-weight: 600; text-decoration: none; }
  .footer { text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e8e8f0; }
  .footer p { font-size: 0.75em; color: #aaa; line-height: 1.8; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 40px 32px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="badge">📦 Producto Premium · Acceso Inmediato</div>
    <h1>${nombre}</h1>
    <p>Gracias por tu compra. Tienes acceso completo e inmediato a todo el contenido.</p>
  </div>
  <div class="access-box">
    <div class="label">🔑 Tu acceso completo está aquí — guarda este link</div>
    <a class="btn" href="${productoUrl}">▶ Acceder a ${nombre}</a>
    <br>
    <a class="url-link" href="${productoUrl}">${productoUrl}</a>
    <p class="btn-note">Copia y pega este link en tu navegador si el botón no abre · Funciona en celular, tablet y computadora · Sin contraseña</p>
  </div>
  <div class="section-title">📋 Cómo acceder a tu producto en 3 pasos</div>
  <div class="steps">
    <div class="step"><div class="step-num">1</div><div class="step-content"><h4>Haz clic en el botón dorado de arriba</h4><p>O copia y pega el link directamente en tu navegador. Funciona en cualquier dispositivo — no necesitas instalar nada ni crear cuenta.</p></div></div>
    <div class="step"><div class="step-num">2</div><div class="step-content"><h4>Navega por los módulos del menú lateral</h4><p>Haz clic en cada sección del menú para ver el contenido. Cada módulo tiene pasos concretos que puedes ejecutar hoy mismo.</p></div></div>
    <div class="step"><div class="step-num">3</div><div class="step-content"><h4>Guarda el link en favoritos de tu navegador</h4><p>Presiona Ctrl+D (o el ícono ⭐ en tu navegador) para guardarlo. Tu acceso es de por vida — no expira nunca.</p></div></div>
  </div>
  <div class="section-title">📚 Lo que incluye tu kit</div>
  <div class="modules">${modulosHtml}</div>
  <div class="guarantee">
    <div class="icon">🛡️</div>
    <div>
      <h4>Garantía de 7 días — Sin preguntas</h4>
      <p>Si por cualquier razón no es lo que esperabas, contáctanos dentro de los 7 días y te devolvemos el 100% de tu dinero. Sin formularios ni complicaciones.</p>
    </div>
  </div>
  <div class="support">
    <h4>¿Tienes alguna pregunta o problema para acceder?</h4>
    <p>Escríbenos y te respondemos en menos de 24 horas, de lunes a viernes.<br>
    📧 <a href="mailto:${email_soporte}">${email_soporte}</a><br><br>
    <strong>Incluye en tu mensaje:</strong> tu nombre, email de compra y describe tu problema.<br>
    Te ayudamos con gusto.</p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} ${nombre} · Todos los derechos reservados<br>
    Tu compra está protegida por la <strong>Garantía de 7 días</strong> de Hotmart.<br>
    Compra procesada de forma segura por <strong>Hotmart</strong></p>
  </div>
</div>
</body>
</html>`;

    const buffer = Buffer.from(html, 'utf8');
    const filename = `hotmart-acceso-${(nombre).replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}.html`;
    await enviarArchivo(buffer, filename, `📄 PDF de acceso para Hotmart\n→ Descárgalo → ábrelo en Edge → Ctrl+P → Microsoft Print to PDF → súbelo en Hotmart`);
    console.log(`[Hotmart] Archivo de acceso enviado por Telegram: ${filename}`);
  } catch (err) {
    console.error('[Hotmart] Error generando archivo de acceso:', err.message);
  }
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
