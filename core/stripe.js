// ════════════════════════════════════
// NEXUS AGENT — core/stripe.js
// Crear productos, precios y payment links automáticamente
// ════════════════════════════════════

import Stripe from 'stripe';
import dotenv from 'dotenv';
import { db } from './database.js';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeCore = {

  // ── Crear producto + precio + payment link de una sola vez ──
  async crearProductoCompleto({ nombre, descripcion, precio, imagenUrl = null }) {
    // 1. Crear producto en Stripe
    const productoData = {
      name: nombre,
      description: descripcion,
    };
    if (imagenUrl) productoData.images = [imagenUrl];

    const producto = await stripe.products.create(productoData);

    // 2. Crear precio
    const precioObj = await stripe.prices.create({
      product: producto.id,
      unit_amount: Math.round(precio * 100), // Stripe usa centavos
      currency: 'usd',
    });

    // 3. Crear payment link (link directo de pago, sin código)
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: precioObj.id, quantity: 1 }],
      after_completion: {
        type: 'redirect',
        redirect: { url: process.env.MY_DOMAIN ? `https://${process.env.MY_DOMAIN}/gracias` : 'https://nexus-agent.vercel.app/gracias' }
      }
    });

    await db.log('stripe', 'producto_creado', {
      producto_id: producto.id,
      nombre,
      precio,
      payment_link: paymentLink.url
    });

    return {
      stripe_product_id: producto.id,
      stripe_price_id: precioObj.id,
      stripe_payment_link: paymentLink.url,
      precio
    };
  },

  // ── Desactivar producto (experimento muerto) ──
  async desactivarProducto(stripeProductId) {
    await stripe.products.update(stripeProductId, { active: false });
    await db.log('stripe', 'producto_desactivado', { producto_id: stripeProductId });
  },

  // ── Verificar si hubo ventas recientes ──
  async getVentasRecientes(stripeProductId, diasAtras = 3) {
    const desde = Math.floor(Date.now() / 1000) - (diasAtras * 24 * 60 * 60);

    const sesiones = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: desde }
    });

    const ventasDelProducto = sesiones.data.filter(s =>
      s.payment_status === 'paid' &&
      s.line_items // filtramos por producto si hay line_items
    );

    return {
      total_ventas: ventasDelProducto.length,
      revenue: ventasDelProducto.reduce((sum, s) => sum + (s.amount_total || 0) / 100, 0)
    };
  },

  // ── Obtener balance disponible ──
  async getBalance() {
    const balance = await stripe.balance.retrieve();
    const disponible = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
    const pendiente = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;
    return { disponible, pendiente };
  }
};
