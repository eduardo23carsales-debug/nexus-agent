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
  async entregarProducto({ para, nombreCliente, nombreProducto, contenido, stripePaymentId }) {
    const asunto = `✅ Tu acceso a "${nombreProducto}" — Aquí está todo`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#0f0f0f;padding:32px;text-align:center;">
      <h1 style="color:#00ff88;margin:0;font-size:1.5em;">✅ ¡Compra exitosa!</h1>
      <p style="color:#ccc;margin:8px 0 0;">Tu producto está listo</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="font-size:1.1em;color:#333;">Hola${nombreCliente ? ` <strong>${nombreCliente}</strong>` : ''},</p>
      <p style="color:#555;line-height:1.7;">
        Gracias por tu compra. Aquí tienes acceso completo a
        <strong>${nombreProducto}</strong>. Todo el contenido está incluido abajo.
      </p>

      <div style="background:#f9f9f9;border-left:4px solid #00ff88;padding:24px;border-radius:8px;margin:24px 0;">
        <h2 style="color:#333;margin:0 0 16px;font-size:1.1em;">📦 Tu producto:</h2>
        <div style="color:#444;line-height:1.8;white-space:pre-wrap;font-size:0.95em;">${contenido.slice(0, 8000)}</div>
        ${contenido.length > 8000 ? '<p style="color:#888;font-size:0.85em;margin-top:16px;"><em>(Contenido completo — ver abajo)</em></p>' : ''}
      </div>

      ${contenido.length > 8000 ? `
      <div style="background:#f9f9f9;border-left:4px solid #0066ff;padding:24px;border-radius:8px;margin:24px 0;">
        <div style="color:#444;line-height:1.8;white-space:pre-wrap;font-size:0.95em;">${contenido.slice(8000)}</div>
      </div>` : ''}

      <div style="background:#fff8e1;border:1px solid #ffcc00;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0;color:#555;font-size:0.9em;">
          💡 <strong>Tip:</strong> Guarda este email para acceder a tu producto cuando lo necesites.
          Si tienes preguntas, responde directamente a este correo.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0f0f0f;padding:20px;text-align:center;">
      <p style="color:#555;font-size:0.8em;margin:0;">
        ${FROM_NAME} · Pago verificado por Stripe
        ${stripePaymentId ? `· Ref: ${stripePaymentId.slice(-8)}` : ''}
      </p>
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
