// ════════════════════════════════════
// NEXUS AGENT — agents/digital/publisher.js
// Crea landing page, sube a Vercel, crea link de Stripe
// Manda preview al dueño ANTES de publicar
// ════════════════════════════════════

import { preguntar } from '../../core/claude.js';
import { stripeCore } from '../../core/stripe.js';
import { deploy } from '../../core/deploy.js';
import { db } from '../../core/database.js';
import { enviar, pedirAprobacion } from '../../core/telegram.js';
import fs from 'fs/promises';
import path from 'path';

// ── Genera el HTML de la landing page ──
async function generarHTML(nicho, contenido, stripeLink) {
  const beneficios = nicho.puntos_de_venta.map(p => `<li>✅ ${p}</li>`).join('\n');

  const html = await preguntar(`
Crea una landing page de ventas en HTML completo. USA ESTILOS INLINE (style="") para todo, NO uses bloques <style> ni CSS externo. Esto es crítico para que funcione.

Producto: ${nicho.nombre_producto}
Subtítulo: ${nicho.subtitulo}
Precio: $${nicho.precio}
Problema: ${nicho.problema_que_resuelve}
Cliente: ${nicho.cliente_ideal}
Link de pago: ${stripeLink}

Estructura EXACTA a seguir:

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[TITULO]</title>
</head>
<body style="margin:0;font-family:Arial,sans-serif;background:#0f0f0f;color:#fff;">

<!-- HERO -->
<div style="background:#111;padding:60px 20px;text-align:center;">
  <h1 style="font-size:2.5em;color:#00ff88;margin-bottom:16px;">[HEADLINE IMPACTANTE]</h1>
  <p style="font-size:1.2em;color:#ccc;max-width:600px;margin:0 auto 32px;">[SUBTITULO]</p>
  <a href="${stripeLink}" class="nexus-cta-btn" style="background:#00ff88;color:#000;padding:18px 40px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">⚡ SÍ, QUIERO ACCESO AHORA — $${nicho.precio}</a>
  <p style="color:#ff9900;margin-top:16px;font-size:0.95em;font-weight:bold;">⏰ Precio de lanzamiento — termina en: <span id="nexus-countdown" style="font-family:monospace;">48:00:00</span></p>
</div>

<!-- PROBLEMA -->
<div style="max-width:700px;margin:60px auto;padding:0 20px;">
  <h2 style="color:#00ff88;font-size:1.8em;">¿Te suena familiar?</h2>
  <p style="color:#ccc;font-size:1.1em;line-height:1.8;">[DESCRIPCION DEL PROBLEMA DEL CLIENTE EN 3-4 ORACIONES]</p>
</div>

<!-- BENEFICIOS -->
<div style="background:#111;padding:60px 20px;text-align:center;">
  <h2 style="color:#fff;font-size:1.8em;margin-bottom:40px;">¿Qué incluye?</h2>
  <ul style="list-style:none;max-width:600px;margin:0 auto;text-align:left;padding:0;">
    ${beneficios}
  </ul>
</div>

<!-- PRECIO -->
<div style="max-width:500px;margin:60px auto;padding:0 20px;text-align:center;">
  <div style="background:#1a1a1a;border:2px solid #00ff88;border-radius:16px;padding:40px;">
    <p style="color:#ff9900;font-size:0.9em;font-weight:bold;margin-bottom:4px;">⚠️ PRECIO DE LANZAMIENTO — TERMINA EN:</p>
    <p style="color:#ff9900;font-size:1.8em;font-weight:bold;font-family:monospace;margin:0 0 12px;" id="nexus-countdown-2">48:00:00</p>
    <p style="color:#00ff88;font-size:3em;font-weight:bold;margin:0;">$${nicho.precio}</p>
    <p style="color:#888;font-size:0.9em;margin:8px 0 24px;">Pago único — Acceso inmediato</p>
    <a href="${stripeLink}" class="nexus-cta-btn" style="display:block;background:#00ff88;color:#000;padding:18px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;">🔓 QUIERO ACCESO AHORA</a>
    <p style="color:#888;font-size:0.8em;margin-top:12px;">🔒 Pago 100% seguro con Stripe · Garantía 30 días</p>
  </div>
</div>

<!-- TESTIMONIOS -->
<div style="background:#111;padding:60px 20px;">
  <h2 style="text-align:center;color:#fff;margin-bottom:40px;">Lo que dicen nuestros clientes</h2>
  <div style="max-width:700px;margin:0 auto;">
    [3 TESTIMONIOS REALISTAS con nombre, ciudad y resultado específico]
  </div>
</div>

<!-- GARANTIA -->
<div style="max-width:600px;margin:60px auto;padding:20px;text-align:center;">
  <h2 style="color:#00ff88;">Garantía 30 días</h2>
  <p style="color:#ccc;">[TEXTO DE GARANTIA]</p>
</div>

<!-- CTA FINAL -->
<div style="background:#00ff88;padding:60px 20px;text-align:center;">
  <h2 style="color:#000;font-size:2em;margin-bottom:8px;">[HEADLINE URGENCIA]</h2>
  <p style="color:#004400;margin-bottom:24px;font-weight:bold;">⏰ Precio de $${nicho.precio} termina en: <span id="nexus-countdown-3" style="font-family:monospace;">48:00:00</span></p>
  <a href="${stripeLink}" class="nexus-cta-btn" style="background:#000;color:#00ff88;padding:18px 40px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">⚡ ACCESO INMEDIATO — $${nicho.precio}</a>
  <p style="color:#004400;margin-top:16px;font-size:0.9em;">🔒 Pago seguro · Garantía 30 días · Sin preguntas</p>
</div>

<!-- FOOTER -->
<div style="background:#0a0a0a;padding:20px;text-align:center;">
  <p style="color:#555;font-size:0.8em;">© 2026 ${nicho.nombre_producto} — Todos los derechos reservados</p>
</div>

</body>
</html>

Llena TODOS los [PLACEHOLDERS] con contenido real del producto. Devuelve SOLO el HTML final, nada más.
`, 'Eres experto en landing pages de alta conversión para el mercado hispano.', 'publisher', 8000);

  // Limpia posibles bloques de código
  let htmlLimpio = html
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Inyectar Meta Pixel para tracking de visitantes y conversiones
  const pixelId = process.env.META_PIXEL_ID;
  if (pixelId) {
    const pixelCode = `
<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
fbq('track', 'ViewContent', {
  content_name: '${nicho.nombre_producto.replace(/'/g, "\\'")}',
  content_category: '${nicho.nicho.replace(/'/g, "\\'")}',
  value: ${nicho.precio},
  currency: 'USD'
});
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel -->`;

    htmlLimpio = htmlLimpio.replace('</head>', pixelCode + '\n</head>');
    console.log(`[Publisher] Meta Pixel ${pixelId} inyectado en landing page`);
  } else {
    console.warn('[Publisher] META_PIXEL_ID no configurado — pixel no inyectado');
  }

  // ── Inyectar countdown + InitiateCheckout pixel al hacer click ──
  const productoKey = nicho.nombre_producto.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const conversionScript = `
<!-- Nexus: Countdown + Pixel InitiateCheckout -->
<script>
(function() {
  // Countdown 48h desde primera visita (persiste en localStorage)
  var key = 'nexus_offer_${productoKey}';
  var end = parseInt(localStorage.getItem(key) || '0');
  if (!end || end < Date.now()) {
    end = Date.now() + 48 * 3600000;
    localStorage.setItem(key, end);
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tick() {
    var diff = Math.max(0, end - Date.now());
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var txt = pad(h) + ':' + pad(m) + ':' + pad(s);
    ['nexus-countdown','nexus-countdown-2','nexus-countdown-3'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = txt;
    });
    if (diff > 0) setTimeout(tick, 1000);
  }
  tick();

  // InitiateCheckout pixel al hacer click en cualquier botón de pago
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nexus-cta-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (typeof fbq !== 'undefined') {
          fbq('track', 'InitiateCheckout', {
            value: ${nicho.precio},
            currency: 'USD',
            content_name: '${nicho.nombre_producto.replace(/'/g, "\\'")}'
          });
        }
      });
    });
  });
})();
</script>`;

  htmlLimpio = htmlLimpio.replace('</body>', conversionScript + '\n</body>');
  console.log(`[Publisher] Countdown 48h + pixel InitiateCheckout inyectados`);

  return htmlLimpio;
}

// ── FUNCIÓN PRINCIPAL ──
export async function publicarProducto(nicho, contenido) {
  console.log(`[Publisher] Preparando publicación: "${nicho.nombre_producto}"...`);

  // 1. Crear producto y payment link en Stripe
  console.log('[Publisher] Creando producto en Stripe...');
  const stripeData = await stripeCore.crearProductoCompleto({
    nombre: nicho.nombre_producto,
    descripcion: nicho.problema_que_resuelve,
    precio: nicho.precio
  });
  console.log(`[Publisher] Stripe listo — ${stripeData.stripe_payment_link}`);

  // 2. Generar HTML de la landing
  console.log('[Publisher] Generando landing page...');
  const html = await generarHTML(nicho, contenido, stripeData.stripe_payment_link);

  // 3. Guardar preview local para que el dueño pueda verla
  const previewDir = path.join(process.cwd(), 'products');
  await fs.mkdir(previewDir, { recursive: true });
  const previewPath = path.join(previewDir, `preview-${Date.now()}.html`);
  await fs.writeFile(previewPath, html, 'utf-8');
  console.log(`[Publisher] Preview guardado: ${previewPath}`);

  // 4. Avisar al dueño y pedir aprobación
  await enviar(
    `🎨 <b>LANDING LISTA PARA REVISAR</b>\n\n` +
    `<b>Producto:</b> ${nicho.nombre_producto}\n` +
    `<b>Precio:</b> $${nicho.precio}\n` +
    `<b>Nicho:</b> ${nicho.nicho}\n\n` +
    `<b>Preview local:</b>\n<code>${previewPath}</code>\n\n` +
    `Abre ese archivo en tu navegador para verla.\n` +
    `Luego responde:\n1. PUBLICAR\n2. CANCELAR`
  );

  // 5. Esperar aprobación (4 horas timeout → publica automático)
  const decision = await pedirAprobacion(
    `¿Publicar "${nicho.nombre_producto}" a $${nicho.precio}?`,
    ['PUBLICAR', 'CANCELAR'],
    'PUBLICAR'
  );

  if (decision === 'CANCELAR') {
    await db.log('publisher', 'publicacion_cancelada', { nicho: nicho.nicho });
    console.log('[Publisher] Publicación cancelada por el dueño');
    return null;
  }

  // 6. Publicar en Vercel
  console.log('[Publisher] Subiendo a Vercel...');
  const url = await deploy.publicarLanding({
    nombre: nicho.nombre_producto,
    html,
    nicho: nicho.nicho
  });

  // 7. Guardar experimento en DB
  const experimento = await db.crearExperimento({
    nicho: nicho.nicho,
    tipo: nicho.tipo,
    nombre: nicho.nombre_producto,
    descripcion: nicho.subtitulo,
    url,
    stripe_product_id: stripeData.stripe_product_id,
    stripe_payment_link: stripeData.stripe_payment_link,
    precio: nicho.precio,
    estado: 'corriendo',
    contenido_producto: contenido,
    landing_html: html
  });

  // 8. Notificar al dueño con el link final
  await enviar(
    `🚀 <b>PRODUCTO PUBLICADO</b>\n\n` +
    `<b>Producto:</b> ${nicho.nombre_producto}\n` +
    `<b>Precio:</b> $${nicho.precio}\n` +
    `🌐 <b>Landing:</b> ${url}\n` +
    `💳 <b>Link de pago:</b> ${stripeData.stripe_payment_link}\n\n` +
    `<i>Decisión en 72 horas — el sistema monitorea ventas automáticamente</i>`
  );

  console.log(`[Publisher] Publicado en: ${url}`);
  return { url, experimento, stripeData };
}
