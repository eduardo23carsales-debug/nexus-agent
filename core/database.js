// ════════════════════════════════════
// NEXUS AGENT — core/database.js
// Cliente Supabase + helpers para todos los agentes
// ════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// ── Clientes ─────────────────────────────────────────────
// Ambos usan service_role key — sistema backend puro, sin usuarios públicos.
// La service_role bypasses RLS, así que las políticas de seguridad no bloquean nada internamente.
// La anon key ya no se usa — RLS bloquea el acceso anónimo externo.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ════════════════════════════════════
// MOTOR 1 — EXPERIMENTOS (productos digitales)
// ════════════════════════════════════

export const db = {

  // ── Experimentos ────────────────────────────────────────

  async crearExperimento(data) {
    const { data: exp, error } = await supabase
      .from('experiments')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return exp;
  },

  async getExperimento(id) {
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getExperimentosActivos() {
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .in('estado', ['corriendo', 'vivo', 'escalando'])
      .order('fecha_inicio', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateExperimento(id, updates) {
    const { data, error } = await supabase
      .from('experiments')
      .update({ ...updates, fecha_ultimo_update: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateMetricas(id, metricas) {
    // Merge con métricas existentes en vez de reemplazar
    const exp = await this.getExperimento(id);
    const merged = { ...exp.metricas, ...metricas };
    return this.updateExperimento(id, { metricas: merged });
  },

  async matarExperimento(id, aprendizaje) {
    return this.updateExperimento(id, {
      estado: 'muerto',
      aprendizaje,
      fecha_decision: new Date().toISOString()
    });
  },

  async escalarExperimento(id) {
    return this.updateExperimento(id, {
      estado: 'escalando',
      fecha_decision: new Date().toISOString()
    });
  },

  // ── Clientes (compradores productos digitales) ────────────

  async crearCustomer(data) {
    const { data: customer, error } = await supabase
      .from('customers')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return customer;
  },

  async getCustomerPorEmail(email) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // ── Leads digitales (email funnel) ────────────────────────

  async crearDigitalLead(email, experimentId, fuente) {
    const { data, error } = await supabase
      .from('digital_leads')
      .insert({ email, experiment_id: experimentId, fuente })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getDigitalLeadPorEmailYFuente(email, fuente) {
    const { data } = await supabase
      .from('digital_leads')
      .select('id')
      .eq('email', email)
      .eq('fuente', fuente)
      .maybeSingle();
    return data;
  },

  // ════════════════════════════════════
  // MOTOR 2 — LEADS B2B (agencia)
  // ════════════════════════════════════

  // ── Clientes de negocio (dealers, clínicas, etc.) ─────────

  async crearBusinessClient(data) {
    const { data: client, error } = await supabase
      .from('business_clients')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return client;
  },

  async getBusinessClientsActivos() {
    const { data, error } = await supabase
      .from('business_clients')
      .select('*')
      .eq('estado', 'activo')
      .order('fecha_inicio', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateBusinessClient(id, updates) {
    const { data, error } = await supabase
      .from('business_clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Leads (compradores potenciales) ──────────────────────

  async crearLead(data) {
    const { data: lead, error } = await supabase
      .from('leads')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return lead;
  },

  async getLead(id) {
    const { data, error } = await supabase
      .from('leads')
      .select('*, business_clients(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getLeadsPendientes(industria = null) {
    let query = supabase
      .from('leads')
      .select('*')
      .in('estado', ['nuevo', 'calificando'])
      .order('fecha', { ascending: true });
    if (industria) query = query.eq('industria', industria);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async updateLead(id, updates) {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async entregarLead(id) {
    return this.updateLead(id, {
      estado: 'entregado',
      entregado_en: new Date().toISOString()
    });
  },

  async registrarPagoLead(leadId, businessClientId, monto, tipo = 'por_lead', stripePaymentId = null) {
    const { data, error } = await supabase
      .from('lead_payments')
      .insert({
        lead_id: leadId,
        business_client_id: businessClientId,
        monto,
        tipo,
        stripe_payment_id: stripePaymentId
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ════════════════════════════════════
  // SISTEMA — MEMORIA, LOGS, TESORERÍA
  // ════════════════════════════════════

  // ── Memoria del sistema ───────────────────────────────────

  async guardarMemoria({ tipo, categoria, contenido, confianza = 0.7 }) {
    const { data, error } = await supabase
      .from('system_memory')
      .insert({ tipo, categoria, contenido, confianza })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMemoria(categoria = null) {
    let query = supabase
      .from('system_memory')
      .select('*')
      .eq('activo', true)
      .order('confianza', { ascending: false });
    if (categoria) query = query.eq('categoria', categoria);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async reforzarMemoria(id) {
    const { data: mem } = await supabase
      .from('system_memory')
      .select('veces_validado, confianza')
      .eq('id', id)
      .single();
    const nuevaConfianza = Math.min(1.0, mem.confianza + 0.05);
    const { data, error } = await supabase
      .from('system_memory')
      .update({ veces_validado: mem.veces_validado + 1, confianza: nuevaConfianza })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Logs de agentes ───────────────────────────────────────

  async log(agente, accion, detalle = {}, exito = true, duracionMs = null, costoApi = null) {
    const { error } = await supabase
      .from('agent_logs')
      .insert({ agente, accion, detalle, exito, duracion_ms: duracionMs, costo_api: costoApi });
    if (error) console.error('[DB] Error guardando log:', error.message);
  },

  // ── Tesorería ─────────────────────────────────────────────

  async registrarMovimiento({ motor, tipo, monto, descripcion, experimentId = null, businessClientId = null }) {
    const { data, error } = await supabase
      .from('treasury')
      .insert({
        motor,
        tipo,
        monto,
        descripcion,
        experiment_id: experimentId,
        business_client_id: businessClientId
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getResumenFinanciero() {
    const { data, error } = await supabase
      .from('treasury')
      .select('motor, tipo, monto');
    if (error) throw error;

    const resumen = { digital: { ingresos: 0, gastos: 0 }, leadgen: { ingresos: 0, gastos: 0 }, total_neto: 0 };
    for (const mov of data) {
      if (mov.tipo === 'ingreso') resumen[mov.motor].ingresos += Number(mov.monto);
      else resumen[mov.motor].gastos += Number(mov.monto);
    }
    resumen.total_neto =
      (resumen.digital.ingresos - resumen.digital.gastos) +
      (resumen.leadgen.ingresos - resumen.leadgen.gastos);
    return resumen;
  },

  // ════════════════════════════════════
  // ESTADO DE OPERACIÓN — persiste flags críticos entre reinicios
  // Usa system_memory con tipo='estado_operacion' como key-value store
  // ════════════════════════════════════

  async setEstadoOperacion(clave, valor) {
    // Borrar entrada anterior con esa clave, luego insertar la nueva
    await supabase.from('system_memory')
      .delete()
      .eq('tipo', 'estado_operacion')
      .eq('categoria', clave);
    await supabase.from('system_memory')
      .insert({ tipo: 'estado_operacion', categoria: clave, contenido: JSON.stringify(valor), confianza: 1.0, activo: true });
  },

  async getEstadoOperacion(clave) {
    const { data } = await supabase
      .from('system_memory')
      .select('contenido')
      .eq('tipo', 'estado_operacion')
      .eq('categoria', clave)
      .eq('activo', true)
      .maybeSingle();
    if (!data) return null;
    try { return JSON.parse(data.contenido); } catch { return data.contenido; }
  },

  async clearEstadoOperacion(clave) {
    await supabase.from('system_memory')
      .delete()
      .eq('tipo', 'estado_operacion')
      .eq('categoria', clave);
  },

  // ════════════════════════════════════
  // HEALTH CHECK — verifica conexión
  // ════════════════════════════════════

  async ping() {
    const { error } = await supabase.from('agent_logs').select('id').limit(1);
    if (error) throw new Error(`Supabase no responde: ${error.message}`);
    return true;
  }
};

export { supabase, supabaseAdmin };
