// ════════════════════════════════════
// NEXUS AGENT — core/cohete.js
// Puente de venta del COHETE BOT LITE:
//   pago Stripe → emite licencia en el license_server (Python) → la manda por email (Resend)
//
// Reusa TODA la infra existente (Stripe, webhook, Resend). Idempotente: la fuente de
// verdad es el license_server (si el email ya tiene licencia, NO reemite ni reenvía).
//
// ENV que necesita (agregar al .env):
//   COHETE_LICENSE_SERVER_URL   ej. https://cohete-license-server.onrender.com
//   COHETE_ADMIN_KEY            la misma X-Admin-Key del license_server
//   COHETE_PAYMENT_LINK         id del payment link del Cohete (plink_...) — para detectar la compra
//   COHETE_PRICE_USD            fallback de detección por monto (default 997)
//   COHETE_INSTALL_URL          (opcional) link a la guía de instalación / descarga
//   COHETE_FROM_NAME            (opcional) remitente (default "Cohete Bot")
// ════════════════════════════════════

import { Resend } from 'resend';
import axios from 'axios';
import dotenv from 'dotenv';
import { db } from './database.js';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const FROM_NAME = process.env.COHETE_FROM_NAME || 'Cohete Bot';

const LICENSE_SERVER_URL = (process.env.COHETE_LICENSE_SERVER_URL || '').replace(/\/+$/, '');
const ADMIN_KEY = process.env.COHETE_ADMIN_KEY || '';
const PAYMENT_LINK = process.env.COHETE_PAYMENT_LINK || '';
const PRICE_USD = Number(process.env.COHETE_PRICE_USD || '997');
const INSTALL_URL = process.env.COHETE_INSTALL_URL || '';

export const cohete = {

  // ── ¿esta sesión pagada es la compra del Cohete? ──
  // Se identifica SOLO por el payment_link del Cohete (robusto). NO se usa el monto:
  // otro producto de $997 no debe emitir una licencia Cohete ni saltear su entrega normal.
  esCompraCohete(sesion) {
    if (!PAYMENT_LINK) {
      console.warn('[Cohete] COHETE_PAYMENT_LINK no configurado — no puedo identificar la compra del Cohete.');
      return false;
    }
    return !!sesion.payment_link && String(sesion.payment_link) === String(PAYMENT_LINK);
  },

  // ── consulta si el email ya tiene licencia (idempotencia) ──
  async licenciaExistente(email) {
    if (!LICENSE_SERVER_URL || !ADMIN_KEY) return null;
    try {
      const { data } = await axios.get(`${LICENSE_SERVER_URL}/api/admin/get`, {
        params: { email }, headers: { 'X-Admin-Key': ADMIN_KEY }, timeout: 10000
      });
      return data?.exists ? data : null;
    } catch (e) {
      console.warn('[Cohete] no pude consultar licencia previa:', e.message);
      return null; // ante la duda, seguimos (mejor emitir que dejar al cliente sin nada)
    }
  },

  // ── emite la licencia en el license_server ──
  async emitirLicencia(email) {
    if (!LICENSE_SERVER_URL || !ADMIN_KEY) {
      throw new Error('Falta COHETE_LICENSE_SERVER_URL o COHETE_ADMIN_KEY en el .env');
    }
    const { data } = await axios.post(`${LICENSE_SERVER_URL}/api/admin/issue`,
      { email },
      { headers: { 'X-Admin-Key': ADMIN_KEY, 'Content-Type': 'application/json' }, timeout: 15000 });
    if (!data?.key) throw new Error(`license_server no devolvió clave: ${JSON.stringify(data)}`);
    return data.key;
  },

  // ── email de entrega de la licencia (branded Cohete) ──
  async _enviarLicenciaEmail({ para, nombre, licencia }) {
    const asunto = '🚀 Tu licencia de Cohete Bot — acceso completo';
    const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0b0f1a;">
  <div style="max-width:600px;margin:40px auto;background:#111826;border-radius:14px;overflow:hidden;border:1px solid #1e293b;">
    <div style="background:linear-gradient(135deg,#0ea5e9,#8b5cf6);padding:40px 32px;text-align:center;">
      <div style="font-size:44px;line-height:1;">🚀</div>
      <h1 style="color:#fff;margin:10px 0 4px;font-size:1.5em;">¡Bienvenido a Cohete Bot!</h1>
      <p style="color:#e0e7ff;margin:0;font-size:1em;">Tu licencia está lista — acceso completo, cualquier cuenta</p>
    </div>
    <div style="padding:36px 32px;">
      <p style="font-size:1.05em;color:#e2e8f0;margin:0 0 14px;">Hola${nombre ? ` <strong style="color:#38bdf8;">${nombre}</strong>` : ''},</p>
      <p style="color:#94a3b8;line-height:1.8;margin:0 0 24px;">
        Gracias por tu compra. Copiá tu clave de licencia y pegala en el bot
        (pantalla de activación) para desbloquear el acceso completo:
      </p>
      <div style="background:#0b1220;border:1px dashed #38bdf8;border-radius:10px;padding:18px;margin:0 0 24px;">
        <p style="margin:0 0 8px;color:#38bdf8;font-size:.8em;font-weight:bold;letter-spacing:1px;">TU CLAVE DE LICENCIA</p>
        <code style="color:#e2e8f0;word-break:break-all;font-size:.9em;line-height:1.6;">${licencia}</code>
      </div>
      ${INSTALL_URL ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${INSTALL_URL}" style="background:#0ea5e9;color:#fff;padding:15px 34px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:10px;display:inline-block;">📥 Guía de instalación</a>
      </div>` : ''}
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:18px;margin:20px 0;">
        <p style="margin:0;color:#94a3b8;font-size:.9em;line-height:1.7;">
          🔒 <strong style="color:#cbd5e1;">Importante:</strong> podés usarla en <strong>hasta 3 PCs</strong> (una prendida a la vez).
          Si llenaste las 3 y querés cambiar, escribinos y te la liberamos.<br>
          💬 ¿Dudas o soporte? <a href="mailto:contactowallstreetsniperlabs@gmail.com" style="color:#38bdf8;">contactowallstreetsniperlabs@gmail.com</a>
        </p>
      </div>
    </div>
    <div style="background:#0b1220;padding:22px 32px;text-align:center;border-top:1px solid #1e293b;">
      <p style="color:#475569;font-size:.8em;margin:0;">${FROM_NAME} · © 2026</p>
    </div>
  </div>
</body></html>`;
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`, to: para, subject: asunto, html
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return data;
  },

  // ── entrega completa (idempotente): consulta → emite → email → registra ──
  async entregarLicencia(sesion) {
    const emailCliente = sesion.customer_details?.email;
    if (!emailCliente) { console.warn('[Cohete] sesión sin email — se omite'); return false; }

    const previa = await this.licenciaExistente(emailCliente);
    if (previa) { console.log(`[Cohete] ${emailCliente} ya tenía licencia — no reemito`); return false; }

    const licencia = await this.emitirLicencia(emailCliente);
    await this._enviarLicenciaEmail({
      para: emailCliente, nombre: sesion.customer_details?.name, licencia
    });

    // registro para analytics (best-effort: si el esquema no calza, NO rompe la entrega)
    try {
      await db.crearCustomer({
        email: emailCliente, nombre: sesion.customer_details?.name,
        producto: 'Cohete Bot Lite', revenue: (sesion.amount_total || 0) / 100,
        stripe_customer_id: sesion.customer
      });
    } catch (e) { console.warn('[Cohete] crearCustomer (no crítico):', e.message); }

    console.log(`[Cohete] ✅ Licencia entregada a ${emailCliente}`);
    return true;
  },

  // ── escaneo de respaldo: entrega licencias Cohete de pagos recientes no entregados ──
  async procesarCoheteNuevos() {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const desde = Math.floor(Date.now() / 1000) - (2 * 60 * 60);
    const sesiones = await stripe.checkout.sessions.list({
      limit: 50, created: { gte: desde }, expand: ['data.payment_link']
    });
    let n = 0;
    for (const s of sesiones.data) {
      if (s.payment_status !== 'paid') continue;
      if (!this.esCompraCohete(s)) continue;
      try { if (await this.entregarLicencia(s)) n++; }
      catch (e) { console.error(`[Cohete] error entregando: ${e.message}`); }
    }
    if (n) console.log(`[Cohete] ${n} licencia(s) entregada(s)`);
    return n;
  }
};
