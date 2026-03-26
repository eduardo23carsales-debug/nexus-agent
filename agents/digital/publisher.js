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
  <a href="${stripeLink}" style="background:#00ff88;color:#000;padding:18px 40px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;">QUIERO ESTO — $${nicho.precio}</a>
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
    <p style="color:#ccc;font-size:1em;margin-bottom:8px;">PRECIO DE LANZAMIENTO</p>
    <p style="color:#00ff88;font-size:3em;font-weight:bold;margin:0;">$${nicho.precio}</p>
    <p style="color:#888;font-size:0.9em;margin:8px 0 24px;">Pago único — Acceso inmediato</p>
    <a href="${stripeLink}" style="display:block;background:#00ff88;color:#000;padding:18px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;">COMPRAR AHORA</a>
    <p style="color:#888;font-size:0.8em;margin-top:12px;">🔒 Pago seguro con Stripe</p>
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
  <h2 style="color:#000;font-size:2em;margin-bottom:24px;">[HEADLINE URGENCIA]</h2>
  <a href="${stripeLink}" style="background:#000;color:#00ff88;padding:18px 40px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;">SÍ, LO QUIERO AHORA — $${nicho.precio}</a>
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
  return html
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
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
