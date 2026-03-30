// ════════════════════════════════════
// NEXUS AGENT — agents/digital/researcher.js
// Encuentra el nicho digital más rentable ahora mismo
// v2: busca 5 candidatos, filtra score >= 82, enriquece el ganador
// ════════════════════════════════════

import { preguntarJSON } from '../../core/claude.js';
import { memory } from '../../core/memory.js';
import { db } from '../../core/database.js';
import { enviar } from '../../core/telegram.js';

const SCORE_MINIMO = 82;
const MAX_RONDAS = 3;     // intentos para encontrar >= 82
const CANDIDATOS_POR_RONDA = 5;

const SYSTEM = `Eres el agente investigador de NEXUS AGENT. Tu trabajo es encontrar
nichos de productos digitales rentables en el mercado latino/hispano de USA (Miami,
NY, Houston, LA) y América Latina. Analizas tendencias reales y recomiendas productos
que la gente ya está buscando y pagando. Siempre respondes con JSON válido.

CRITERIOS DE SCORING (sé honesto, no infles el score):
- 90-100: Problema urgente, alta búsqueda, poca competencia en español, precio validado, audiencia latina amplia o subgrupo cuando aplica
- 75-89: Buen problema, demanda media-alta, algo de competencia, precio razonable
- 60-74: Nicho viable pero genérico o con competencia moderada
- Menor a 60: No lo recomiendes — descártalo y busca otro

NICHOS SATURADOS — NUNCA SUGERIR (el mercado latino ya no les cree):
- Dropshipping genérico, "vende en Amazon sin inventario", "gana dinero en TikTok",
  "marketing de afiliados para principiantes", "curso de Forex/crypto para todos",
  "trabaja desde casa sin experiencia", "gana $5,000/mes en Instagram"

AUDIENCIA — usa "Latinos en EE.UU." por defecto para la mayoría de productos.
Solo usa un subgrupo específico cuando el producto LO REQUIERE por naturaleza:
- Documentos/ITIN/licencia sin SSN → solo para indocumentados (CA, TX, IL)
- Trámites de inmigración → subgrupo específico por país de origen
- Todo lo demás (negocios, tecnología, finanzas, cursos, prompts) → "Latinos en EE.UU." es correcto
El mercado latino completo (mexicanos, cubanos, puertorriqueños, dominicanos, colombianos, venezolanos) compra los mismos productos digitales. No los segmentes sin razón.`;

// ── Paso 1: Buscar 5 candidatos (campos mínimos, barato y rápido) ──
async function buscarCandidatos(ganadoresTexto, blacklistTexto, nichosYaVistos = []) {
  const evitar = nichosYaVistos.length
    ? `\nNICHOS YA EVALUADOS ESTA RONDA — NO REPETIR:\n${nichosYaVistos.join('\n')}`
    : '';

  const candidatos = await preguntarJSON(`
Necesito ${CANDIDATOS_POR_RONDA} nichos DISTINTOS para productos digitales para el mercado hispano.
Fecha actual: ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}.

NICHOS QUE YA FUNCIONARON (replicar/mejorar):
${ganadoresTexto}

NICHOS RECHAZADOS — NO SUGERIR NI NINGUNA VARIACIÓN DEL MISMO TEMA:
${blacklistTexto}
CRÍTICO: Si un tema aparece en la lista de arriba, evita TODA variación del mismo. Ejemplo: si "fotografía con IA" está rechazado, no sugieras "fotos para eventos con IA", "edición de fotos con inteligencia artificial", etc. El tema completo está descartado.
${evitar}

Para cada candidato evalúa honestamente: urgencia del problema, búsqueda activa en español,
precio validado, competencia baja en español, subgrupo latino específico.

Solo incluye nichos con score real >= 75. Si no encuentras 5, devuelve los que pasen ese umbral.

Devuelve un JSON array con exactamente este formato:
[
  {
    "nicho": "nombre específico y concreto",
    "subgrupo_latino": "grupo específico",
    "tipo": "prompts|plantilla|guia_pdf|mini_curso|toolkit",
    "precio": 37,
    "score": 85,
    "razon_score": "justificación honesta en 1-2 líneas",
    "problema_que_resuelve": "el dolor en palabras del cliente",
    "formato_ad_recomendado": "stories|feed"
  }
]
Solo el array JSON, sin texto adicional.
`, SYSTEM, 'researcher');

  // Normalizar — puede venir como array directo o dentro de una clave
  if (Array.isArray(candidatos)) return candidatos;
  if (Array.isArray(candidatos?.candidatos)) return candidatos.candidatos;
  if (Array.isArray(candidatos?.nichos)) return candidatos.nichos;
  return [];
}

// ── Paso 2: Enriquecer el candidato ganador con todos los detalles ──
async function enriquecerNicho(candidato, ganadoresTexto, blacklistTexto) {
  console.log(`[Researcher] Enriqueciendo ganador: "${candidato.nicho}" (score ${candidato.score})`);

  const resultado = await preguntarJSON(`
Necesito los detalles COMPLETOS para crear y vender este producto digital:

NICHO SELECCIONADO: ${candidato.nicho}
Subgrupo: ${candidato.subgrupo_latino}
Tipo: ${candidato.tipo}
Precio: $${candidato.precio}
Problema: ${candidato.problema_que_resuelve}
Score preliminar: ${candidato.score}
Formato ad: ${candidato.formato_ad_recomendado}

Contexto ganadores previos: ${ganadoresTexto}

Completa todos los campos para este nicho específico.
Para formato_ad_recomendado usa:
- "stories": urgencia/supervivencia (documentos, inmigración, trabajo, licencias, crédito, $17-$47) — CPC $1.83
- "feed": transformación/aspiración (negocios, inversión, tecnología, cursos premium, $47-$97)

Devuelve JSON con TODOS estos campos:
{
  "nicho": "${candidato.nicho}",
  "subgrupo_latino": "${candidato.subgrupo_latino}",
  "tipo": "${candidato.tipo}",
  "nombre_producto": "nombre que el cliente ideal entiende en 3 segundos y quiere comprar",
  "subtitulo": "subtítulo con el resultado concreto: qué logra, en cuánto tiempo, sin qué requisito",
  "precio": ${candidato.precio},
  "problema_que_resuelve": "el dolor específico en palabras que usaría el cliente, no un marketero",
  "cliente_ideal": "nombre ficticio + edad + ciudad + situación exacta + por qué necesita esto HOY",
  "puntos_de_venta": ["resultado concreto con número", "resultado 2", "resultado 3", "resultado 4"],
  "quick_win": "acción exacta que hace en los primeros 30 minutos y resultado que tiene al terminar",
  "herramientas_clave": ["Herramienta real (gratis/$X/mes)", "Herramienta2", "Herramienta3"],
  "modulos_temas": [
    "Tema específico del nicho — NO 'Introducción' ni 'Fundamentos'",
    "Tema 2", "Tema 3", "Tema 4", "Tema 5", "Tema 6"
  ],
  "ejemplo_exito": "historia de 2-3 líneas: nombre latino + ciudad + situación inicial + resultado con números",
  "score": ${candidato.score},
  "razon_score": "${candidato.razon_score}",
  "razon": "por qué este nicho AHORA — tendencia, evento, temporada o necesidad urgente actual",
  "formato_ad_recomendado": "${candidato.formato_ad_recomendado}",
  "razon_formato": "por qué este formato para este subgrupo específico"
}
`, SYSTEM, 'researcher');

  return resultado;
}

// ── Función principal exportada ──────────────────────────────
export async function investigarNicho() {
  console.log('[Researcher] Iniciando búsqueda multi-candidato...');

  const [ganadores, blacklist] = await Promise.all([
    memory.getGanadores('digital'),
    memory.getBlacklist('digital')
  ]);

  // Truncar cada entrada a 200 chars — evita prompt injection desde contenido de memoria
  const ganadoresTexto = ganadores.map(g => g.contenido?.slice(0, 200)).join('\n') || 'Ninguno aún';
  const blacklistTexto = blacklist.map(b => b.contenido?.slice(0, 200)).join('\n') || 'Ninguno aún';

  let mejorCandidato = null;
  const nichosYaVistos = [];

  for (let ronda = 1; ronda <= MAX_RONDAS; ronda++) {
    if (ronda > 1) {
      await enviar(`🔍 Buscando nichos de mayor calidad... (ronda ${ronda}/${MAX_RONDAS})`).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
    }

    const candidatos = await buscarCandidatos(ganadoresTexto, blacklistTexto, nichosYaVistos);

    if (!candidatos.length) {
      console.warn(`[Researcher] Ronda ${ronda}: sin candidatos válidos`);
      continue;
    }

    // Registrar para no repetir en próxima ronda
    candidatos.forEach(c => nichosYaVistos.push(c.nicho));

    // Ordenar por score desc
    candidatos.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`[Researcher] Ronda ${ronda} — ${candidatos.length} candidatos:`);
    candidatos.forEach(c => console.log(`  • Score ${c.score}: ${c.nicho}`));

    // ¿Alguno supera el mínimo?
    const calificados = candidatos.filter(c => c.score >= SCORE_MINIMO);

    if (calificados.length > 0) {
      mejorCandidato = calificados[0]; // el de mayor score
      console.log(`[Researcher] Ganador encontrado en ronda ${ronda}: "${mejorCandidato.nicho}" — ${mejorCandidato.score}/100`);
      break;
    }

    // Última ronda: aceptar el mejor aunque no llegue al mínimo
    if (ronda === MAX_RONDAS) {
      mejorCandidato = candidatos[0];
      console.warn(`[Researcher] Ninguno superó ${SCORE_MINIMO} tras ${MAX_RONDAS} rondas — usando mejor disponible: ${mejorCandidato.score}/100`);
      await enviar(`⚠️ Mejor nicho encontrado: score ${mejorCandidato.score}/100 (mínimo es ${SCORE_MINIMO})\nSi no te convence usa <b>OTRO</b> para buscar más.`).catch(() => {});
    }
  }

  if (!mejorCandidato) {
    throw new Error('No se encontraron nichos válidos tras todos los intentos. Intenta LANZAR de nuevo.');
  }

  // Enriquecer el ganador con todos los detalles
  const nicho = await enriquecerNicho(mejorCandidato, ganadoresTexto, blacklistTexto);

  await db.log('researcher', 'nicho_encontrado', {
    nicho: nicho.nicho,
    tipo: nicho.tipo,
    score: nicho.score,
    rondas_necesarias: nichosYaVistos.length / CANDIDATOS_POR_RONDA
  });

  console.log(`[Researcher] Nicho final: "${nicho.nombre_producto}" — Score ${nicho.score}/100`);
  return nicho;
}
