// ════════════════════════════════════
// NEXUS AGENT — core/claude.js
// Wrapper Anthropic API — cerebro del sistema
// ════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { db } from './database.js';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-opus-4-6';
const MAX_TOKENS = 8000;
const MAX_DAILY_SPEND = Number(process.env.MAX_DAILY_API_SPEND) || 5;

// ── Rastreador de costo diario (en memoria, persiste en DB) ──
let costoHoy = 0;

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
export async function preguntar(prompt, system = '', agente = 'sistema', maxTokens = MAX_TOKENS) {
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
      model: MODEL,
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
