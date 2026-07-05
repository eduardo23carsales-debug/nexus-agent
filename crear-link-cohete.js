// ════════════════════════════════════
// crear-link-cohete.js — crea el producto + payment link del Cohete Bot ($997)
// Uso:  node crear-link-cohete.js
// Imprime el COHETE_PAYMENT_LINK (plink_...) para el .env y la URL para el Lite.
// ════════════════════════════════════
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE = Number(process.env.COHETE_PRICE_USD || '997');
const GRACIAS = process.env.COHETE_GRACIAS_URL || 'https://wallstreetsniperbot.com/gracias';

const product = await stripe.products.create({
  name: 'Cohete Bot Lite',
  description: 'Licencia de por vida — acceso completo a cualquier cuenta. Uso en 1 PC.'
});
const price = await stripe.prices.create({
  product: product.id, unit_amount: PRICE * 100, currency: 'usd'
});
const link = await stripe.paymentLinks.create({
  line_items: [{ price: price.id, quantity: 1 }],
  after_completion: { type: 'redirect', redirect: { url: GRACIAS } }
});

console.log('\n=== COHETE — link de pago creado ($' + PRICE + ') ===\n');
console.log('1) Pegá esto en tu .env (para que el webhook detecte la compra):');
console.log('   COHETE_PAYMENT_LINK=' + link.id + '\n');
console.log('2) Usá esta URL como "stripe_url" en el config del Lite (el botón de pagar):');
console.log('   ' + link.url + '\n');
console.log('   product_id=' + product.id + '  price_id=' + price.id + '\n');
