// ════════════════════════════════════
// NEXUS AGENT — core/email.js
// Entrega productos por email con Resend
// ════════════════════════════════════

import { Resend } from 'resend';
import dotenv from 'dotenv';
import { db, supabase } from './database.js';
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
      created: { gte: desde },
      expand: ['data.payment_link']  // necesario para matching correcto por producto
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
      const { data: exps } = await supabase
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

  // ── Detecta carritos abandonados y envía secuencia de 2 emails ──
  async procesarCarritosAbandonados() {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const ahora = Math.floor(Date.now() / 1000);
    const hace26h = ahora - (26 * 60 * 60);

    // Sesiones de Stripe de las últimas 26h (cubre ventana de ambos emails)
    const sesiones = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: hace26h }
    });

    // Solo las que tienen email del cliente pero no completaron el pago
    const abandonadas = sesiones.data.filter(s =>
      s.payment_status === 'unpaid' && s.customer_details?.email
    );

    if (!abandonadas.length) return 0;

    // Cargar experimentos recientes para resolver el nombre del producto
    const { data: exps } = await supabase
      .from('experiments')
      .select('id, nombre, precio, stripe_payment_link, producto_url')
      .not('stripe_payment_link', 'is', null)
      .order('fecha_inicio', { ascending: false })
      .limit(20);

    let enviados = 0;

    for (const sesion of abandonadas) {
      const emailCliente = sesion.customer_details.email;
      const nombreCliente = sesion.customer_details.name?.split(' ')[0] || '';
      const edadHoras = (ahora - sesion.created) / 3600;

      try {
        // Si ya compró, saltar
        const comprador = await db.getCustomerPorEmail(emailCliente);
        if (comprador) continue;

        // Resolver producto desde el payment link de la sesión
        const exp = exps?.find(e =>
          sesion.payment_link && e.stripe_payment_link?.includes(sesion.payment_link)
        ) || exps?.[0];
        if (!exp) continue;

        if (edadHoras >= 2 && edadHoras < 24) {
          // Email 1 — ¿Tuviste algún problema?
          const yaEnviado = await db.getDigitalLeadPorEmailYFuente(emailCliente, 'abandono_1');
          if (yaEnviado) continue;

          await this._enviarAbandonoEmail1({
            para: emailCliente,
            nombre: nombreCliente,
            producto: exp.nombre,
            precio: exp.precio,
            linkPago: exp.stripe_payment_link
          });
          await db.crearDigitalLead(emailCliente, exp.id, 'abandono_1');
          enviados++;

        } else if (edadHoras >= 24) {
          // Email 2 — Urgencia / última oportunidad
          const yaEnviado = await db.getDigitalLeadPorEmailYFuente(emailCliente, 'abandono_2');
          if (yaEnviado) continue;

          await this._enviarAbandonoEmail2({
            para: emailCliente,
            nombre: nombreCliente,
            producto: exp.nombre,
            precio: exp.precio,
            linkPago: exp.stripe_payment_link
          });
          await db.crearDigitalLead(emailCliente, exp.id, 'abandono_2');
          enviados++;
        }

      } catch (err) {
        console.warn(`[Email] Abandono error para ${emailCliente}: ${err.message}`);
      }
    }

    if (enviados > 0) console.log(`[Email] ${enviados} emails de carrito abandonado enviados`);
    return enviados;
  },

  async _enviarAbandonoEmail1({ para, nombre, producto, precio, linkPago }) {
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
  <div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px 32px;text-align:center;border-bottom:3px solid #f0a500;">
      <h1 style="color:#fff;margin:0;font-size:1.5em;">¿Tuviste algún problema?</h1>
    </div>
    <div style="padding:40px 32px;">
      <p style="font-size:1.1em;color:#e0e0e0;margin:0 0 16px;">${saludo},</p>
      <p style="color:#aaa;line-height:1.8;margin:0 0 24px;">
        Notamos que empezaste a adquirir <strong style="color:#fff;">${producto}</strong> pero no completaste tu compra.
        ¿Ocurrió algo? Si hubo algún problema técnico o tienes dudas, responde este email y te ayudamos de inmediato.
      </p>
      <p style="color:#aaa;line-height:1.8;margin:0 0 32px;">
        Si simplemente se interrumpió, puedes continuar tu compra desde aquí:
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${linkPago}" style="background:#f0a500;color:#000;padding:18px 40px;font-size:1.1em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">
          Completar mi compra — $${precio}
        </a>
      </div>
      <p style="color:#666;font-size:0.9em;text-align:center;">¿Tienes dudas? Responde este email y te contestamos hoy.</p>
    </div>
    <div style="background:#111;padding:24px 32px;text-align:center;border-top:1px solid #222;">
      <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME} · Si no fuiste tú, ignora este mensaje.</p>
    </div>
  </div>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: para,
      subject: `¿Tuviste algún problema con tu compra de "${producto}"?`,
      html
    });
    if (error) throw new Error(error.message);
    console.log(`[Email] Abandono email 1 enviado a ${para}`);
  },

  async _enviarAbandonoEmail2({ para, nombre, producto, precio, linkPago }) {
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
  <div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
    <div style="background:linear-gradient(135deg,#2e1a1a,#3e1616);padding:40px 32px;text-align:center;border-bottom:3px solid #ff4444;">
      <p style="color:#ff4444;font-size:0.85em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">ÚLTIMA OPORTUNIDAD</p>
      <h1 style="color:#fff;margin:0;font-size:1.5em;">⏰ Tu acceso a "${producto}" sigue disponible</h1>
    </div>
    <div style="padding:40px 32px;">
      <p style="font-size:1.1em;color:#e0e0e0;margin:0 0 16px;">${saludo},</p>
      <p style="color:#aaa;line-height:1.8;margin:0 0 24px;">
        Ayer casi adquiriste <strong style="color:#fff;">${producto}</strong>. Miles de latinos ya están usando este recurso para
        mejorar su situación — y tú lo dejaste ir por $${precio}.
      </p>
      <p style="color:#aaa;line-height:1.8;margin:0 0 32px;">
        No sabemos cuánto tiempo más estará disponible a este precio. Si lo necesitas, es ahora.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${linkPago}" style="background:#ff4444;color:#fff;padding:18px 40px;font-size:1.15em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">
          Quiero mi acceso ahora — $${precio}
        </a>
      </div>
      <div style="background:#1a0d0d;border:1px solid #ff4444;border-radius:8px;padding:16px;text-align:center;">
        <p style="margin:0;color:#ff8888;font-size:0.9em;">⚠️ Este es el último recordatorio que te enviaremos.</p>
      </div>
    </div>
    <div style="background:#111;padding:24px 32px;text-align:center;border-top:1px solid #222;">
      <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME} · Si no fuiste tú, ignora este mensaje.</p>
    </div>
  </div>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: para,
      subject: `⏰ Última oportunidad — "${producto}" por $${precio}`,
      html
    });
    if (error) throw new Error(error.message);
    console.log(`[Email] Abandono email 2 enviado a ${para}`);
  },

  // ── Secuencia post-compra: 4 emails automáticos en días 1, 3, 7, 14 ──
  async procesarSecuenciaPostCompra() {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('email, nombre, producto, experiment_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !customers?.length) return 0;

    // Cargar URLs de productos para incluir en emails
    const expIds = [...new Set(customers.map(c => c.experiment_id).filter(Boolean))];
    const { data: exps } = await supabase
      .from('experiments')
      .select('id, producto_url, precio, stripe_payment_link')
      .in('id', expIds);
    const expMap = Object.fromEntries((exps || []).map(e => [e.id, e]));

    const SECUENCIA = [
      { fuente: 'seq_d1',  minDias: 1,  maxDias: 3  },
      { fuente: 'seq_d3',  minDias: 3,  maxDias: 7  },
      { fuente: 'seq_d7',  minDias: 7,  maxDias: 14 },
      { fuente: 'seq_d14', minDias: 14, maxDias: 31 }
    ];

    let enviados = 0;

    for (const customer of customers) {
      const diasDesdeCompra = (Date.now() - new Date(customer.created_at)) / 86400000;
      const exp = expMap[customer.experiment_id] || {};
      const ctx = {
        para: customer.email,
        nombre: customer.nombre?.split(' ')[0] || '',
        producto: customer.producto,
        productoUrl: exp.producto_url || null,
        precio: exp.precio || null,
        stripeLink: exp.stripe_payment_link || null
      };

      for (const paso of SECUENCIA) {
        if (diasDesdeCompra < paso.minDias || diasDesdeCompra >= paso.maxDias) continue;
        try {
          const yaEnviado = await db.getDigitalLeadPorEmailYFuente(customer.email, paso.fuente);
          if (yaEnviado) break;

          await this[`_secuencia_${paso.fuente}`](ctx);
          await db.crearDigitalLead(customer.email, customer.experiment_id, paso.fuente);
          enviados++;
        } catch (err) {
          console.warn(`[Email] Secuencia ${paso.fuente} falló para ${customer.email}: ${err.message}`);
        }
        break; // solo un email por ciclo por cliente
      }
    }

    if (enviados > 0) console.log(`[Email] ${enviados} emails de secuencia post-compra enviados`);
    return enviados;
  },

  async _secuencia_seq_d1({ para, nombre, producto, productoUrl }) {
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:36px 32px;text-align:center;border-bottom:3px solid #00ff88;">
    <p style="color:#00ff88;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 1</p>
    <h1 style="color:#fff;margin:0;font-size:1.5em;">🚀 Empieza aquí — tu primer resultado hoy</h1>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 20px;">Ya tienes acceso a <strong style="color:#fff;">${producto}</strong>. Para que no te pierdas, aquí están los 3 pasos que te recomendamos hacer HOY:</p>
    <div style="margin:24px 0;">
      <div style="background:#0d1f0d;border-left:4px solid #00ff88;border-radius:4px;padding:16px;margin-bottom:12px;">
        <p style="margin:0;color:#00ff88;font-weight:bold;">Paso 1 — Abre el producto ahora</p>
        <p style="margin:8px 0 0;color:#aaa;font-size:0.9em;">Dedica 10 minutos a leer la introducción completa para entender el método.</p>
      </div>
      <div style="background:#0d1a2e;border-left:4px solid #4f8ef7;border-radius:4px;padding:16px;margin-bottom:12px;">
        <p style="margin:0;color:#4f8ef7;font-weight:bold;">Paso 2 — Identifica tu primer caso de uso</p>
        <p style="margin:8px 0 0;color:#aaa;font-size:0.9em;">¿Cuál es el problema más urgente que este producto puede resolver para ti esta semana?</p>
      </div>
      <div style="background:#1f1a0d;border-left:4px solid #f0a500;border-radius:4px;padding:16px;">
        <p style="margin:0;color:#f0a500;font-weight:bold;">Paso 3 — Ejecuta una sola cosa</p>
        <p style="margin:8px 0 0;color:#aaa;font-size:0.9em;">No trates de aplicar todo a la vez. Elige una acción y hazla hoy.</p>
      </div>
    </div>
    ${productoUrl ? `<div style="text-align:center;margin:32px 0;"><a href="${productoUrl}" style="background:#00ff88;color:#000;padding:16px 36px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">📖 Abrir mi producto</a></div>` : ''}
    <p style="color:#666;font-size:0.9em;">¿Tienes una pregunta específica? Responde este email — te contestamos personalmente.</p>
  </div>
  <div style="background:#111;padding:20px 32px;text-align:center;border-top:1px solid #222;">
    <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME} · Responde este email si necesitas ayuda</p>
  </div>
</div>
</body></html>`;
    const { error } = await resend.emails.send({ from: `${FROM_NAME} <${FROM}>`, to: para, subject: `🚀 Empieza aquí — tu primer resultado con "${producto}"`, html });
    if (error) throw new Error(error.message);
    console.log(`[Email] Secuencia día 1 → ${para}`);
  },

  async _secuencia_seq_d3({ para, nombre, producto, productoUrl }) {
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:36px 32px;text-align:center;border-bottom:3px solid #4f8ef7;">
    <p style="color:#4f8ef7;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 3</p>
    <h1 style="color:#fff;margin:0;font-size:1.5em;">¿Ya tuviste tu primer resultado?</h1>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 20px;">Ya llevas 3 días con <strong style="color:#fff;">${producto}</strong>. La mayoría de personas que ven resultados rápidos tienen algo en común: <strong style="color:#fff;">ejecutan antes de entenderlo todo</strong>.</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 24px;">Si todavía no empezaste, no te preocupes — aquí está el truco para avanzar aunque sientas que "no tienes tiempo":</p>
    <div style="background:#111;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 12px;color:#fff;font-weight:bold;">⏱ El método de los 15 minutos</p>
      <p style="margin:0;color:#aaa;font-size:0.95em;line-height:1.8;">Abre el producto. Pon un timer de 15 minutos. Lee solo hasta donde llegues. Haz UNA cosa de lo que leíste. Listo — ya estás avanzando.</p>
    </div>
    ${productoUrl ? `<div style="text-align:center;margin:32px 0;"><a href="${productoUrl}" style="background:#4f8ef7;color:#fff;padding:16px 36px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">▶ Continuar donde lo dejé</a></div>` : ''}
    <p style="color:#666;font-size:0.9em;">¿Atascado en algo específico? Responde este email y te ayudamos.</p>
  </div>
  <div style="background:#111;padding:20px 32px;text-align:center;border-top:1px solid #222;">
    <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME} · Estamos aquí para ayudarte</p>
  </div>
</div>
</body></html>`;
    const { error } = await resend.emails.send({ from: `${FROM_NAME} <${FROM}>`, to: para, subject: `¿Ya aplicaste "${producto}"? Esto te va a ayudar`, html });
    if (error) throw new Error(error.message);
    console.log(`[Email] Secuencia día 3 → ${para}`);
  },

  async _secuencia_seq_d7({ para, nombre, producto, productoUrl }) {
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#1a2e1a,#163e16);padding:36px 32px;text-align:center;border-bottom:3px solid #00ff88;">
    <p style="color:#00ff88;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 7</p>
    <h1 style="color:#fff;margin:0;font-size:1.5em;">🏆 Una semana — mira lo que otros lograron</h1>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 24px;">Ya llevas una semana con acceso a <strong style="color:#fff;">${producto}</strong>. Las personas que más resultados ven son las que hacen una cosa: <strong style="color:#fff;">comparten su progreso</strong> — aunque sea pequeño.</p>
    <div style="margin:24px 0;">
      <div style="background:#0d1f0d;border-radius:8px;padding:20px;margin-bottom:12px;border-left:4px solid #00ff88;">
        <p style="margin:0 0 4px;color:#00ff88;font-weight:bold;">💬 "Lo apliqué el primer día y ahorré 2 horas de trabajo"</p>
        <p style="margin:0;color:#666;font-size:0.85em;">— Cliente de Miami</p>
      </div>
      <div style="background:#0d1f0d;border-radius:8px;padding:20px;border-left:4px solid #00ff88;">
        <p style="margin:0 0 4px;color:#00ff88;font-weight:bold;">💬 "No creía que funcionara tan rápido — ya lo recomendé a 3 personas"</p>
        <p style="margin:0;color:#666;font-size:0.85em;">— Cliente de Texas</p>
      </div>
    </div>
    <p style="color:#aaa;line-height:1.8;margin:24px 0;">¿Cuál es tu resultado de esta semana? Responde este email y cuéntanos — los mejores los compartimos con la comunidad.</p>
    ${productoUrl ? `<div style="text-align:center;margin:32px 0;"><a href="${productoUrl}" style="background:#00ff88;color:#000;padding:16px 36px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">📖 Seguir aprendiendo</a></div>` : ''}
  </div>
  <div style="background:#111;padding:20px 32px;text-align:center;border-top:1px solid #222;">
    <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME} · Cuéntanos tu resultado respondiendo este email</p>
  </div>
</div>
</body></html>`;
    const { error } = await resend.emails.send({ from: `${FROM_NAME} <${FROM}>`, to: para, subject: `🏆 Una semana con "${producto}" — ¿cuál fue tu resultado?`, html });
    if (error) throw new Error(error.message);
    console.log(`[Email] Secuencia día 7 → ${para}`);
  },

  async _secuencia_seq_d14({ para, nombre, producto, productoUrl, stripeLink }) {
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#2e1a2e,#3e163e);padding:36px 32px;text-align:center;border-bottom:3px solid #f0a500;">
    <p style="color:#f0a500;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 14 — EXCLUSIVO</p>
    <h1 style="color:#fff;margin:0;font-size:1.5em;">🎁 Un regalo por ser parte de nuestra comunidad</h1>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 24px;">Ya llevas 2 semanas con <strong style="color:#fff;">${producto}</strong>. Como parte de nuestra comunidad, quiero compartirte algo que no publicamos en ninguna landing:</p>
    <div style="background:#1f150d;border:2px solid #f0a500;border-radius:8px;padding:24px;margin:24px 0;text-align:center;">
      <p style="color:#f0a500;font-weight:bold;font-size:1.1em;margin:0 0 8px;">📌 El siguiente paso después de ${producto}</p>
      <p style="color:#aaa;margin:0 0 20px;font-size:0.95em;line-height:1.7;">Los clientes que más resultados ven combinan este producto con otros recursos de nuestra biblioteca. Escríbenos respondiendo este email y te decimos cuál es el siguiente recurso que te conviene según tu situación.</p>
      <a href="mailto:${FROM}" style="background:#f0a500;color:#000;padding:14px 32px;font-size:1em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">Quiero saber mi siguiente paso</a>
    </div>
    ${productoUrl ? `<div style="text-align:center;margin:24px 0;"><a href="${productoUrl}" style="color:#00ff88;font-size:0.9em;">↩ Volver al producto</a></div>` : ''}
  </div>
  <div style="background:#111;padding:20px 32px;text-align:center;border-top:1px solid #222;">
    <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME} · Responde este email para tu recomendación personalizada</p>
  </div>
</div>
</body></html>`;
    const { error } = await resend.emails.send({ from: `${FROM_NAME} <${FROM}>`, to: para, subject: `🎁 Tu regalo de 2 semanas — solo para ti, ${nombre || 'amigo'}`, html });
    if (error) throw new Error(error.message);
    console.log(`[Email] Secuencia día 14 → ${para}`);
  },

  // ── Ping — verifica que Resend funcione ──
  async ping() {
    // Solo verifica que el cliente esté inicializado
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');
    return true;
  }
};
