// ════════════════════════════════════
// NEXUS AGENT — core/api-server.js
// Dashboard HTTP API — Express server
// ════════════════════════════════════

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, supabase } from './database.js';
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

    // Meta Ads — gasto de la cuenta (balance solo existe en cuentas prepago)
    let metaBalance = { balance: null, gasto_mes: null, moneda: 'USD', error: null };
    try {
      const { data } = await axios.get(`https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}`, {
        params: {
          fields: 'amount_spent,currency,name',
          access_token: process.env.META_ACCESS_TOKEN?.trim()
        },
        timeout: 8000
      });
      metaBalance = {
        balance: null,
        gasto_mes: data.amount_spent != null ? (parseFloat(data.amount_spent) / 100).toFixed(2) : null,
        moneda: data.currency || 'USD',
        error: null
      };
    } catch (e) {
      metaBalance.error = e.response?.data?.error?.message || e.message;
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
// ARRANQUE
// ══════════════════════════════════════
export function iniciarAPIServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Dashboard API corriendo en puerto ${PORT}`);
    console.log(`   Accede en: http://localhost:${PORT}/?secret=${DASHBOARD_SECRET}`);
  });
}
