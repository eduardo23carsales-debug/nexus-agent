// ════════════════════════════════════
// NEXUS AGENT — core/hotmart.js
// Publica productos digitales en Hotmart automáticamente
// Docs: https://developers.hotmart.com/docs/en/
// ════════════════════════════════════

import axios from 'axios';
import { db } from './database.js';

const IS_SANDBOX = process.env.HOTMART_ENV === 'sandbox';
const AUTH_URL = IS_SANDBOX
  ? 'https://api-sec-vlc.hotmart.com/security/oauth/token'
  : 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const BASE = IS_SANDBOX
  ? 'https://sandbox.hotmart.com/product/api/v1'
  : 'https://developers.hotmart.com/product/api/v1';

// Cache de token en memoria (dura 1h)
let _token = null;
let _tokenExpira = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpira) return _token;

  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  const basic = process.env.HOTMART_BASIC; // base64 de client_id:client_secret

  if (!clientId || !clientSecret) throw new Error('HOTMART_CLIENT_ID / HOTMART_CLIENT_SECRET no configurados');

  const credentials = basic || Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await axios.post(AUTH_URL, null, {
    params: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret },
    headers: { Authorization: `Basic ${credentials}` }
  });

  _token = res.data.access_token;
  _tokenExpira = Date.now() + (res.data.expires_in - 60) * 1000; // renovar 60s antes
  return _token;
}

export const hotmart = {

  // ── Crea un producto en Hotmart y devuelve el link de checkout ──
  async crearProducto({ nombre, descripcion, precio, productoUrl }) {
    if (!process.env.HOTMART_CLIENT_ID) throw new Error('HOTMART_CLIENT_ID no configurado');

    const token = await getToken();

    // Crear producto digital
    const payload = {
      name: nombre,
      description: descripcion.substring(0, 500),
      price: { currency_code: 'USD', value: precio },
      payment_type: 'SINGLE_PAYMENT',
      product_type: 'EBOOK',         // tipo digital — no requiere envío
      warranty_days: 7,              // garantía de 7 días (estándar Hotmart)
      sales_page_url: productoUrl || undefined
    };

    const res = await axios.post(`${BASE}/products`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const producto = res.data;
    const checkoutUrl = producto.checkout_url || `https://pay.hotmart.com/${producto.product_id}`;

    await db.log('hotmart', 'producto_creado', {
      id: producto.product_id,
      nombre: producto.name,
      precio: precio,
      link: checkoutUrl
    });

    console.log(`[Hotmart] Producto publicado: ${checkoutUrl}`);
    return {
      hotmart_id: producto.product_id,
      hotmart_url: checkoutUrl
    };
  },

  // ── Verifica que las credenciales funcionen ──
  async ping() {
    if (!process.env.HOTMART_CLIENT_ID) throw new Error('HOTMART_CLIENT_ID no configurado');
    const token = await getToken();
    const res = await axios.get(`${BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 0, size: 1 }
    });
    return { ok: true, productos: res.data?.items?.length ?? 0 };
  }
};

// ── Procesar un evento de compra de Hotmart ──
// Recibe el objeto de la notificación del webhook de Hotmart
export async function procesarVentaHotmart({ data, event }) {
  if (event !== 'PURCHASE_COMPLETE' && event !== 'PURCHASE_APPROVED') return;

  const emailCliente = data?.buyer?.email;
  const nombreCliente = data?.buyer?.name;
  const productoId = String(data?.product?.id || '');
  const monto = data?.purchase?.price?.value || 0;

  if (!emailCliente) return;

  // Buscar experimento por hotmart_id guardado en DB
  const { data: exps } = await db.supabase
    .from('experiments')
    .select('*')
    .eq('hotmart_id', productoId)
    .limit(1);

  const exp = exps?.[0];
  if (!exp) {
    console.warn(`[Hotmart] Venta recibida pero no hay experimento con hotmart_id=${productoId}`);
    return;
  }

  // Verificar si ya fue entregado
  const yaEntregado = await db.getCustomerPorEmail(emailCliente);
  if (yaEntregado) return;

  const { email } = await import('./email.js');
  await email.entregarProducto({
    para: emailCliente,
    nombreCliente,
    nombreProducto: exp.nombre,
    contenido: exp.contenido_producto || `Bienvenido a ${exp.nombre}.\n\nTu acceso está listo.`,
    productoUrl: exp.producto_url || null,
    stripePaymentId: `hotmart_${data?.purchase?.transaction || Date.now()}`
  });

  await db.crearCustomer({
    email: emailCliente,
    nombre: nombreCliente,
    experiment_id: exp.id,
    producto: exp.nombre,
    revenue: monto,
    stripe_customer_id: `hotmart_${productoId}`
  });

  console.log(`[Hotmart] Producto entregado a ${emailCliente}`);
}
