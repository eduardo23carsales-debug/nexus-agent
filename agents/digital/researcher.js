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
que la gente ya está buscando y pagando. Siempre respondes con JSON válido.`;

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
1. Alta demanda en el mercado hispano ahora mismo
2. Producto que se pueda crear en pocas horas con IA
3. Precio entre $17-$97 que la gente pague sin dudar
4. Poca competencia directa en español
5. Problema real y urgente que resuelve

Tipos de productos posibles:
- Pack de prompts de IA en español ($17-47)
- Plantilla Notion/Excel para negocio ($17-37)
- Guía PDF de negocio o finanzas ($27-67)
- Mini curso de texto ($47-97)
- Checklist/toolkit profesional ($17-37)

Devuelve JSON con TODOS estos campos — son críticos para generar contenido específico y de alta calidad:
{
  "nicho": "nombre del nicho específico",
  "tipo": "prompts|plantilla|guia_pdf|mini_curso|toolkit",
  "nombre_producto": "nombre atractivo del producto",
  "subtitulo": "subtítulo que explica el beneficio concreto",
  "precio": 27,
  "problema_que_resuelve": "descripción detallada del dolor del cliente",
  "cliente_ideal": "perfil detallado: edad, situación, por qué lo necesita YA",
  "puntos_de_venta": ["beneficio concreto 1 con número o resultado", "beneficio 2", "beneficio 3", "beneficio 4"],
  "quick_win": "resultado específico y concreto que el cliente logra en los primeros 30 minutos de aplicar el producto (ej: 'Tener su primera lista de productos para vender en Amazon con margen >40%')",
  "herramientas_clave": ["Herramienta1 (gratis/precio)", "Herramienta2", "Herramienta3", "Herramienta4", "Herramienta5"],
  "modulos_temas": [
    "Tema específico 1 relevante al nicho (NO genérico como 'Fundamentos')",
    "Tema específico 2",
    "Tema específico 3",
    "Tema específico 4",
    "Tema específico 5",
    "Tema específico 6"
  ],
  "ejemplo_exito": "caso real o tipo de persona del mercado hispano que logró resultados con esto, con números específicos",
  "score": 85,
  "razon": "por qué este nicho ahora mismo"
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
