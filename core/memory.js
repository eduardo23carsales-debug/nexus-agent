// ════════════════════════════════════
// NEXUS AGENT — core/memory.js
// Memoria acumulativa del sistema
// Lo que falló nunca se repite. Lo que funcionó se replica.
// ════════════════════════════════════

import { db } from './database.js';

// ════════════════════════════════════
// GUARDAR APRENDIZAJES
// ════════════════════════════════════

export const memory = {

  // Guarda lo que funcionó (refuerza con alta confianza)
  async aprendioQueFunciona(categoria, contenido) {
    await db.guardarMemoria({
      tipo: 'patron',
      categoria,
      contenido,
      confianza: 0.8
    });
  },

  // Guarda lo que falló (confianza baja, para evitarlo)
  async aprendioQueFalla(categoria, contenido) {
    await db.guardarMemoria({
      tipo: 'aprendizaje',
      categoria,
      contenido: `[EVITAR] ${contenido}`,
      confianza: 0.9 // alta confianza en que hay que evitarlo
    });
  },

  // Guarda una regla de negocio descubierta
  async guardarRegla(categoria, contenido) {
    await db.guardarMemoria({
      tipo: 'regla',
      categoria,
      contenido,
      confianza: 0.75
    });
  },

  // Guarda un insight de alto valor
  async guardarInsight(categoria, contenido) {
    await db.guardarMemoria({
      tipo: 'insight',
      categoria,
      contenido,
      confianza: 0.7
    });
  },

  // ════════════════════════════════════
  // LEER MEMORIA PARA CONTEXTO
  // ════════════════════════════════════

  // Devuelve memoria relevante como string para inyectar en prompts de Claude
  async getContexto(categoria = null) {
    const memorias = await db.getMemoria(categoria);
    if (!memorias.length) return 'Sin memoria previa para esta categoría.';

    return memorias
      .slice(0, 20) // máx 20 memorias para no saturar el prompt
      .map(m => `[${m.tipo.toUpperCase()}] ${m.contenido} (confianza: ${m.confianza})`)
      .join('\n');
  },

  // Devuelve solo los patrones ganadores
  async getGanadores(categoria = null) {
    const memorias = await db.getMemoria(categoria);
    return memorias.filter(m => m.tipo === 'patron' && !m.contenido.includes('[EVITAR]'));
  },

  // Devuelve solo lo que hay que evitar
  async getBlacklist(categoria = null) {
    const memorias = await db.getMemoria(categoria);
    return memorias.filter(m => m.contenido.includes('[EVITAR]'));
  },

  // Guarda un nicho rechazado manualmente por Eduardo
  async rechazarNicho(nicho) {
    await db.guardarMemoria({
      tipo: 'aprendizaje',
      categoria: 'digital',
      contenido: `[EVITAR] Nicho rechazado manualmente: "${nicho.nicho || nicho}" — tipo ${nicho.tipo || '?'} a $${nicho.precio || '?'}. Motivo: rechazado por Eduardo.`,
      confianza: 1.0 // máxima confianza — decisión humana
    });
  },

  // ════════════════════════════════════
  // APRENDER DE UN EXPERIMENTO TERMINADO
  // ════════════════════════════════════

  async aprenderDeExperimento(exp) {
    const gano = exp.metricas?.revenue > 0;
    const categoria = 'digital';

    if (gano) {
      await this.aprendioQueFunciona(categoria,
        `Nicho "${exp.nicho}" tipo ${exp.tipo} a $${exp.precio} generó $${exp.metricas.revenue} en revenue. Fuentes: ${exp.metricas?.fuentes || 'desconocido'}`
      );
    } else {
      await this.aprendioQueFalla(categoria,
        `Nicho "${exp.nicho}" tipo ${exp.tipo} a $${exp.precio} — $0 revenue después de 72h. Aprendizaje: ${exp.aprendizaje || 'sin tracción'}`
      );
    }
  },

  // ════════════════════════════════════
  // APRENDER DE UN LEAD
  // ════════════════════════════════════

  async aprenderDeLead(lead) {
    const cerrado = lead.estado === 'cerrado';
    const categoria = lead.industria || 'leadgen';

    if (cerrado) {
      await this.aprendioQueFunciona(categoria,
        `Lead cerrado en ${lead.industria}: presupuesto $${lead.presupuesto_min}-$${lead.presupuesto_max}, urgencia "${lead.urgencia}", fuente "${lead.fuente}". Score fue ${lead.score}/10`
      );
    } else if (lead.estado === 'perdido') {
      await this.aprendioQueFalla(categoria,
        `Lead perdido en ${lead.industria}: ${lead.motivo_perdida || 'sin motivo'}. Score fue ${lead.score}/10, fuente "${lead.fuente}"`
      );
    }
  },

  // ════════════════════════════════════
  // STATS DE MEMORIA
  // ════════════════════════════════════

  async getStats() {
    const todas = await db.getMemoria();
    const stats = { total: todas.length, por_tipo: {}, por_categoria: {} };

    for (const m of todas) {
      stats.por_tipo[m.tipo] = (stats.por_tipo[m.tipo] || 0) + 1;
      stats.por_categoria[m.categoria] = (stats.por_categoria[m.categoria] || 0) + 1;
    }

    return stats;
  }
};
