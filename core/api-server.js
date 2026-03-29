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
  // Solo aceptar header — el query param expone el secret en logs y URLs
  const secret = req.headers['x-dashboard-secret'];
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

    // Gasto Claude API del día y del mes
    const hoy = new Date().toISOString().slice(0, 10);
    const primerDiaMes = new Date().toISOString().slice(0, 7) + '-01';
    const { data: logsHoy } = await supabase
      .from('agent_logs')
      .select('costo_api')
      .gte('created_at', `${hoy}T00:00:00`)
      .not('costo_api', 'is', null);
    const { data: logsMes } = await supabase
      .from('agent_logs')
      .select('costo_api')
      .gte('created_at', `${primerDiaMes}T00:00:00`)
      .not('costo_api', 'is', null);
    const gastoClaudeHoy = logsHoy?.reduce((s, l) => s + (l.costo_api || 0), 0) || 0;
    const gastoClaudeMes = logsMes?.reduce((s, l) => s + (l.costo_api || 0), 0) || 0;
    const limiteClaudeHoy = Number(process.env.MAX_DAILY_API_SPEND) || 5;

    // Meta Ads — gasto real directo desde Meta API (lifetime de la cuenta)
    let metaBalance = { balance: null, gasto_mes: null, moneda: 'USD', error: null };
    try {
      const META_TOKEN = process.env.META_ACCESS_TOKEN?.trim();
      const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID;

      // Intentar primero con Meta API directo (datos reales)
      let gastoReal = null;
      if (META_TOKEN && META_ACCOUNT) {
        try {
          const metaRes = await axios.get(
            `https://graph.facebook.com/v25.0/${META_ACCOUNT}/insights`,
            {
              params: {
                fields: 'spend',
                date_preset: 'this_month',
                access_token: META_TOKEN
              },
              timeout: 8000
            }
          );
          const insightData = metaRes.data?.data;
          if (insightData?.length) {
            gastoReal = parseFloat(insightData[0].spend || 0);
          } else {
            // Sin datos este mes — puede ser que sea inicio de mes o no hubo actividad
            gastoReal = 0;
          }
        } catch (metaErr) {
          console.warn('[API/estado] Meta insights falló, usando BD como fallback:', metaErr.response?.data?.error?.message || metaErr.message);
        }
      }

      // Fallback: sumar gasto_total de la BD (siempre disponible)
      const { data: camps } = await supabase
        .from('campaigns')
        .select('gasto_total, estado')
        .eq('plataforma', 'meta');
      const gastoBD = (camps || []).reduce((s, c) => s + (parseFloat(c.gasto_total) || 0), 0);
      const activas = (camps || []).filter(c => c.estado === 'activo' || c.estado === 'escalando').length;

      const gastoFinal = gastoReal !== null ? gastoReal : gastoBD;
      metaBalance = {
        balance: null,
        gasto_mes: gastoFinal.toFixed(2),
        gasto_bd: gastoBD.toFixed(2),         // para debug
        fuente: gastoReal !== null ? 'meta_api' : 'bd_cache',
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
        restante_hoy: parseFloat(Math.max(0, limiteClaudeHoy - gastoClaudeHoy).toFixed(4)),
        limite: limiteClaudeHoy,
        gasto_mes: parseFloat(gastoClaudeMes.toFixed(4)),
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
      .order('fecha_inicio', { ascending: false })
      .limit(30);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/meta-sincronizar — Sincroniza métricas live desde Meta API
// ══════════════════════════════════════
app.post('/api/meta-sincronizar', auth, async (req, res) => {
  try {
    const { validarCampanas } = await import('../agents/ads/campaign-validator.js');
    await validarCampanas();
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/campania/:id/sync — Sincroniza métricas de UNA campaña desde Meta
// ══════════════════════════════════════
app.post('/api/campania/:id/sync', auth, async (req, res) => {
  try {
    const { data: camp, error } = await supabase
      .from('campaigns')
      .select('*, experiments(precio)')
      .eq('id', req.params.id)
      .single();
    if (error || !camp) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (!camp.campaign_id_externo) return res.status(400).json({ error: 'Sin campaign_id_externo' });

    const { metaAds } = await import('../agents/ads/meta-ads.js');
    const metricas = await metaAds.getMetricas(camp.campaign_id_externo);
    const precio = camp.experiments?.precio || 47;
    const revenue = metricas.conversiones * precio;
    const roas = metricas.spend > 0 ? revenue / metricas.spend : 0;
    const cpa = metricas.conversiones > 0 ? metricas.spend / metricas.conversiones : 0;

    await supabase.from('campaigns').update({
      gasto_total: metricas.spend,
      impresiones: metricas.impressions,
      clicks: metricas.clicks,
      conversiones: metricas.conversiones,
      revenue_generado: revenue,
      ctr: metricas.ctr,
      cpa,
      roas,
      fecha_ultimo_update: new Date().toISOString()
    }).eq('id', req.params.id);

    res.json({ ok: true, metricas: { ...metricas, revenue, roas } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/campania/:id/pausar — Pausa campaña en Meta + BD
// ══════════════════════════════════════
app.post('/api/campania/:id/pausar', auth, async (req, res) => {
  try {
    const { data: camp } = await supabase
      .from('campaigns').select('campaign_id_externo, estado').eq('id', req.params.id).single();
    if (!camp) return res.status(404).json({ error: 'Campaña no encontrada' });

    if (camp.campaign_id_externo) {
      const { metaAds } = await import('../agents/ads/meta-ads.js');
      await metaAds.pausarCampana(camp.campaign_id_externo);
    }
    await supabase.from('campaigns').update({
      estado: 'pausado',
      fecha_decision: new Date().toISOString(),
      decision: 'pausar_manual',
      razon_decision: 'Pausada manualmente desde dashboard'
    }).eq('id', req.params.id);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/campania/:id/activar — Activa campaña en Meta + BD
// ══════════════════════════════════════
app.post('/api/campania/:id/activar', auth, async (req, res) => {
  try {
    const { data: camp } = await supabase
      .from('campaigns').select('campaign_id_externo').eq('id', req.params.id).single();
    if (!camp) return res.status(404).json({ error: 'Campaña no encontrada' });

    if (camp.campaign_id_externo) {
      const { metaAds } = await import('../agents/ads/meta-ads.js');
      await metaAds.activarCampana(camp.campaign_id_externo);
    }
    await supabase.from('campaigns').update({
      estado: 'activo',
      fecha_decision: new Date().toISOString(),
      decision: 'activar_manual',
      razon_decision: 'Activada manualmente desde dashboard'
    }).eq('id', req.params.id);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/campania/:id — DELETE — Elimina campaña de la BD
// ══════════════════════════════════════
app.delete('/api/campania/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════
// /api/emails — Estadísticas de email
// ══════════════════════════════════════
app.get('/api/emails', auth, async (req, res) => {
  try {
    const [{ count: entregados }, { count: abandono1 }, { count: abandono2 }, { count: clientes }] = await Promise.all([
      supabase.from('agent_logs').select('*', { count: 'exact', head: true })
        .eq('agente', 'email').eq('accion', 'producto_entregado'),
      supabase.from('digital_leads').select('*', { count: 'exact', head: true })
        .eq('fuente', 'abandono_1'),
      supabase.from('digital_leads').select('*', { count: 'exact', head: true })
        .eq('fuente', 'abandono_2'),
      supabase.from('customers').select('*', { count: 'exact', head: true })
    ]);
    res.json({
      productos_entregados: entregados || 0,
      abandono_email1: abandono1 || 0,
      abandono_email2: abandono2 || 0,
      total_clientes: clientes || 0
    });
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
    if (!webhookSecret || !sig) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET no configurado — rechazando evento no verificado');
      return res.status(400).send('Webhook no configurado correctamente');
    }
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
  if (process.env.NODE_ENV === 'production' && DASHBOARD_SECRET === 'nexus2024') {
    console.warn('⚠️  DASHBOARD_SECRET usa el valor por defecto — configúralo en las variables de entorno de Railway');
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Dashboard API corriendo en puerto ${PORT}`);
    console.log(`   Usa el header X-Dashboard-Secret para autenticarte`);
  });
}
