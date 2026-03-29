// ════════════════════════════════════
// NEXUS AGENT — core/claude.js
// Wrapper Anthropic API — cerebro del sistema
// ════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { db, supabase } from './database.js';
dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 300 * 1000, // 5 minutos máximo por llamada (6000 tokens ~3-4 min de generación)
});

const MODEL        = 'claude-opus-4-6';   // decisiones, research, scoring
const MODEL_SONNET = 'claude-sonnet-4-6'; // generación de contenido HTML (5x más rápido, mismo resultado)
const MAX_TOKENS = 6000;
const MAX_DAILY_SPEND = Number(process.env.MAX_DAILY_API_SPEND) || 5;

// ── Rastreador de costo diario (cargado desde DB al iniciar) ──
let costoHoy = 0;

/**
 * Carga el costo acumulado de hoy desde agent_logs.
 * Llamar en iniciar() para sobrevivir reinicios de Railway.
 */
export async function cargarCostoHoy() {
  try {
    const hoy = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const { data } = await supabase
      .from('agent_logs')
      .select('costo_api')
      .gte('created_at', `${hoy}T00:00:00.000Z`)
      .lt('created_at',  `${hoy}T23:59:59.999Z`);
    if (data?.length) {
      costoHoy = data.reduce((sum, row) => sum + (Number(row.costo_api) || 0), 0);
    }
    console.log(`[Claude] Costo acumulado hoy cargado desde DB: $${costoHoy.toFixed(4)}`);
  } catch (err) {
    console.error('[Claude] No se pudo cargar costo de hoy:', err.message);
  }
}

// Precios por token en USD según modelo
const PRECIOS = {
  opus:   { input: 15 / 1_000_000, output: 75 / 1_000_000 },  // claude-opus-4-6
  sonnet: { input:  3 / 1_000_000, output: 15 / 1_000_000 },  // claude-sonnet-4-6
  haiku:  { input:  1 / 1_000_000, output:  5 / 1_000_000 },  // claude-haiku
};

function calcularCosto(inputTokens, outputTokens, model = MODEL) {
  const p = model.includes('opus') ? PRECIOS.opus
          : model.includes('haiku') ? PRECIOS.haiku
          : PRECIOS.sonnet;
  return (inputTokens * p.input) + (outputTokens * p.output);
}

function costoEstimadoPorModelo(maxTokens, model = MODEL) {
  const p = model.includes('opus') ? PRECIOS.opus
          : model.includes('haiku') ? PRECIOS.haiku
          : PRECIOS.sonnet;
  return maxTokens * p.output * 1.2; // 20% buffer
}

// ════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ════════════════════════════════════

/**
 * Llama a Claude y devuelve texto.
 * @param {string} prompt       - El mensaje del usuario/agente
 * @param {string} system       - Contexto del sistema (rol del agente)
 * @param {string} agente       - Nombre del agente que llama (para logs)
 * @param {number} maxTokens    - Límite de tokens en respuesta
 * @returns {string}            - Respuesta de Claude
 */
export async function preguntar(prompt, system = '', agente = 'sistema', maxTokens = MAX_TOKENS, model = MODEL) {
  const inicio = Date.now();

  // Reservar costo estimado antes de llamar — evita que llamadas concurrentes
  // pasen todas el check y juntas superen el límite diario
  const costoEstimado = costoEstimadoPorModelo(maxTokens, model);
  if (costoHoy + costoEstimado > MAX_DAILY_SPEND) {
    await db.log(agente, 'claude_bloqueado', {
      razon: 'limite_diario_alcanzado',
      costo_hoy: costoHoy,
      costo_estimado: costoEstimado,
      limite: MAX_DAILY_SPEND
    }, false);
    throw new Error(`Límite diario de API alcanzado ($${costoHoy.toFixed(4)}/$${MAX_DAILY_SPEND}). Esperando reset.`);
  }
  costoHoy += costoEstimado; // reserva inmediata

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: system || 'Eres NEXUS AGENT, un sistema autónomo de ingresos digitales. Responde siempre en español. Sé directo y accionable.',
      messages: [{ role: 'user', content: prompt }]
    });

    const texto = response.content[0].text;
    const costoReal = calcularCosto(response.usage.input_tokens, response.usage.output_tokens, model);
    const duracion = Date.now() - inicio;

    // Ajustar al costo real (la reserva ya está sumada, solo compensar la diferencia)
    costoHoy += costoReal - costoEstimado;

    await db.log(agente, 'claude_llamada', {
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
      costo_usd: costoReal,
      costo_acumulado_hoy: costoHoy
    }, true, duracion, costoReal);

    return texto;

  } catch (err) {
    costoHoy -= costoEstimado; // liberar reserva si la llamada falló
    await db.log(agente, 'claude_error', { error: err.message }, false, Date.now() - inicio);
    throw err;
  }
}

// ════════════════════════════════════
// FUNCIÓN CON CONTINUACIÓN AUTOMÁTICA
// ════════════════════════════════════

/**
 * Llama a Claude garantizando respuesta COMPLETA.
 * - Retry automático en rate limit (429) con backoff
 * - Si Claude se corta por max_tokens, continúa automáticamente
 *   hasta que stop_reason sea 'end_turn'
 * @param {string} prompt
 * @param {string} system
 * @param {string} agente
 * @param {number} maxTokens  - por cada llamada parcial
 * @param {number} maxIter    - máximo de continuaciones (seguridad)
 * @returns {string}          - texto completo, sin cortes
 */
export async function preguntarCompleto(prompt, system = '', agente = 'sistema', maxTokens = MAX_TOKENS, maxIter = 5, onCorte = null, model = MODEL) {
  const SYSTEM = system || 'Eres NEXUS AGENT, un sistema autónomo de ingresos digitales. Responde siempre en español. Sé directo y accionable.';
  const SYSTEM_DEFINITIVO = SYSTEM;

  const messages = [{ role: 'user', content: prompt }];
  let textoTotal = '';
  let iteracion = 0;

  while (iteracion < maxIter) {
    iteracion++;

    // Reservar costo estimado antes de llamar (mismo patrón que preguntar())
    const costoEstimado = costoEstimadoPorModelo(maxTokens, model);
    if (costoHoy + costoEstimado > MAX_DAILY_SPEND) {
      await db.log(agente, 'claude_bloqueado', { razon: 'limite_diario_alcanzado', costo_hoy: costoHoy }, false);
      throw new Error(`Límite diario de API alcanzado ($${costoHoy.toFixed(4)}/$${MAX_DAILY_SPEND}).`);
    }
    costoHoy += costoEstimado; // reserva inmediata

    // Retry con backoff en rate limit
    let response;
    const MAX_REINTENTOS = 3;
    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      try {
        const inicio = Date.now();
        response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          system: SYSTEM_DEFINITIVO,
          messages
        });

        const costoReal = calcularCosto(response.usage.input_tokens, response.usage.output_tokens, model);
        costoHoy += costoReal - costoEstimado; // ajustar al costo real
        await db.log(agente, 'claude_llamada', {
          tokens_input: response.usage.input_tokens,
          tokens_output: response.usage.output_tokens,
          costo_usd: costoReal,
          costo_acumulado_hoy: costoHoy,
          iteracion,
          stop_reason: response.stop_reason
        }, true, Date.now() - inicio, costoReal);
        break; // éxito — salir del loop de reintentos

      } catch (err) {
        const esRateLimit = err.status === 429 || err.message?.includes('rate_limit') || err.message?.includes('overloaded');
        if (esRateLimit && intento < MAX_REINTENTOS - 1) {
          const espera = 8000 * (intento + 1); // 8s, 16s, 24s
          console.log(`[Claude] Rate limit (intento ${intento + 1}) — esperando ${espera / 1000}s...`);
          await new Promise(r => setTimeout(r, espera));
        } else {
          costoHoy -= costoEstimado; // liberar reserva si falló definitivamente
          await db.log(agente, 'claude_error', { error: err.message, intento }, false);
          throw err;
        }
      }
    }

    const fragmento = response.content[0]?.text || '';
    textoTotal += fragmento;

    if (response.stop_reason === 'end_turn') {
      // Respuesta completa — terminamos
      break;
    }

    if (response.stop_reason === 'max_tokens') {
      // Claude se cortó — pedirle que continúe desde donde quedó
      console.log(`[Claude] Respuesta cortada (iter ${iteracion}) — continuando...`);
      if (onCorte) await onCorte(iteracion, costoHoy);
      messages.push({ role: 'assistant', content: fragmento });
      messages.push({ role: 'user', content: 'Continúa exactamente desde donde te cortaste. NO repitas nada de lo anterior. Solo continúa el contenido HTML.' });
    } else {
      // Otro stop_reason (ej: stop_sequence) — aceptar como completo
      break;
    }
  }

  return textoTotal;
}

// ════════════════════════════════════
// FUNCIÓN CON RESPUESTA JSON
// ════════════════════════════════════

/**
 * Igual que preguntar() pero garantiza que Claude devuelva JSON válido.
 * @returns {object} - Objeto JSON parseado
 */
export async function preguntarJSON(prompt, system = '', agente = 'sistema') {
  const systemJSON = (system || '') + '\n\nIMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones.';

  const MAX_INTENTOS_JSON = 2;

  for (let intento = 1; intento <= MAX_INTENTOS_JSON; intento++) {
    const texto = await preguntar(prompt, systemJSON, agente);

    try {
      // Limpia posibles bloques de código markdown
      const limpio = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Intento directo
      try { return JSON.parse(limpio); } catch {}

      // Fallback: extraer el primer array u objeto JSON del texto
      const match = limpio.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);

      throw new Error('sin JSON extraíble');

    } catch (err) {
      await db.log(agente, 'claude_json_parse_error', {
        intento,
        respuesta_raw: texto.slice(0, 500)
      }, false);

      if (intento === MAX_INTENTOS_JSON) {
        throw new Error(`Claude no devolvió JSON válido tras ${MAX_INTENTOS_JSON} intentos: ${texto.slice(0, 200)}`);
      }
      console.warn(`[Claude] JSON inválido (intento ${intento}) — reintentando...`);
    }
  }
}

// ════════════════════════════════════
// FUNCIÓN PARA DECISIONES CRÍTICAS
// ════════════════════════════════════

/**
 * Usa Claude para tomar una decisión binaria o de múltiples opciones.
 * @param {string} situacion    - Descripción de la situación
 * @param {string[]} opciones   - Array de opciones posibles
 * @param {string} agente
 * @returns {{ decision: string, razon: string, confianza: number }}
 */
export async function decidir(situacion, opciones, agente = 'brain') {
  const prompt = `
Situación: ${situacion}

Opciones disponibles: ${opciones.join(' | ')}

Analiza y decide. Devuelve JSON con:
{
  "decision": "una de las opciones exactas",
  "razon": "explicación en 1-2 oraciones",
  "confianza": 0.0-1.0
}`;

  return preguntarJSON(prompt, 'Eres el cerebro de NEXUS AGENT. Tomas decisiones basadas en datos y maximización de ingresos.', agente);
}

// ════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════

export function getCostoHoy() {
  return costoHoy;
}

export function resetCostoHoy() {
  costoHoy = 0;
}

export { MODEL, MODEL_SONNET };
