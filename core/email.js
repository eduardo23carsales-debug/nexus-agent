// ════════════════════════════════════
// NEXUS AGENT — core/email.js
// Entrega productos por email con Resend
// ════════════════════════════════════

import { Resend } from 'resend';
import dotenv from 'dotenv';
import { db } from './database.js';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Email remitente — Resend permite usar onboarding@resend.dev en modo prueba
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'NEXUS Products';

export const email = {

  // ── Entrega el producto digital al comprador ──
  async entregarProducto({ para, nombreCliente, nombreProducto, contenido, productoUrl, stripePaymentId }) {
    const asunto = `✅ Tu acceso a "${nombreProducto}" — Aquí está todo`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
  <div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px 32px;text-align:center;border-bottom:3px solid #00ff88;">
      <p style="color:#00ff88;font-size:0.85em;font-weight:bold;margin:0 0 12px;letter-spacing:2px;">NEXUS PRODUCTS</p>
      <h1 style="color:#fff;margin:0 0 8px;font-size:1.6em;line-height:1.3;">✅ ¡Tu compra fue exitosa!</h1>
      <p style="color:#aaa;margin:0;font-size:1em;">Tu producto está listo para usar</p>
    </div>

    <!-- Body -->
    <div style="padding:40px 32px;">
      <p style="font-size:1.1em;color:#e0e0e0;margin:0 0 16px;">Hola${nombreCliente ? ` <strong style="color:#00ff88;">${nombreCliente}</strong>` : ''},</p>
      <p style="color:#aaa;line-height:1.8;margin:0 0 32px;">
        Gracias por tu compra de <strong style="color:#fff;">${nombreProducto}</strong>.
        Aquí debajo tienes el botón para acceder a tu producto completo.
      </p>

      ${productoUrl ? `
      <!-- CTA Principal -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${productoUrl}" style="background:#00ff88;color:#000;padding:18px 40px;font-size:1.15em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">
          🚀 Abrir mi producto ahora
        </a>
        <p style="color:#666;font-size:0.85em;margin:12px 0 0;">Guarda este link — es tu acceso permanente</p>
      </div>

      <div style="background:#0d1f0d;border:1px solid #00ff88;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0;color:#00ff88;font-size:0.95em;">
          📌 <strong>Tu link de acceso:</strong><br>
          <a href="${productoUrl}" style="color:#00ff88;word-break:break-all;">${productoUrl}</a>
        </p>
      </div>
      ` : `
      <!-- Contenido directo si no hay URL -->
      <div style="background:#111;border-left:4px solid #00ff88;padding:24px;border-radius:8px;margin:24px 0;">
        <p style="color:#00ff88;font-weight:bold;margin:0 0 16px;">📦 Tu producto:</p>
        <div style="color:#ccc;line-height:1.8;font-size:0.95em;">${contenido.slice(0, 5000)}</div>
      </div>
      `}

      <!-- Info de soporte -->
      <div style="background:#111;border:1px solid #333;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0;color:#888;font-size:0.9em;">
          💬 <strong style="color:#ccc;">¿Necesitas ayuda?</strong> Responde este email y te atendemos.<br>
          🔒 <strong style="color:#ccc;">Pago seguro</strong> procesado por Stripe.
          ${stripePaymentId ? `Referencia: <code style="color:#666;">${stripePaymentId.slice(-8)}</code>` : ''}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#111;padding:24px 32px;text-align:center;border-top:1px solid #222;">
      <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME} · Todos los derechos reservados © 2026</p>
    </div>
  </div>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: para,
      subject: asunto,
      html
    });

    if (error) {
      await db.log('email', 'error_entrega', { para, error: error.message, producto: nombreProducto }, false);
      throw new Error(`Error enviando email: ${error.message}`);
    }

    await db.log('email', 'producto_entregado', {
      para,
      producto: nombreProducto,
      resend_id: data?.id
    });

    console.log(`[Email] Producto entregado a ${para}`);
    return data;
  },

  // ── Verifica pagos nuevos en Stripe y entrega productos ──
  async procesarPagosNuevos() {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Buscar pagos de las últimas 2 horas que no se hayan procesado
    const desde = Math.floor(Date.now() / 1000) - (2 * 60 * 60);

    const sesiones = await stripe.checkout.sessions.list({
      limit: 50,
      created: { gte: desde }
    });

    const pagosPendientes = sesiones.data.filter(s => s.payment_status === 'paid');
    console.log(`[Email] ${pagosPendientes.length} pagos recientes encontrados`);

    let entregados = 0;

    for (const sesion of pagosPendientes) {
      const emailCliente = sesion.customer_details?.email;
      if (!emailCliente) continue;

      // Verificar si ya fue entregado (buscar en customers)
      const yaEntregado = await db.getCustomerPorEmail(emailCliente);
      if (yaEntregado) continue;

      // Buscar el experimento que corresponde a este pago por payment link
      const { data: exps } = await db.supabase
        .from('experiments')
        .select('*')
        .not('stripe_payment_link', 'is', null)
        .order('fecha_inicio', { ascending: false })
        .limit(20);

      if (!exps?.length) continue;

      // Primero busca por payment link exacto, si no toma el más reciente
      const exp = exps.find(e =>
        sesion.payment_link && e.stripe_payment_link?.includes(sesion.payment_link)
      ) || exps[0];

      const contenidoProducto = exp.contenido_producto ||
        `Bienvenido a ${exp.nombre}.\n\nGracias por tu compra. Recibirás el contenido completo en las próximas horas.`;

      // Entregar por email
      try {
        await this.entregarProducto({
          para: emailCliente,
          nombreCliente: sesion.customer_details?.name,
          nombreProducto: exp.nombre,
          contenido: contenidoProducto,
          productoUrl: exp.producto_url || null,
          stripePaymentId: sesion.payment_intent
        });

        // Registrar cliente
        await db.crearCustomer({
          email: emailCliente,
          nombre: sesion.customer_details?.name,
          experiment_id: exp.id,
          producto: exp.nombre,
          revenue: sesion.amount_total / 100,
          stripe_customer_id: sesion.customer
        });

        entregados++;
      } catch (err) {
        console.error(`[Email] Error entregando a ${emailCliente}:`, err.message);
      }
    }

    console.log(`[Email] ${entregados} productos entregados`);
    return entregados;
  },

  // ── Ping — verifica que Resend funcione ──
  async ping() {
    // Solo verifica que el cliente esté inicializado
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');
    return true;
  }
};
