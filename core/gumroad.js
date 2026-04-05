// ════════════════════════════════════
// NEXUS AGENT — core/gumroad.js
// Publica productos digitales en Gumroad automáticamente
// ════════════════════════════════════

import axios from 'axios';
import { db } from './database.js';

const BASE = 'https://api.gumroad.com/v2';
const TOKEN = process.env.GUMROAD_ACCESS_TOKEN;

export const gumroad = {

  // ── Crea un producto en Gumroad y devuelve el link de venta ──
  async crearProducto({ nombre, descripcion, precio, productoUrl, imagenUrl = null }) {
    if (!TOKEN) throw new Error('GUMROAD_ACCESS_TOKEN no configurado');
    try {
      // Gumroad v2 requiere form-urlencoded, no JSON.
      // El token va en la query string — en el body no funciona.
      const params = new URLSearchParams({
        name: nombre,
        description: `${descripcion}\n\n✅ Acceso inmediato después de la compra.`,
        price: String(Math.round(precio * 100)), // en centavos
        currency: 'usd',
        published: 'true',
      });
      if (productoUrl) params.set('url', productoUrl);
      if (imagenUrl)  params.set('preview_url', imagenUrl);

      const res = await axios.post(`${BASE}/products?access_token=${TOKEN}`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const producto = res.data.product;

      await db.log('gumroad', 'producto_creado', {
        id: producto.id,
        nombre: producto.name,
        precio: producto.price,
        link: producto.short_url
      });

      console.log(`[Gumroad] Producto publicado: ${producto.short_url}`);
      return {
        gumroad_id: producto.id,
        gumroad_url: producto.short_url,
        gumroad_preview: producto.preview_url
      };

    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      await db.log('gumroad', 'error_crear_producto', { error: msg }, false);
      throw new Error(`Gumroad error: ${msg}`);
    }
  },

  // ── Lista los productos activos ──
  async listarProductos() {
    const res = await axios.get(`${BASE}/products`, {
      params: { access_token: TOKEN }
    });
    return res.data.products || [];
  },

  // ── Verifica que el token funcione ──
  async ping() {
    if (!TOKEN) throw new Error('GUMROAD_ACCESS_TOKEN no configurado');
    const productos = await this.listarProductos();
    return { ok: true, productos: productos.length };
  }
};
