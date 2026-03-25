// ════════════════════════════════════
// NEXUS AGENT — core/brain.js
// Toma de decisiones con IA + memoria acumulativa
// ════════════════════════════════════

import { preguntarJSON, decidir } from './claude.js';
import { memory } from './memory.js';
import { db } from './database.js';
import { alerta } from './telegram.js';

const SYSTEM_BRAIN = `Eres el cerebro de NEXUS AGENT, un sistema autónomo de ingresos digitales.
Tu trabajo es analizar datos, aprender de la historia del sistema y tomar decisiones
que maximicen ingresos de manera sostenible. Siempre respondes en español con JSON válido.`;

export const brain = {

  // ════════════════════════════════════
  // MOTOR 1 — DECISIONES DE EXPERIMENTOS
  // ════════════════════════════════════

  // Evalúa si un nicho vale la pena lanzar
  async evaluarNicho(nicho, tipo, precio) {
    const contexto = await memory.getContexto('digital');
    const blacklist = await memory.getBlacklist('digital');
    const blacklistTexto = blacklist.map(b => b.contenido).join('\n') || 'Ninguno aún';

    const resultado = await preguntarJSON(`
Evalúa este nicho para un producto digital:
- Nicho: ${nicho}
- Tipo: ${tipo}
- Precio: $${precio}

MEMORIA DEL SISTEMA (aprendizajes previos):
${contexto}

NICHOS A EVITAR (ya fallaron):
${blacklistTexto}

Devuelve JSON:
{
  "score": 0-100,
  "decision": "lanzar" | "consultar" | "descartar",
  "razon": "explicación breve",
  "precio_sugerido": numero,
  "riesgos": ["riesgo1", "riesgo2"]
}

REGLA: score > 80 = lanzar automático | 60-80 = consultar dueño | < 60 = descartar
`, SYSTEM_BRAIN, 'brain');

    await db.log('brain', 'evaluacion_nicho', { nicho, tipo, precio, resultado });
    return resultado;
  },

  // Decide qué hacer con un experimento a las 72h
  async decidirSuerteExperimento(exp) {
    const contexto = await memory.getContexto('digital');

    const resultado = await preguntarJSON(`
Analiza este experimento a las 72 horas:

Nicho: ${exp.nicho}
Tipo: ${exp.tipo}
Precio: $${exp.precio}
Métricas: ${JSON.stringify(exp.metricas, null, 2)}

MEMORIA DEL SISTEMA:
${contexto}

Decide su suerte. Devuelve JSON:
{
  "decision": "escalar" | "matar" | "extender_7_dias" | "ajustar_precio",
  "razon": "explicación",
  "aprendizaje": "qué aprendemos de esto para el futuro",
  "precio_nuevo": null o número si ajustas precio
}

REGLAS:
- revenue > 0 Y conversion_rate > 1% → escalar
- revenue = 0 Y clicks < 50 → matar (sin tracción)
- revenue = 0 Y clicks > 50 → extender 7 días (hay tráfico, falta conversión)
- precio muy alto con clicks pero sin ventas → ajustar_precio
`, SYSTEM_BRAIN, 'brain');

    await db.log('brain', 'decision_experimento', { exp_id: exp.id, resultado });
    return resultado;
  },

  // ════════════════════════════════════
  // MOTOR 2 — DECISIONES DE LEADS
  // ════════════════════════════════════

  // Califica un lead con score 1-10
  async calificarLead(lead) {
    const contexto = await memory.getContexto(lead.industria);

    const resultado = await preguntarJSON(`
Califica este lead para un dealer/negocio:

Industria: ${lead.industria}
Descripción necesidad: ${lead.descripcion_necesidad}
Presupuesto: $${lead.presupuesto_min} - $${lead.presupuesto_max}
Urgencia: ${lead.urgencia}
Ubicación: ${lead.ubicacion}
Mensaje original: ${lead.mensaje_original?.slice(0, 500)}

PATRONES DE LEADS EXITOSOS EN ${lead.industria}:
${contexto}

Devuelve JSON:
{
  "score": 1-10,
  "es_calificado": true si score >= 7,
  "razon": "por qué este score",
  "datos_faltantes": ["dato1", "dato2"] o [],
  "urgencia_real": "inmediata" | "este_mes" | "3_meses" | "explorando"
}
`, SYSTEM_BRAIN, 'brain');

    await db.log('brain', 'calificacion_lead', { lead_industria: lead.industria, score: resultado.score });
    return resultado;
  },

  // Decide a qué cliente B2B enviar un lead
  async asignarLeadACliente(lead, clientesDisponibles) {
    if (!clientesDisponibles.length) return null;
    if (clientesDisponibles.length === 1) return clientesDisponibles[0];

    const opciones = clientesDisponibles.map(c =>
      `ID:${c.id} | ${c.nombre} | tasa_cierre:${c.tasa_cierre}% | leads_entregados:${c.leads_entregados}`
    );

    const resultado = await decidir(
      `Lead de ${lead.industria} con score ${lead.score}/10 y presupuesto $${lead.presupuesto_min}-$${lead.presupuesto_max}. ¿A cuál cliente enviarlo?`,
      opciones,
      'brain'
    );

    const clienteElegido = clientesDisponibles.find(c => resultado.decision.includes(c.id));
    return clienteElegido || clientesDisponibles[0];
  },

  // ════════════════════════════════════
  // DECISIONES GENERALES DEL SISTEMA
  // ════════════════════════════════════

  // Decide si activar una nueva vertical de leads
  async debeActivarNuevaVertical(resumenFinanciero, verticalesActivas) {
    const MIN_REVENUE = Number(process.env.MIN_REVENUE_TO_EXPAND) || 2000;
    const MAX_VERTICALES = Number(process.env.MAX_PARALLEL_VERTICALS) || 3;

    if (verticalesActivas.length >= MAX_VERTICALES) return { activar: false, razon: 'Máximo de verticales alcanzado' };
    if (resumenFinanciero.leadgen.ingresos < MIN_REVENUE) return { activar: false, razon: `Ingresos insuficientes ($${resumenFinanciero.leadgen.ingresos} < $${MIN_REVENUE})` };

    const ORDEN_VERTICALES = ['automotive', 'real_estate', 'medical', 'hospitality', 'legal', 'restaurant'];
    const siguiente = ORDEN_VERTICALES.find(v => !verticalesActivas.includes(v));

    if (!siguiente) return { activar: false, razon: 'Todas las verticales ya activas' };

    await alerta.enviar(`🌱 *NUEVA VERTICAL DISPONIBLE*\nIngresos suficientes ($${resumenFinanciero.leadgen.ingresos})\nSiguiente vertical: *${siguiente}*\n¿Activo? Responde SI o NO`);

    return { activar: true, vertical: siguiente, razon: `Ingresos > $${MIN_REVENUE}` };
  },

  // Genera resumen del estado del sistema para el reporte diario
  async generarResumenDiario() {
    const [financiero, memStats, expsActivos] = await Promise.all([
      db.getResumenFinanciero(),
      memory.getStats(),
      db.getExperimentosActivos()
    ]);

    await alerta.reporteDiario(financiero);

    return { financiero, memStats, expsActivos: expsActivos.length };
  }
};
