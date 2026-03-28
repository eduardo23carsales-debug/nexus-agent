// ════════════════════════════════════
// NEXUS AGENT — core/api-server.js
// Dashboard HTTP API — Express server
// ════════════════════════════════════

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, supabase } from './database.js';
import { email } from './email.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || 'nexus2024';

// ── Autenticación simple ─────────────────────────────────────
function auth(req, res, next) {
  const secret = req.query.secret || req.headers['x-dashboard-secret'];
  if (secret !== DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ── Servir dashboard HTML ────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// ── Página de gracias post-pago (Stripe redirige aquí) ───────
app.get('/gracias', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Compra exitosa!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f0f0f; color: #fff; font-family: Arial, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1a1a1a; border: 1px solid #222; border-top: 3px solid #00ff88; border-radius: 12px; padding: 48px 40px; max-width: 560px; width: 90%; text-align: center; }
    .icon { font-size: 3em; margin-bottom: 16px; }
    h1 { color: #00ff88; font-size: 1.8em; margin-bottom: 12px; }
    p { color: #aaa; line-height: 1.8; margin-bottom: 16px; }
    .highlight { background: #0d1f0d; border: 1px solid #00ff88; border-radius: 8px; padding: 16px; color: #00ff88; font-size: 0.95em; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>¡Pago confirmado!</h1>
    <p>Tu compra fue procesada correctamente.</p>
    <p>Revisa tu correo electrónico — en los próximos minutos recibirás el link de acceso a tu producto.</p>
    <div class="highlight">
      📧 Si no ves el email, revisa tu carpeta de spam o correo no deseado.
    </div>
  </div>
</body>
</html>`);
});

// ══════════════════════════════════════
// /api/estado — Estado general del sistema
// ══════════════════════════════════════
app.get('/api/estado', auth, async (req, res) => {
  try {
    const [experimentos, financiero] = await Promise.all([
      db.getExperimentosActivos(),
      db.getResumenFinanciero()
    ]);

    // Gasto Claude API del día (suma de costo_api en agent_logs)
    const hoy = new Date().toISOString().slice(0, 10);
    const { data: logsHoy } = await supabase
      .from('agent_logs')
      .select('costo_api')
      .gte('created_at', `${hoy}T00:00:00`)
      .not('costo_api', 'is', null);
    const gastoClaudeHoy = logsHoy?.reduce((s, l) => s + (l.costo_api || 0), 0) || 0;
    const limiteClaudeHoy = Number(process.env.MAX_DAILY_API_SPEND) || 5;

    // Meta Ads — gasto total desde nuestra BD (no depende de permisos del token)
    let metaBalance = { balance: null, gasto_mes: null, moneda: 'USD', error: null };
    try {
      const { data: camps } = await supabase
        .from('campaigns')
        .select('gasto_total, estado')
        .eq('plataforma', 'meta');
      const gastoTotal = (camps || []).reduce((s, c) => s + (parseFloat(c.gasto_total) || 0), 0);
      const activas = (camps || []).filter(c => c.estado === 'activo' || c.estado === 'escalando').length;
      metaBalance = {
        balance: null,
        gasto_mes: gastoTotal.toFixed(2),
        moneda: 'USD',
        campanas_activas: activas,
        error: null
      };
    } catch (e) {
      metaBalance.error = e.message;
    }

    // Stripe — saldo disponible y pendiente
    let stripeBalance = { disponible: null, pendiente: null, error: null };
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const balance = await stripe.balance.retrieve();
      stripeBalance = {
        disponible: (balance.available.reduce((s, b) => s + b.amount, 0) / 100).toFixed(2),
        pendiente: (balance.pending.reduce((s, b) => s + b.amount, 0) / 100).toFixed(2),
        error: null
      };
    } catch (e) {
      stripeBalance.error = e.message;
    }

    res.json({
      claude: {
        gasto_hoy: parseFloat(gastoClaudeHoy.toFixed(4)),
        limite: limiteClaudeHoy,
        porcentaje: parseFloat(Math.min(100, (gastoClaudeHoy / limiteClaudeHoy) * 100).toFixed(1))
      },
      meta: metaBalance,
      stripe: stripeBalance,
      sistema: {
        experimentos_activos: experimentos.length,
        revenue_total: parseFloat(financiero.total_neto.toFixed(2)),
        revenue_digital: parseFloat(financiero.digital.ingresos.toFixed(2)),
        revenue_leads: parseFloat(financiero.leadgen.ingresos.toFixed(2)),
        gastos_totales: parseFloat((financiero.digital.gastos + financiero.leadgen.gastos).toFixed(2)),
        online: true,
        ts: new Date().toISOString()
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/campanias — Campañas ordenadas por ROAS
// ══════════════════════════════════════
app.get('/api/campanias', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('roas', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/productos — Experimentos ordenados por revenue
// ══════════════════════════════════════
app.get('/api/productos', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('experiments')
      .select('id, nombre, nicho, tipo, precio, estado, url, stripe_payment_link, metricas, fecha_inicio')
      .order('fecha_inicio', { ascending: false })
      .limit(20);
    if (error) throw error;

    const sorted = (data || []).sort(
      (a, b) => (b.metricas?.revenue || 0) - (a.metricas?.revenue || 0)
    );
    res.json(sorted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/logs — Últimos 30 logs de agentes
// ══════════════════════════════════════
app.get('/api/logs', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agent_logs')
      .select('agente, accion, exito, duracion_ms, costo_api, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /webhook/stripe — Entrega inmediata al comprar
// Stripe llama este endpoint en cada pago exitoso
// ══════════════════════════════════════
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && sig) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Sin secreto configurado: acepta sin verificar (modo prueba)
      console.warn('[Webhook] STRIPE_WEBHOOK_SECRET no configurado — procesando sin verificar firma');
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[Webhook] Error verificando firma de Stripe:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  // Responder a Stripe inmediatamente (< 5s requerido)
  res.status(200).json({ received: true });

  if (event.type === 'checkout.session.completed') {
    console.log('[Webhook] Pago confirmado — procesando entrega inmediata...');
    email.procesarPagosNuevos().catch(err =>
      console.error('[Webhook] Error procesando entrega:', err.message)
    );
  }
});

// ══════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════
export function iniciarAPIServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Dashboard API corriendo en puerto ${PORT}`);
    console.log(`   Accede en: http://localhost:${PORT}/?secret=${DASHBOARD_SECRET}`);
  });
}
