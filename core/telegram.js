// ════════════════════════════════════
// NEXUS AGENT — core/telegram.js
// Comunicación con el dueño 24/7
// ════════════════════════════════════

import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { db } from './database.js';
dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const APPROVAL_TIMEOUT_HOURS = Number(process.env.APPROVAL_TIMEOUT_HOURS) || 4;

// ════════════════════════════════════
// ENVIAR MENSAJES
// ════════════════════════════════════

export async function enviar(mensaje) {
  try {
    await bot.sendMessage(CHAT_ID, mensaje, { parse_mode: 'HTML' });
    await db.log('telegram', 'mensaje_enviado', { preview: mensaje.slice(0, 100) });
  } catch (err) {
    console.error('[Telegram] Error enviando mensaje:', err.message);
    await db.log('telegram', 'error_envio', { error: err.message }, false);
  }
}

// Envía un archivo (Buffer) como documento adjunto por Telegram
export async function enviarArchivo(buffer, filename, caption = '') {
  try {
    await bot.sendDocument(CHAT_ID, buffer, { caption }, { filename, contentType: 'text/html' });
  } catch (err) {
    console.error('[Telegram] Error enviando archivo:', err.message);
  }
}

// ════════════════════════════════════
// ALERTAS PREDEFINIDAS DEL SISTEMA
// ════════════════════════════════════

export const alerta = {

  // Sistema arrancó
  async sistemaOnline() {
    await enviar(`⚡ *NEXUS AGENT ONLINE*\nSistema iniciado y corriendo 24/7\n_${new Date().toLocaleString('es-MX')}_`);
  },

  // Motor 1 — nuevo experimento lanzado
  async experimentoLanzado(exp) {
    await enviar(
      `🚀 *EXPERIMENTO LANZADO*\n` +
      `Nicho: ${exp.nicho}\n` +
      `Tipo: ${exp.tipo}\n` +
      `Precio: $${exp.precio}\n` +
      `URL: ${exp.url || 'generando...'}\n` +
      `_Decisión en 72h_`
    );
  },

  // Motor 1 — experimento muerto
  async experimentoMuerto(exp) {
    await enviar(
      `💀 *EXPERIMENTO TERMINADO*\n` +
      `Nicho: ${exp.nicho}\n` +
      `Revenue: $${exp.metricas?.revenue || 0}\n` +
      `Aprendizaje: ${exp.aprendizaje}`
    );
  },

  // Motor 1 — experimento escalando
  async experimentoEscalando(exp) {
    await enviar(
      `📈 *ESCALANDO GANADOR*\n` +
      `Nicho: ${exp.nicho}\n` +
      `Revenue: $${exp.metricas?.revenue || 0}\n` +
      `Generación: ${exp.generacion}\n` +
      `→ Creando 3 réplicas...`
    );
  },

  // Motor 2 — lead calificado listo
  async leadCalificado(lead, cliente) {
    await enviar(
      `🎯 *LEAD CALIFICADO*\n` +
      `Industria: ${lead.industria}\n` +
      `Nombre: ${lead.nombre || 'Anónimo'}\n` +
      `Score: ${lead.score}/10\n` +
      `Necesidad: ${lead.descripcion_necesidad?.slice(0, 100)}\n` +
      `Presupuesto: $${lead.presupuesto_min}-$${lead.presupuesto_max}\n` +
      `→ Enviando a: ${cliente.contacto_nombre}`
    );
  },

  // Motor 2 — nuevo cliente de negocio
  async nuevoClienteB2B(cliente) {
    await enviar(
      `🤝 *NUEVO CLIENTE B2B*\n` +
      `Negocio: ${cliente.nombre}\n` +
      `Industria: ${cliente.industria}\n` +
      `Modelo: ${cliente.modelo_pago}\n` +
      `Valor por lead: $${cliente.precio_por_lead || 0}\n` +
      `Retainer: $${cliente.retainer_mensual || 0}/mes`
    );
  },

  // Ingreso registrado
  async ingresoRegistrado(monto, descripcion, motor) {
    await enviar(`💰 *INGRESO: $${monto}*\n${descripcion}\nMotor: ${motor}`);
  },

  // Reporte diario
  async reporteDiario(resumen) {
    await enviar(
      `📊 *REPORTE DIARIO*\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💻 Digital: $${resumen.digital.ingresos.toFixed(2)} ingresos / $${resumen.digital.gastos.toFixed(2)} gastos\n` +
      `🎯 Leads: $${resumen.leadgen.ingresos.toFixed(2)} ingresos / $${resumen.leadgen.gastos.toFixed(2)} gastos\n` +
      `━━━━━━━━━━━━━━━\n` +
      `✅ NETO HOY: $${resumen.total_neto.toFixed(2)}\n` +
      `_${new Date().toLocaleDateString('es-MX')}_`
    );
  },

  // Alerta de error crítico
  async errorCritico(agente, error) {
    await enviar(`🚨 *ERROR CRÍTICO*\nAgente: ${agente}\nError: ${error}\n_Revisión manual requerida_`);
  },

  // Límite de gasto API alcanzado
  async limiteCostoAlcanzado(costoHoy, limite) {
    await enviar(`⚠️ *LÍMITE DE COSTO API*\nGasto hoy: $${costoHoy.toFixed(4)}\nLímite: $${limite}\n_Sistema pausado hasta mañana_`);
  }
};

// ════════════════════════════════════
// APROBACIÓN HUMANA (decisiones importantes)
// ════════════════════════════════════

/**
 * Envía una pregunta al dueño y espera respuesta por X horas.
 * Si no responde, toma la acción por defecto.
 * @param {string} pregunta
 * @param {string[]} opciones       - Ej: ['SI', 'NO', 'ESPERAR']
 * @param {string} accionDefault    - Qué hacer si no responde
 * @returns {string}                - La opción elegida
 */
export async function pedirAprobacion(pregunta, opciones, accionDefault) {
  const opcionesTexto = opciones.map((o, i) => `${i + 1}. ${o}`).join('\n');
  const timeoutHoras = APPROVAL_TIMEOUT_HOURS;

  await enviar(
    `❓ *APROBACIÓN REQUERIDA*\n\n${pregunta}\n\n${opcionesTexto}\n\n_Responde con el número. Si no respondes en ${timeoutHoras}h, se ejecuta: "${accionDefault}"_`
  );

  await db.log('telegram', 'aprobacion_solicitada', { pregunta: pregunta.slice(0, 200), opciones, accionDefault });

  // Espera la respuesta con polling temporal
  return new Promise((resolve) => {
    // Usa getUpdates manualmente para evitar conflictos de polling
    let resuelto = false;
    let offset = 0;

    const checkRespuesta = async () => {
      if (resuelto) return;
      try {
        const updates = await bot.getUpdates({ offset, limit: 10, timeout: 10 });
        for (const update of updates) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg || String(msg.chat.id) !== String(CHAT_ID)) continue;
          const num = parseInt(msg.text?.trim());
          if (num >= 1 && num <= opciones.length) {
            resuelto = true;
            clearInterval(intervalo);
            clearTimeout(timeoutId);
            const elegida = opciones[num - 1];
            await db.log('telegram', 'aprobacion_recibida', { opcion: elegida });
            await enviar(`✅ Recibido: <b>${elegida}</b>`);
            resolve(elegida);
            return;
          }
        }
      } catch {}
    };

    const intervalo = setInterval(checkRespuesta, 3000);

    const timeoutId = setTimeout(async () => {
      if (resuelto) return;
      resuelto = true;
      clearInterval(intervalo);
      await db.log('telegram', 'aprobacion_timeout', { accion_default: accionDefault });
      await enviar(`⏰ Sin respuesta en ${timeoutHoras}h. Ejecutando: <b>${accionDefault}</b>`);
      resolve(accionDefault);
    }, timeoutHoras * 60 * 60 * 1000);
  });
}

export { bot };
