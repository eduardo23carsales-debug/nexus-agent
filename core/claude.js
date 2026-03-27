// ════════════════════════════════════
// NEXUS AGENT — core/claude.js
// Wrapper Anthropic API — cerebro del sistema
// ════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { db, supabase } from './database.js';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-opus-4-6';
const MAX_TOKENS = 8000;
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

// Precio por token en USD (claude-opus-4-6)
const PRECIO_INPUT  = 15   / 1_000_000; // $15 por millón input
const PRECIO_OUTPUT = 75   / 1_000_000; // $75 por millón output

function calcularCosto(inputTokens, outputTokens) {
  return (inputTokens * PRECIO_INPUT) + (outputTokens * PRECIO_OUTPUT);
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

  // Verificar límite de gasto diario
  if (costoHoy >= MAX_DAILY_SPEND) {
    await db.log(agente, 'claude_bloqueado', {
      razon: 'limite_diario_alcanzado',
      costo_hoy: costoHoy,
      limite: MAX_DAILY_SPEND
    }, false);
    throw new Error(`Límite diario de API alcanzado ($${costoHoy.toFixed(4)}/$${MAX_DAILY_SPEND}). Esperando reset.`);
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: system || 'Eres NEXUS AGENT, un sistema autónomo de ingresos digitales. Responde siempre en español. Sé directo y accionable.',
      messages: [{ role: 'user', content: prompt }]
    });

    const texto = response.content[0].text;
    const costo = calcularCosto(response.usage.input_tokens, response.usage.output_tokens);
    const duracion = Date.now() - inicio;

    costoHoy += costo;

    await db.log(agente, 'claude_llamada', {
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
      costo_usd: costo,
      costo_acumulado_hoy: costoHoy
    }, true, duracion, costo);

    return texto;

  } catch (err) {
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
export async function preguntarCompleto(prompt, system = '', agente = 'sistema', maxTokens = MAX_TOKENS, maxIter = 5) {
  const SYSTEM = system || 'Eres NEXUS AGENT, un sistema autónomo de ingresos digitales. Responde siempre en español. Sé directo y accionable.';
  const SYSTEM_DEFINITIVO = SYSTEM;

  const messages = [{ role: 'user', content: prompt }];
  let textoTotal = '';
  let iteracion = 0;

  while (iteracion < maxIter) {
    iteracion++;

    // Verificar límite diario antes de cada llamada
    if (costoHoy >= MAX_DAILY_SPEND) {
      await db.log(agente, 'claude_bloqueado', { razon: 'limite_diario_alcanzado', costo_hoy: costoHoy }, false);
      throw new Error(`Límite diario de API alcanzado ($${costoHoy.toFixed(4)}/$${MAX_DAILY_SPEND}).`);
    }

    // Retry con backoff en rate limit
    let response;
    const MAX_REINTENTOS = 3;
    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      try {
        const inicio = Date.now();
        response = await client.messages.create({
          model: MODEL,
          max_tokens: maxTokens,
          system: SYSTEM_DEFINITIVO,
          messages
        });

        const costo = calcularCosto(response.usage.input_tokens, response.usage.output_tokens);
        costoHoy += costo;
        await db.log(agente, 'claude_llamada', {
          tokens_input: response.usage.input_tokens,
          tokens_output: response.usage.output_tokens,
          costo_usd: costo,
          costo_acumulado_hoy: costoHoy,
          iteracion,
          stop_reason: response.stop_reason
        }, true, Date.now() - inicio, costo);
        break; // éxito — salir del loop de reintentos

      } catch (err) {
        const esRateLimit = err.status === 429 || err.message?.includes('rate_limit') || err.message?.includes('overloaded');
        if (esRateLimit && intento < MAX_REINTENTOS - 1) {
          const espera = 8000 * (intento + 1); // 8s, 16s, 24s
          console.log(`[Claude] Rate limit (intento ${intento + 1}) — esperando ${espera / 1000}s...`);
          await new Promise(r => setTimeout(r, espera));
        } else {
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

  const texto = await preguntar(prompt, systemJSON, agente);

  try {
    // Limpia posibles bloques de código markdown
    const limpio = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(limpio);
  } catch {
    await db.log(agente, 'claude_json_parse_error', { respuesta_raw: texto.slice(0, 500) }, false);
    throw new Error(`Claude no devolvió JSON válido: ${texto.slice(0, 200)}`);
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

export { MODEL };
