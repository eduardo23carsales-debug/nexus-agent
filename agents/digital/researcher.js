// ════════════════════════════════════
// NEXUS AGENT — agents/digital/researcher.js
// Encuentra el nicho digital más rentable ahora mismo
// ════════════════════════════════════

import { preguntarJSON } from '../../core/claude.js';
import { memory } from '../../core/memory.js';
import { db } from '../../core/database.js';
import { enviar } from '../../core/telegram.js';

const SYSTEM = `Eres el agente investigador de NEXUS AGENT. Tu trabajo es encontrar
nichos de productos digitales rentables en el mercado latino/hispano de USA (Miami,
NY, Houston, LA) y América Latina. Analizas tendencias reales y recomiendas productos
que la gente ya está buscando y pagando. Siempre respondes con JSON válido.

CRITERIOS DE SCORING (sé honesto, no infles el score):
- 90-100: Problema urgente, alta búsqueda, poca competencia en español, precio validado, subgrupo latino específico
- 75-89: Buen problema, demanda media-alta, algo de competencia, precio razonable
- 60-74: Nicho viable pero genérico o con competencia moderada
- Menor a 60: No lo recomiendes — descártalo y busca otro

NICHOS SATURADOS — NUNCA SUGERIR (el mercado latino ya no les cree):
- Dropshipping genérico, "vende en Amazon sin inventario", "gana dinero en TikTok",
  "marketing de afiliados para principiantes", "curso de Forex/crypto para todos",
  "trabaja desde casa sin experiencia", "gana $5,000/mes en Instagram"

SUBGRUPOS LATINOS EN USA — sé específico (no digas solo "hispanos"):
- Mexicanos/centroamericanos indocumentados (CA, TX, IL): documentos, ITIN, licencia sin SSN, negocios informales
- Mexicanos con permiso de trabajo (TX, CA): crédito, negocio propio, licencias profesionales
- Cubanos/venezolanos (FL): emprendimiento, libertad financiera, e-commerce
- Puertorriqueños (NY, FL): educación, tecnología, carrera profesional
- Latinos establecidos (todos): inversión, bienes raíces, impuestos, retiro`;

export async function investigarNicho() {
  console.log('[Researcher] Buscando nicho rentable...');

  // Cargar memoria — qué ya funcionó y qué falló
  const [ganadores, blacklist] = await Promise.all([
    memory.getGanadores('digital'),
    memory.getBlacklist('digital')
  ]);

  const ganadoresTexto = ganadores.map(g => g.contenido).join('\n') || 'Ninguno aún';
  const blacklistTexto = blacklist.map(b => b.contenido).join('\n') || 'Ninguno aún';

  const resultado = await preguntarJSON(`
Necesito el MEJOR nicho para crear y vender un producto digital HOY.

Mercado objetivo: hispanos en USA (Miami, Houston, LA, NY) y América Latina.
Fecha actual: ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}.

NICHOS QUE YA FUNCIONARON (replicar/mejorar):
${ganadoresTexto}

NICHOS A EVITAR (ya fallaron):
${blacklistTexto}

Analiza estos factores para elegir el mejor nicho:
1. Problema URGENTE y específico — el cliente lo necesita esta semana, no "algún día"
2. Búsqueda activa en español — hay gente buscando esto en Google/YouTube en español ahora
3. Precio validado — hay gente pagando por soluciones similares (aunque sean en inglés)
4. Competencia baja EN ESPAÑOL — puede haber competencia en inglés, pero en español hay hueco
5. Subgrupo latino específico — no "todos los hispanos", sino un grupo concreto con un dolor concreto
6. Producto creatable con IA en menos de 4 horas — no requiere experiencia real del creador

Para el campo formato_ad_recomendado usa esta lógica:
- "stories": urgencia/supervivencia (documentos, inmigración, trabajo, licencias, crédito, $17-$47) — CPC $1.83
- "feed": transformación/aspiración (negocios, inversión, tecnología, cursos premium, $47-$97)

Tipos de productos y cuándo usar cada uno:
- Pack de prompts IA ($17-$37): cuando el cliente ya usa IA pero no sabe cómo aplicarla a su caso
- Plantilla Notion/Excel ($17-$37): cuando el problema es de organización, seguimiento o cálculo
- Guía PDF ($27-$57): cuando el cliente necesita un proceso paso a paso documentado
- Mini curso HTML ($47-$97): cuando hay múltiples pasos que aprender en secuencia
- Toolkit/checklist ($17-$37): cuando el cliente necesita no olvidar pasos críticos

Devuelve JSON con TODOS estos campos:
{
  "nicho": "nombre específico del nicho — NO genérico (mal: 'negocios online', bien: 'ITIN para indocumentados en Texas')",
  "subgrupo_latino": "grupo específico: ej. 'Mexicanos indocumentados en TX y CA, 25-45 años'",
  "tipo": "prompts|plantilla|guia_pdf|mini_curso|toolkit",
  "nombre_producto": "nombre que el cliente ideal entiende en 3 segundos y quiere comprar",
  "subtitulo": "subtítulo con el resultado concreto: qué logra, en cuánto tiempo, sin qué requisito",
  "precio": 27,
  "problema_que_resuelve": "el dolor específico en palabras que usaría el cliente, no un marketero",
  "cliente_ideal": "nombre ficticio + edad + ciudad + situación exacta + por qué necesita esto HOY (ej: 'Jorge, 38 años, Houston TX, llegó hace 5 años, trabaja en construcción, quiere manejar legal pero no tiene SSN')",
  "puntos_de_venta": ["resultado concreto con número", "resultado 2", "resultado 3", "resultado 4"],
  "quick_win": "acción exacta que hace en los primeros 30 minutos y resultado que tiene al terminar",
  "herramientas_clave": ["Herramienta real (gratis/$X/mes)", "Herramienta2", "Herramienta3"],
  "modulos_temas": [
    "Tema específico del nicho — NO 'Introducción' ni 'Fundamentos'",
    "Tema 2", "Tema 3", "Tema 4", "Tema 5", "Tema 6"
  ],
  "ejemplo_exito": "historia de 2-3 líneas: nombre latino + ciudad + situación inicial + resultado con números (ej: 'Carlos de Dallas pasó de manejar sin licencia a obtener su TX DL en 6 semanas siguiendo estos pasos')",
  "score": 85,
  "razon_score": "justificación honesta del score — qué lo hace bueno y qué limitaciones tiene",
  "razon": "por qué este nicho AHORA — tendencia, evento, temporada o necesidad urgente actual",
  "formato_ad_recomendado": "stories|feed",
  "razon_formato": "por qué este formato para este subgrupo específico"
}
`, SYSTEM, 'researcher');

  await db.log('researcher', 'nicho_encontrado', {
    nicho: resultado.nicho,
    tipo: resultado.tipo,
    score: resultado.score
  });

  console.log(`[Researcher] Nicho encontrado: "${resultado.nombre_producto}" — Score ${resultado.score}/100`);
  return resultado;
}
