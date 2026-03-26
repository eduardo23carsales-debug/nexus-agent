# ⚡ NEXUS AGENT — MÓDULO ADS MANAGER
# Integración Meta Ads + Google Ads Automatizado
# Agregar al sistema existente NEXUS AGENT v4
# Marzo 2026

---

> **CONTEXTO:** El sistema NEXUS AGENT ya está corriendo.
> Tiene landing pages, productos digitales, pasarela de pago Stripe,
> Telegram funcionando y agentes activos.
> Este módulo agrega el motor de publicidad automatizado
> para que los agentes promocionen sus propios productos
> y se multipliquen con las ganancias de los ads.

---

## 🎯 MISIÓN DEL MÓDULO

```
Producto creado por el agente
         ↓
ads-manager.js crea campaña automática
en Meta Ads Y Google Ads simultáneo
         ↓
$5/día por plataforma para validar
         ↓
48-72 horas de datos reales
         ↓
¿ROAS > 1.5? (ganas más de lo que gastas)
SÍ → escala presupuesto automático
NO → pausa campaña, prueba otra audiencia
         ↓
Telegram te avisa de cada decisión
         ↓
Las ganancias financian más campañas
```

---

## 📁 ESTRUCTURA DEL MÓDULO

```
agents/advanced/
└── ads-manager.js          ← orquestador de campañas

agents/ads/
├── meta-ads.js             ← Meta Marketing API
├── google-ads.js           ← Google Ads API
├── audience-builder.js     ← construye audiencias por nicho
├── creative-generator.js   ← genera creativos con IA
├── campaign-validator.js   ← mide y decide cada campaña
└── budget-controller.js    ← controla presupuesto total

core/
└── ads-treasury.js         ← gestión financiera de ads
```

---

## 🔧 VARIABLES DE ENTORNO — AGREGAR AL .env

```env
# ════════════════════════════════════
# META ADS (Facebook + Instagram)
# ════════════════════════════════════
META_APP_ID=                    # Meta Developers → crear App
META_APP_SECRET=                # Meta Developers → App Secret
META_ACCESS_TOKEN=              # Token de larga duración
META_AD_ACCOUNT_ID=             # act_XXXXXXXXX
META_PIXEL_ID=                  # Para tracking de conversiones
META_PAGE_ID=                   # Tu página de Facebook

# ════════════════════════════════════
# GOOGLE ADS
# ════════════════════════════════════
GOOGLE_ADS_CLIENT_ID=           # Google Cloud Console
GOOGLE_ADS_CLIENT_SECRET=       # Google Cloud Console
GOOGLE_ADS_REFRESH_TOKEN=       # OAuth2 refresh token
GOOGLE_ADS_DEVELOPER_TOKEN=     # Google Ads API Center
GOOGLE_ADS_CUSTOMER_ID=         # Tu ID de cuenta Google Ads
GOOGLE_ADS_LOGIN_CUSTOMER_ID=   # Mismo si no usas MCC

# ════════════════════════════════════
# HOTMART (canal adicional de ventas)
# ════════════════════════════════════
HOTMART_CLIENT_ID=              # Hotmart Developers
HOTMART_CLIENT_SECRET=
HOTMART_BASIC_TOKEN=

# ════════════════════════════════════
# CONTROL DE PRESUPUESTO
# ════════════════════════════════════
ADS_DAILY_MAX_SPEND=20          # máx $20/día total sin permiso
ADS_PER_PRODUCT_DAILY=5         # $5/día por producto nuevo
ADS_SCALE_MULTIPLIER=2          # duplica presupuesto si ROAS > 1.5
ADS_MIN_ROAS_TO_SCALE=1.5       # ROAS mínimo para escalar
ADS_MAX_ROAS_TO_KILL=0.5        # ROAS máximo para matar campaña
ADS_VALIDATION_HOURS=72         # horas para decidir
```

---

## 🤖 AGENTES EN DETALLE

### ads-manager.js — El Orquestador

```javascript
/*
MISIÓN: Coordina todo el ciclo de publicidad.
Se activa automáticamente cuando un producto es creado.

CUÁNDO SE ACTIVA:
- Cuando generator.js termina un producto nuevo
- Cuando validator.js marca un experimento como "vivo"
- Cuando replicator.js lanza una variación

CICLO COMPLETO:

1. Recibe el producto del sistema:
   {
     nombre: "50 Prompts de IA",
     landing_url: "https://prompts.tudominio.com",
     stripe_link: "https://buy.stripe.com/XXX",
     precio: 17,
     nicho: "emprendedores latinos",
     tipo: "prompts"
   }

2. Llama a audience-builder.js
   → construye audiencias para ese nicho específico

3. Llama a creative-generator.js
   → genera imagen y copy del anuncio con IA

4. Lanza campaña en Meta Ads ($5/día)
   → llama a meta-ads.js

5. Lanza campaña en Google Ads ($5/día)
   → llama a google-ads.js

6. Registra todo en Supabase tabla "campaigns"

7. Alerta Telegram:
   "📢 CAMPAÑAS LANZADAS
    Producto: [nombre]
    Meta Ads: $5/día → activo
    Google Ads: $5/día → activo
    Decisión en: 72 horas"

8. Activa campaign-validator.js cada 6h
   para monitorear métricas en tiempo real
*/
```

---

### audience-builder.js — Construye la Audiencia Perfecta

```javascript
/*
MISIÓN: Usar Claude + datos del nicho para construir
la audiencia más específica y rentable posible.

Para cada producto, Claude analiza el nicho y genera:

PARA META ADS:
{
  "intereses": [
    "Emprendimiento", "Marketing Digital",
    "Negocios en línea", "Inteligencia Artificial",
    "Trabajo desde casa", "Ingresos pasivos"
  ],
  "comportamientos": [
    "Compradores en línea frecuentes",
    "Administradores de pequeñas empresas",
    "Usuarios de dispositivos móviles premium"
  ],
  "demografia": {
    "edad_min": 25,
    "edad_max": 45,
    "genero": "todos",
    "idioma": "es"
  },
  "ubicaciones": [
    "México", "Colombia", "Argentina",
    "Chile", "Perú", "España",
    "Estados Unidos" // latinos en USA
  ],
  "exclusiones": [
    "ya compraron el producto" // evita gastar en clientes
  ]
}

PARA GOOGLE ADS:
{
  "keywords_exactas": [
    "prompts de inteligencia artificial",
    "como ganar dinero con ia",
    "herramientas ia para negocios",
    "automatizar negocio con ia"
  ],
  "keywords_frase": [
    "prompts para emprendedores",
    "ia para ventas",
    "ganar dinero online con ia"
  ],
  "keywords_negativas": [
    "gratis", "free", "curso gratis",
    "tutorial youtube" // evita clicks sin intención de compra
  ],
  "audiencias_inmarket": [
    "Servicios de negocios",
    "Software empresarial",
    "Educación en línea"
  ]
}

TAMBIÉN CREA LOOKALIKE AUDIENCES:
Una vez que haya 100+ compradores en el píxel:
→ Meta crea automáticamente audiencia similar
→ El agente la activa con un nuevo conjunto de anuncios
→ Esto multiplica el alcance sin perder calidad
*/
```

---

### creative-generator.js — Genera los Anuncios con IA

```javascript
/*
MISIÓN: Crear imágenes y copies de anuncios
que conviertan, usando Claude para el texto
y generación de imágenes para el visual.

GENERA AUTOMÁTICAMENTE:

COPY DEL ANUNCIO (Claude lo escribe):

Formato 1 — Problema/Solución:
"¿Pasas horas intentando vender y no cierras?
 Estos 50 prompts de IA hacen el trabajo por ti.
 Vendedores los usan para cerrar 3x más.
 → Descárgalos por $17"

Formato 2 — Resultado específico:
"Con estos prompts de IA cerré mi primera venta
 en 2 horas. Sin experiencia. Sin ads.
 Solo los prompts correctos.
 $17 que cambian cómo vendes para siempre."

Formato 3 — Curiosidad:
"El prompt exacto que uso para responder
 objeciones de precio en WhatsApp.
 (Y 49 más por $17)"

GENERA 3 VARIACIONES DE COPY POR PRODUCTO
→ Meta hace A/B testing automático
→ El sistema identifica cuál convierte más

IMAGEN DEL ANUNCIO:
- Fondo oscuro con texto grande del beneficio principal
- Mockup del producto (PDF con portada)
- Precio visible: "$17"
- CTA: "Descargar ahora"

FORMATOS GENERADOS:
- 1080x1080 (feed cuadrado)
- 1080x1920 (stories/reels vertical)
- 1200x628 (Google Display)
- Texto para búsqueda de Google (sin imagen)
*/
```

---

### meta-ads.js — Integración Meta Marketing API

```javascript
/*
DEPENDENCIA: npm install facebook-nodejs-business-sdk

CAMPAÑA QUE CREA AUTOMÁTICAMENTE:

NIVEL 1 — CAMPAÑA:
{
  name: "NEXUS | [nombre_producto] | [fecha]",
  objective: "OUTCOME_SALES",  // optimiza para ventas
  status: "ACTIVE",
  special_ad_categories: [],
  daily_budget: 500,  // $5.00 en centavos
  bid_strategy: "LOWEST_COST_WITHOUT_CAP"
}

NIVEL 2 — CONJUNTO DE ANUNCIOS:
{
  name: "Audiencia Principal | [nicho]",
  campaign_id: campaign.id,
  daily_budget: 500,
  billing_event: "IMPRESSIONS",
  optimization_goal: "OFFSITE_CONVERSIONS",
  pixel_id: META_PIXEL_ID,
  custom_event_type: "PURCHASE",

  targeting: {
    // viene de audience-builder.js
    age_min: 25,
    age_max: 45,
    genders: [1, 2],
    locales: [236],  // español
    geo_locations: {
      countries: ["MX","CO","AR","CL","PE","ES","US"]
    },
    interests: [...],
    behaviors: [...]
  },

  // Landing page con parámetros de tracking
  destination_type: "WEBSITE"
}

NIVEL 3 — ANUNCIOS (3 variaciones A/B):
Para cada variación de copy:
{
  name: "Variación A | [nombre_producto]",
  adset_id: adset.id,
  creative: {
    title: "[headline del producto]",
    body: "[copy variación A]",
    image_url: "[url imagen generada]",
    link: "[landing_url]?utm_source=meta&utm_campaign=[id]",
    call_to_action: {
      type: "DOWNLOAD",
      value: { link: landing_url }
    }
  }
}

TRACKING COMPLETO:
Cada URL lleva parámetros UTM:
?utm_source=meta
&utm_medium=paid
&utm_campaign=[campaign_id]
&utm_content=[ad_id]
&utm_term=[nicho]

Así el sistema sabe exactamente qué anuncio
generó cada venta.
*/
```

---

### google-ads.js — Integración Google Ads API

```javascript
/*
DEPENDENCIA: npm install google-ads-api

DOS TIPOS DE CAMPAÑA EN GOOGLE:

TIPO 1 — BÚSQUEDA (Search):
La gente busca "prompts de ia para ventas"
→ aparece tu anuncio arriba
→ click → landing page → compra

Ideal para: personas con INTENCIÓN de compra
Costo: más caro por click pero mejor conversión

{
  name: "NEXUS | Search | [producto]",
  campaign_budget: {
    amount_micros: 5000000,  // $5/día
    delivery_method: "STANDARD"
  },
  advertising_channel_type: "SEARCH",
  bidding_strategy_type: "MAXIMIZE_CONVERSIONS",
  network_settings: {
    target_google_search: true,
    target_search_network: false,  // solo Google, no partners
    target_content_network: false
  }
}

GRUPOS DE ANUNCIOS + KEYWORDS:
{
  name: "Prompts IA | Exacta",
  keywords: [
    { text: "prompts de inteligencia artificial", match_type: "EXACT" },
    { text: "prompts para vender más", match_type: "EXACT" },
    { text: "como usar ia para negocios", match_type: "PHRASE" }
  ]
}

ANUNCIO DE BÚSQUEDA (Responsive):
{
  headlines: [
    "50 Prompts de IA Para Vender",
    "Cierra Más Ventas Con IA",
    "Prompts Que Generan Resultados",
    "Solo $17 — Descarga Inmediata",
    "IA Para Emprendedores Latinos"
  ],
  descriptions: [
    "Los prompts exactos para cerrar ventas en WhatsApp. Descarga inmediata por $17.",
    "50 prompts de IA probados. Funciona para cualquier producto o servicio."
  ],
  final_urls: ["[landing_url]?utm_source=google&utm_medium=search"]
}

TIPO 2 — DISPLAY (Visual):
Aparece en sitios web relacionados con el nicho
Más barato, más alcance, menos intención de compra
Ideal para: remarketing a quien ya visitó la landing

REMARKETING AUTOMÁTICO:
{
  name: "NEXUS | Remarketing | [producto]",
  // Audiencia: visitaron la landing pero NO compraron
  user_lists: ["visitors_no_purchase_7days"],
  // Anuncio: "¿Lo pensaste? Hoy $17, mañana puede subir"
}
*/
```

---

### campaign-validator.js — El Juez de las Campañas

```javascript
/*
MISIÓN: Monitorear métricas reales y tomar decisiones
automáticamente sobre cada campaña activa.

CORRE: Cada 6 horas para cada campaña activa

MÉTRICAS QUE CONSULTA EN TIEMPO REAL:

DE META ADS API:
- spend: cuánto se gastó
- impressions: cuántas personas lo vieron
- clicks: cuántos hicieron click
- purchases: cuántos compraron (via píxel)
- purchase_roas: retorno sobre inversión en ads
- ctr: click through rate
- cpc: costo por click
- cpp: costo por compra

DE GOOGLE ADS API:
- cost_micros: gasto total
- clicks: clicks totales
- impressions: impresiones
- conversions: conversiones (compras)
- conversion_value: valor total de conversiones
- search_impression_share: % de búsquedas donde apareces

CALCULA:
ROAS = revenue generado / gasto en ads
CPA  = gasto total / número de compras
CTR  = clicks / impresiones × 100

DECISIONES AUTOMÁTICAS A LAS 72H:

🚀 ESCALA si:
   ROAS > 1.5 (ganas $1.50 por cada $1 invertido)
   → Duplica presupuesto diario
   → Alerta Telegram con celebración

⏸️ PAUSA Y PRUEBA si:
   ROAS entre 0.5 y 1.5 (borderline)
   → Pausa audiencia actual
   → Prueba nueva audiencia de audience-builder
   → Da otras 48h de oportunidad

💀 MATA si:
   ROAS < 0.5 después de 72h
   O gasto > $15 sin ninguna venta
   → Pausa campaña completa
   → Guarda aprendizaje en system_memory
   → Alerta Telegram con análisis

🔄 REPLICA si:
   ROAS > 3.0 (campaña estrella)
   → Lanza misma campaña en nuevo país
   → Lanza lookalike audience
   → Aumenta presupuesto 3x

ALERTAS TELEGRAM ESPECÍFICAS:

Cada 6h si hay actividad:
"📊 UPDATE CAMPAÑA
 Producto: [nombre]
 Plataforma: Meta / Google
 Gastado: $[X]
 Ventas: [X] ($[revenue])
 ROAS: [X]x
 CPA: $[X]
 → Estado: escalando / pausando / matando"

Inmediato si hay venta:
"💰 VENTA VÍA ADS
 $[monto] — [producto]
 Fuente: Meta Ad / Google Search
 CPA de esta venta: $[X]
 ROAS acumulado: [X]x"
```

---

### budget-controller.js — El CFO de los Ads

```javascript
/*
MISIÓN: Controlar que nunca se gaste más de lo permitido
y que el dinero se reinvierta inteligentemente.

REGLAS SAGRADAS:
- Máximo $20/día total en ads sin permiso del dueño
- Máximo $5/día por producto nuevo sin validar
- Si ROAS > 1.5 → puede escalar hasta $50/día
- Si ROAS > 3.0 → puede escalar hasta $100/día
- Siempre pedir permiso para escalar > $100/día

DISTRIBUCIÓN DEL PRESUPUESTO DE ADS:
Del total disponible para ads:
50% → Meta Ads (mayor alcance en Latino)
30% → Google Ads Search (mayor intención de compra)
20% → Google Remarketing (recuperar visitantes)

AUTO-FINANCIAMIENTO:
Cuando una campaña genera ventas:
40% del revenue de esa campaña → reinvierte en más ads
60% → ganancia neta del dueño

Ejemplo:
Campaña gasta $5 → genera $25 en ventas
$10 (40%) → se reinvierte automáticamente mañana
$15 (60%) → ganancia neta

El sistema se financia y escala solo.

ALERTAS DE PRESUPUESTO:
"⚠️ ALERTA PRESUPUESTO
 Gastado hoy: $18 de $20 límite
 ¿Aumentas el límite diario?
 Responde: SI [monto] para aumentar"

"🎯 AUTO-REINVERSIÓN
 Campaña [nombre] generó $[X] hoy
 Reinvirtiendo $[Y] (40%) mañana
 Ganancia neta: $[Z]"
*/
```

---

## 🛒 HOTMART — Canal Adicional de Ventas

```javascript
/*
MISIÓN: Publicar los productos ganadores en Hotmart
para capturar tráfico orgánico de la plataforma.

¿POR QUÉ HOTMART?
- La plataforma más grande de productos digitales en Español
- Tiene su propio marketplace con tráfico propio
- Afiliados de Hotmart pueden promover tu producto
  sin que pagues nada hasta que vendan
- Pagos en moneda local de cada país

CUÁNDO ACTIVAR HOTMART:
- Producto con ROAS > 2.0 en Meta/Google
- Al menos 10 ventas orgánicas previas
- Producto validado como ganador

PROCESO AUTOMÁTICO:
1. hotmart-publisher.js recibe producto ganador
2. Crea el producto en Hotmart vía API:
   - Título, descripción, precio
   - Archivo del producto (PDF)
   - Página de ventas (usa tu landing existente)
   - Comisión para afiliados: 40-50%
3. Activa el programa de afiliados
4. Afiliados de Hotmart empiezan a promoverlo
5. Tú recibes ventas sin gastar en ads

INGRESOS ADICIONALES ESTIMADOS:
Con 5-10 afiliados activos: $200-800/mes extra
Sin gastar un centavo adicional en publicidad
*/
```

---

## 🗄️ TABLAS DE BASE DE DATOS — AGREGAR A SUPABASE

```sql
-- Campañas de publicidad
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES experiments(id),
  plataforma TEXT CHECK (plataforma IN ('meta','google','hotmart')),
  campaign_id_externo TEXT,      -- ID en Meta o Google
  adset_id TEXT,                 -- ID del conjunto de anuncios
  nombre TEXT,
  estado TEXT DEFAULT 'activo' CHECK (
    estado IN ('activo','pausado','escalando','muerto')
  ),

  -- Presupuesto
  presupuesto_diario DECIMAL(10,2),
  gasto_total DECIMAL(10,2) DEFAULT 0,

  -- Métricas clave
  impresiones INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversiones INTEGER DEFAULT 0,
  revenue_generado DECIMAL(10,2) DEFAULT 0,

  -- KPIs calculados
  ctr DECIMAL(5,2),             -- Click Through Rate %
  cpa DECIMAL(10,2),            -- Costo Por Adquisición
  roas DECIMAL(5,2),            -- Return On Ad Spend

  -- Decisión del sistema
  decision TEXT,                 -- 'escalar','pausar','matar','replica'
  razon_decision TEXT,
  aprendizaje TEXT,

  fecha_inicio TIMESTAMP DEFAULT NOW(),
  fecha_decision TIMESTAMP,
  fecha_ultimo_update TIMESTAMP DEFAULT NOW()
);

-- Creativos de anuncios
CREATE TABLE ad_creatives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  tipo TEXT CHECK (tipo IN ('imagen','video','texto')),
  headline TEXT,
  copy_principal TEXT,
  imagen_url TEXT,
  formato TEXT,                  -- '1080x1080','1080x1920','1200x628'
  variacion TEXT,                -- 'A','B','C'
  metricas JSONB DEFAULT '{"clicks":0,"conversiones":0,"ctr":0}',
  es_ganador BOOLEAN DEFAULT FALSE,
  fecha TIMESTAMP DEFAULT NOW()
);

-- Log de decisiones de ads
CREATE TABLE ads_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  decision TEXT,
  metricas_al_decidir JSONB,
  presupuesto_antes DECIMAL(10,2),
  presupuesto_despues DECIMAL(10,2),
  aprobado_por TEXT DEFAULT 'sistema',  -- 'sistema' o 'dueño'
  fecha TIMESTAMP DEFAULT NOW()
);
```

---

## 📱 ALERTAS TELEGRAM ESPECÍFICAS DE ADS

```
CUANDO LANZA CAMPAÑA:
"📢 CAMPAÑA LANZADA
 Producto: [nombre]
 Meta: $5/día → activo ✅
 Google: $5/día → activo ✅
 Audiencia: [descripción]
 Decisión en 72h"

CADA 6H (si hay actividad significativa):
"📊 UPDATE [nombre]
 Gastado: $[X] | Ventas: $[X]
 ROAS: [X]x | CPA: $[X]
 CTR: [X]%"

CUANDO ESCALA AUTOMÁTICO:
"🚀 ESCALANDO CAMPAÑA
 Producto: [nombre]
 ROAS actual: [X]x
 Presupuesto: $5 → $10/día
 Proyección: $[X]/día en ventas"

CUANDO MATA CAMPAÑA:
"💀 CAMPAÑA PAUSADA
 Producto: [nombre]
 Gastado: $[X] | Revenue: $[X]
 ROAS: [X]x — por debajo del mínimo
 Aprendizaje: [qué falló]"

CUANDO NECESITA PERMISO:
"⚠️ APROBACIÓN REQUERIDA
 Campaña [nombre] tiene ROAS [X]x
 Quiero escalar a $[X]/día
 Inversión adicional: $[X]/mes
 Revenue proyectado: $[X]/mes
 ¿Apruebas? SI / NO"

REPORTE DIARIO DE ADS (9am):
"📊 REPORTE ADS HOY
 Gasto total: $[X]
 Revenue generado: $[X]
 ROAS promedio: [X]x
 Ganancia neta ads: $[X]
 Mejor campaña: [nombre] ([X]x ROAS)
 Campañas activas: [X]
 Reinversión mañana: $[X]"
```

---

## 🚀 PROMPT PARA CLAUDE CODE

```
Tienes acceso a la carpeta del proyecto NEXUS AGENT.
El sistema ya está corriendo con productos digitales,
landing pages y Stripe funcionando.

Agrega el módulo de ADS MANAGER completo
descrito en este documento.

ORDEN DE CONSTRUCCIÓN:
1. Instala dependencias:
   npm install facebook-nodejs-business-sdk google-ads-api

2. Agrega las variables al .env existente
   (ver sección de variables de este documento)

3. Crea agents/ads/ con todos los archivos

4. Crea agents/advanced/ads-manager.js

5. Agrega ads-treasury.js a core/

6. Ejecuta el SQL de las nuevas tablas en Supabase

7. Conecta ads-manager.js al flujo existente:
   - Cuando generator.js termine un producto → llama ads-manager
   - Cuando validator.js marque "vivo" → activa scaling
   - Cuando replicator.js clone → lanza nueva campaña

8. Agrega los nuevos cron jobs al index.js existente:
   - Cada 6h: campaign-validator.js
   - Cada 24h: budget-controller reporte
   - 9am: incluir ads en el reporte diario de Telegram

9. NO romper nada del sistema existente
   Solo agregar, nunca modificar lo que ya funciona

AL TERMINAR:
- Muestra el estado de conexión con Meta API
- Muestra el estado de conexión con Google Ads API
- Crea una campaña de PRUEBA (status: PAUSED)
  para verificar que la conexión funciona
- Avisa por Telegram que el módulo está activo
```

---

## 📋 CÓMO OBTENER LAS CREDENCIALES

### Meta Ads API
```
1. business.facebook.com → crear cuenta Business
2. developers.facebook.com → crear App tipo "Business"
3. Agregar producto "Marketing API"
4. Generar Access Token de larga duración
5. business.facebook.com/adsmanager → copiar Ad Account ID
6. Crear Píxel en Events Manager → copiar Pixel ID
```

### Google Ads API
```
1. ads.google.com → crear cuenta
2. console.cloud.google.com → crear proyecto
3. Habilitar "Google Ads API"
4. Crear credenciales OAuth2
5. ads.google.com/aw/apicenter → solicitar Developer Token
6. Correr script OAuth para obtener refresh_token
```

### Hotmart
```
1. app.hotmart.com → crear cuenta como Productor
2. Developers → crear App
3. Copiar Client ID, Client Secret, Basic Token
```

---

## 💰 PROYECCIÓN CON ADS ACTIVOS

```
SIN ADS (orgánico solo):
Mes 1-2: $0-300/mes
Mes 3-4: $300-800/mes

CON ADS AUTOMATIZADOS:
Mes 1:   $200-500  (aprendiendo qué convierte)
Mes 2:   $500-1,500 (primeras campañas escalando)
Mes 3:   $1,500-4,000 (ROAS optimizado, escala sola)
Mes 4-6: $4,000-10,000 (múltiples productos con ads)

INVERSIÓN EN ADS: $20/día = $600/mes
ROAS TARGET: 2.5x
REVENUE PROYECTADO: $1,500/mes desde los ads
GANANCIA NETA (60%): $900/mes solo de ads
```

---

*NEXUS AGENT — Módulo Ads Manager*
*Integra Meta Ads + Google Ads + Hotmart*
*Sistema supervisado por Telegram*
*Marzo 2026*
