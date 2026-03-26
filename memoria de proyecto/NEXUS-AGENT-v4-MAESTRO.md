# ⚡ NEXUS AGENT v4.0 — DOCUMENTO MAESTRO DEFINITIVO
# Fusión completa de todas las versiones anteriores
# Para entregar a cualquier asistente de IA constructor
# Marzo 2026

---

## 🗺️ PROGRESO DEL BUILD — LEER PRIMERO

> **ÚLTIMA ACTUALIZACIÓN:** 2026-03-25
> **ASISTENTE ANTERIOR:** Claude Sonnet 4.6
> **DIRECTORIO:** `C:\dev\agentes de hacer dinero`

---

## 📋 VARIABLES DE ENTORNO YA CONFIGURADAS EN `.env`
```
SUPABASE_URL=https://wofcqjinevhvplhidnyo.supabase.co
SUPABASE_ANON_KEY=✅ configurada
SUPABASE_SERVICE_KEY=✅ configurada
ANTHROPIC_API_KEY=✅ configurada
TELEGRAM_BOT_TOKEN=✅ bot NUEVO creado (bot anterior causaba conflicto 409)
TELEGRAM_CHAT_ID=5616781697 (chat personal del dueño)
STRIPE_SECRET_KEY=✅ configurada (balance $38.22 detectado)
STRIPE_PUBLISHABLE_KEY=✅ configurada
VERCEL_TOKEN=✅ configurada
VERCEL_TEAM_ID=✅ configurada (cuenta personal, no team)
RESEND_API_KEY=✅ configurada
```
**Pendiente agregar:** RAILWAY_TOKEN, MY_DOMAIN

---

## ✅ TODO LO COMPLETADO Y PROBADO

### INFRAESTRUCTURA
- [x] Supabase — 9 tablas creadas y funcionando
- [x] `package.json` — todas las dependencias instaladas (rss-parser, cheerio incluidos)

### MÓDULOS CORE (todos en `core/`)
- [x] `database.js` — Cliente Supabase + helpers para todas las tablas ✅ PROBADO
- [x] `claude.js` — Wrapper Anthropic API + control de costos diarios ✅ PROBADO
- [x] `telegram.js` — Envío HTML + recepción de respuestas via getUpdates ✅ PROBADO BIDIRECCIONAL
- [x] `memory.js` — Memoria acumulativa (ganadores, patrones, blacklist, insights) ✅
- [x] `brain.js` — Decisiones con IA: evalúa nichos, califica leads, decide suerte de experimentos ✅
- [x] `stripe.js` — Crea productos + precios + payment links automáticamente ✅ PROBADO
- [x] `deploy.js` — Publica HTML en Vercel (fix: cuentas personales no usan teamId) ✅ PROBADO
- [x] `email.js` — Entrega producto por email con Resend + detecta pagos nuevos en Stripe ✅ PROBADO

### MOTOR 1 — PRODUCTOS DIGITALES (agentes en `agents/digital/`)
- [x] `researcher.js` — Claude busca nicho rentable para mercado hispano (score 94/100 en prueba)
- [x] `generator.js` — Claude crea el producto completo (guía, prompts, plantilla)
- [x] `publisher.js` — Crea producto en Stripe + genera HTML + sube a Vercel + notifica por Telegram

**PRODUCTO PUBLICADO EN VIVO:**
- Landing: `https://nexus-inmigrakit-tu-toolkit-de-inmigraci-n-bptociykc.vercel.app`
- Stripe: `https://buy.stripe.com/cNi9AVdik8eXfaJ59N0Fi05`
- Producto: "InmigraKit" — $47 — nicho inmigración en USA

### MOTOR 2 — LEADS (agentes en `agents/leadgen/`)
- [x] `lead-hunter.js` — Busca en Craigslist Miami RSS (403 bloqueado) + web scraping
- [x] `lead-qualifier.js` — Califica con brain.js (score 9/10 en prueba manual)
- [x] `lead-delivery.js` — Formatea y entrega lead por Telegram con HTML

**NOTA IMPORTANTE:** Craigslist bloquea con 403. El hunter funciona con leads manuales
(usuario pega texto de Facebook/WhatsApp y el sistema califica). Para producción real
usar la landing page del dueño que ya tiene + publicarla en Craigslist como anunciante.

---

## ✅ `index.js` ORQUESTADOR — COMPLETADO

El `index.js` está escrito y listo. Corre TODO automáticamente 24/7 con `node-cron`:

```
Cada 24h:  researcher → generator → publisher (lanza nuevo experimento)
Cada 1h:   email.procesarPagosNuevos() (detecta ventas y entrega productos)
Cada 72h:  validator (decide suerte de experimentos por métricas)
Cada día:  brain.generarResumenDiario() → Telegram
```

Comandos Telegram que debe escuchar el index.js:
- `LANZAR` → lanza nuevo experimento ahora
- `PUBLICAR` → aprueba landing pendiente
- `CANCELAR` → cancela publicación pendiente
- `ESTADO` → muestra resumen del sistema
- `REPORTE` → reporte financiero ahora

---

## ⏳ PENDIENTE DESPUÉS DEL INDEX.JS
- [ ] `agents/digital/validator.js` — decide escalar o matar a las 72h
- [ ] `agents/digital/replicator.js` — replica experimentos ganadores x3
- [ ] `core/treasury.js` — control financiero automático
- [ ] `agents/advanced/` — agentes avanzados (trend-hunter, competitor-spy, etc.)
- [ ] Deploy en Railway para correr 24/7 en la nube
- [ ] Dashboard Next.js

### 🎯 ESTRATEGIA ACTUAL
Motor 1 (Productos Digitales) es el foco principal — ya tiene pipeline completo.
Motor 2 (Leads) funciona semi-manual — el dueño pega posts, el sistema califica y entrega.

---

> **VISIÓN:** Un organismo digital autónomo con DOS motores de ingresos
> que se retroalimentan, aprenden solos, se expanden progresivamente
> y crecen como interés compuesto.
> No es un bot. Es una empresa de IA que trabaja 24/7.
> El fundador supervisa desde Telegram.

---

## 🧠 FILOSOFÍA DEL SISTEMA

```
PROPIEDAD 1 — DARWINISMO DIGITAL
Los experimentos que no generan dinero mueren rápido.
Los que sí generan, se replican y evolucionan.
El sistema se vuelve más inteligente con cada ciclo.

PROPIEDAD 2 — INTERÉS COMPUESTO
Cada dólar ganado genera más agentes.
Cada agente genera más dólares.
El crecimiento se acelera exponencialmente con el tiempo.
Ciclo 1: 1 experimento
Ciclo 3: 9 experimentos
Ciclo 6: 27 experimentos corriendo en paralelo

PROPIEDAD 3 — AUTONOMÍA CON SUPERVISIÓN HUMANA
El sistema trabaja solo el 95% del tiempo.
El 5% restante consulta al humano por Telegram.
Nunca toma decisiones irreversibles sin permiso.
Siempre espera respuesta antes de gastar dinero.

PROPIEDAD 4 — MEMORIA COLECTIVA E INTELIGENCIA ACUMULATIVA
Cada experimento muerto enseña al sistema.
La base de datos de aprendizaje crece infinitamente.
El agente del mes 6 es 10x más inteligente que el del mes 1.
Lo que falló nunca se repite. Lo que funcionó se replica.

PROPIEDAD 5 — SUPERFICIE DE ATAQUE MÚLTIPLE
DOS motores de ingresos independientes y complementarios.
Si un canal muere, los otros siguen generando.
Ataca: productos digitales + leads + afiliados + SEO + funnels.

PROPIEDAD 6 — EXPANSIÓN PROGRESIVA CONTROLADA
Nunca corre antes de caminar.
Cada nueva vertical se activa solo cuando la anterior
genera ingresos estables y consistentes.
El sistema crece con sus propias ganancias.
```

---

## 👤 PERFIL DEL FUNDADOR — LEER PRIMERO

```
Nombre del proyecto: NEXUS AGENT
Experiencia real:    Ventas + negocios + emprendimiento
Imaginación:         Muy alta — genera ideas constantemente
Habilidad técnica:   Básica-media, aprende rápido con guía
Contactos reales:    Vendedores y managers en varios dealers ✅ CLAVE
Setup actual:
  GitHub         ✅ activo, sabe usarlo
  Stripe         ✅ configurado con dominio propio
  Dominio        ✅ propio
  Telegram Bot   ✅ ya tiene bot y canal en otros proyectos
Dedicación:      5 horas/día
Presupuesto:     $200/mes máximo
Meta ingresos:   $5,000/mes en 6-9 meses
Idioma mercado:  Español (mercado latino) principal
Supervisión:     Exclusivamente via Telegram desde teléfono
Primer cliente:  Ya tiene contactos en dealers → cerrar esta semana
```

---

## 🏗️ ARQUITECTURA COMPLETA DEL SISTEMA

```
nexus-agent/
│
├── 📋 CONFIG
│   ├── .env                           ← todas las variables
│   ├── .env.example                   ← template para onboarding
│   ├── package.json
│   └── config/
│       ├── system-state.json          ← estado actual del sistema
│       ├── niches-winners.json        ← nichos ganadores históricos
│       ├── niches-blacklist.json      ← nichos que ya fallaron
│       └── verticals-config.json     ← configuración por industria
│
├── 🤖 MOTOR 1 — Productos Digitales
│   └── agents/digital/
│       ├── researcher.js              ← descubre nichos rentables
│       ├── generator.js               ← crea productos con IA
│       ├── publisher.js               ← publica en internet + Vercel
│       ├── validator.js               ← mide y decide a las 72h
│       └── replicator.js              ← clona ganadores × 3
│
├── 🎯 MOTOR 2 — Agencia de Leads
│   ├── agents/leadgen/
│   │   ├── lead-hunter.js             ← busca compradores en internet
│   │   ├── lead-qualifier.js          ← califica con IA (score 1-10)
│   │   ├── lead-nurture.js            ← calienta leads fríos
│   │   ├── lead-delivery.js           ← entrega al cliente por WhatsApp
│   │   └── lead-replicator.js         ← replica hacia nuevas industrias
│   │
│   └── verticals/                     ← una carpeta por industria
│       ├── automotive/                ← EMPIEZA AQUÍ (dealers reales)
│       │   ├── hunter.js
│       │   ├── qualifier.js
│       │   └── config.json
│       ├── real-estate/               ← SE ACTIVA: mes 2-3
│       │   ├── hunter.js
│       │   ├── qualifier.js
│       │   └── config.json
│       ├── medical/                   ← SE ACTIVA: mes 3-4
│       │   ├── hunter.js
│       │   ├── qualifier.js
│       │   └── config.json
│       ├── hospitality/               ← SE ACTIVA: mes 4-5
│       │   ├── hunter.js
│       │   ├── qualifier.js
│       │   └── config.json
│       ├── legal/                     ← SE ACTIVA: mes 5-6
│       │   ├── hunter.js
│       │   ├── qualifier.js
│       │   └── config.json
│       ├── restaurant/                ← SE ACTIVA: mes 6+
│       │   ├── hunter.js
│       │   ├── qualifier.js
│       │   └── config.json
│       └── _template/                 ← plantilla universal
│           ├── hunter.js              ← el sistema copia esto
│           ├── qualifier.js              para cualquier industria nueva
│           └── config.json
│
├── 🚀 AGENTES AVANZADOS
│   └── agents/advanced/
│       ├── trend-hunter.js            ← detecta tendencias ANTES que todos
│       ├── competitor-spy.js          ← espía competencia y encuentra gaps
│       ├── price-optimizer.js         ← A/B testing de precios automático
│       ├── funnel-builder.js          ← construye funnels de venta completos
│       ├── upsell-engine.js           ← vende más a clientes existentes
│       ├── affiliate-hunter.js        ← encuentra programas de afiliados
│       ├── content-army.js            ← genera contenido SEO masivo diario
│       ├── prospector.js              ← busca clientes para Motor 2
│       ├── partnership-agent.js       ← busca colaboraciones automático
│       └── empire-builder.js          ← construye el siguiente nivel
│
├── ⚙️ MÓDULOS CORE
│   └── core/
│       ├── claude.js                  ← Anthropic API wrapper
│       ├── stripe.js                  ← pagos + webhooks + suscripciones
│       ├── database.js                ← Supabase client
│       ├── email.js                   ← Resend para emails automáticos
│       ├── deploy.js                  ← Vercel API deploy automático
│       ├── telegram.js                ← alertas + comandos del dueño
│       ├── whatsapp.js                ← entrega de leads a clientes
│       ├── crm.js                     ← gestión de leads y clientes B2B
│       ├── memory.js                  ← memoria persistente del sistema
│       ├── brain.js                   ← toma de decisiones con IA
│       ├── treasury.js                ← gestión financiera automática
│       └── vertical-spawner.js        ← crea nuevas verticales automático
│
├── 📊 DASHBOARD
│   └── dashboard/                     ← Next.js panel de control completo
│
├── 🌐 PRODUCTOS GENERADOS
│   ├── products/                      ← PDFs, ebooks, herramientas
│   └── landings/                      ← HTML landing pages generadas
│
└── 🎯 ORQUESTADOR
    └── index.js                       ← cerebro principal 24/7
```

---

## 🔧 VARIABLES DE ENTORNO COMPLETAS

```env
# ════════════════════════════════════
# INTELIGENCIA ARTIFICIAL
# ════════════════════════════════════
ANTHROPIC_API_KEY=              # Claude — cerebro del sistema
                                # console.anthropic.com

# ════════════════════════════════════
# PAGOS Y FINANZAS
# ════════════════════════════════════
STRIPE_SECRET_KEY=              # ya tiene ✅
STRIPE_WEBHOOK_SECRET=          # para validar pagos entrantes
STRIPE_PUBLISHABLE_KEY=         # para frontend del dashboard

# ════════════════════════════════════
# BASE DE DATOS
# ════════════════════════════════════
SUPABASE_URL=                   # supabase.com — tier gratis
SUPABASE_ANON_KEY=              # para operaciones normales
SUPABASE_SERVICE_KEY=           # para operaciones admin

# ════════════════════════════════════
# DEPLOY E INFRAESTRUCTURA
# ════════════════════════════════════
VERCEL_TOKEN=                   # vercel.com — tier gratis
MY_DOMAIN=                      # dominio propio ✅
RAILWAY_TOKEN=                  # railway.app — hosting 24/7

# ════════════════════════════════════
# COMUNICACIÓN
# ════════════════════════════════════
RESEND_API_KEY=                 # resend.com — emails gratis
TELEGRAM_BOT_TOKEN=             # bot existente del dueño ✅
TELEGRAM_CHAT_ID=               # chat ID del dueño ✅

# ════════════════════════════════════
# WHATSAPP (entrega de leads)
# ════════════════════════════════════
WHATSAPP_API_TOKEN=             # Twilio o Meta Business API
WHATSAPP_PHONE_ID=              # número de WhatsApp Business

# ════════════════════════════════════
# REDES SOCIALES (prospección)
# ════════════════════════════════════
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=

# ════════════════════════════════════
# PLATAFORMAS DE VENTA ADICIONALES
# ════════════════════════════════════
GUMROAD_API_KEY=                # marketplace adicional de productos
LEMONSQUEEZY_API_KEY=           # alternativa a Stripe

# ════════════════════════════════════
# ANALYTICS
# ════════════════════════════════════
UMAMI_WEBSITE_ID=               # analytics propio sin cookies
UMAMI_URL=

# ════════════════════════════════════
# CONFIGURACIÓN DEL SISTEMA
# ════════════════════════════════════
MAX_PARALLEL_EXPERIMENTS=5      # máx experimentos digitales simultáneos
MAX_PARALLEL_VERTICALS=3        # máx industrias de leads activas
MIN_REVENUE_TO_REPLICATE=1      # $1 mínimo para replicar
MIN_REVENUE_TO_EXPAND=2000      # $2K/mes para activar nueva vertical
MAX_DAILY_API_SPEND=5           # máx $5/día en Claude API sin permiso
APPROVAL_TIMEOUT_HOURS=4        # espera 4h respuesta del dueño
STARTING_VERTICAL=automotive    # siempre empieza aquí
NODE_ENV=production
```

---

## 🗄️ BASE DE DATOS COMPLETA (Supabase)

```sql
-- ════════════════════════════════════
-- MOTOR 1: PRODUCTOS DIGITALES
-- ════════════════════════════════════

CREATE TABLE experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nicho TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN (
    'ebook','prompts','plantilla','saas',
    'afiliado','curso','newsletter'
  )),
  nombre TEXT,
  descripcion TEXT,
  url TEXT,
  stripe_product_id TEXT,
  stripe_payment_link TEXT,
  gumroad_url TEXT,
  precio DECIMAL(10,2),
  metricas JSONB DEFAULT '{
    "clicks": 0,
    "signups": 0,
    "ventas": 0,
    "revenue": 0,
    "emails_enviados": 0,
    "respuestas_prospeccion": 0,
    "conversion_rate": 0
  }',
  estado TEXT DEFAULT 'corriendo' CHECK (
    estado IN ('corriendo','vivo','muerto','escalando','pausado')
  ),
  generacion INTEGER DEFAULT 1,
  parent_id UUID REFERENCES experiments(id),
  aprendizaje TEXT,
  fecha_inicio TIMESTAMP DEFAULT NOW(),
  fecha_decision TIMESTAMP,
  fecha_ultimo_update TIMESTAMP DEFAULT NOW()
);

-- Compradores de productos digitales
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  nombre TEXT,
  experiment_id UUID REFERENCES experiments(id),
  producto TEXT,
  revenue DECIMAL(10,2),
  stripe_customer_id TEXT,
  compras_totales INTEGER DEFAULT 1,
  revenue_total DECIMAL(10,2),
  fuente TEXT, -- 'organico','reddit','twitter','email','seo'
  fecha TIMESTAMP DEFAULT NOW()
);

-- Leads del embudo digital (antes de comprar)
CREATE TABLE digital_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  experiment_id UUID REFERENCES experiments(id),
  fuente TEXT,
  estado TEXT DEFAULT 'nuevo' CHECK (
    estado IN ('nuevo','contactado','interesado','compro','perdido')
  ),
  emails_recibidos INTEGER DEFAULT 0,
  ultimo_contacto TIMESTAMP,
  fecha TIMESTAMP DEFAULT NOW()
);

-- Árbol de réplicas
CREATE TABLE replicas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES experiments(id),
  child_ids UUID[],
  generacion INTEGER DEFAULT 1,
  revenue_total_arbol DECIMAL(10,2) DEFAULT 0,
  fecha TIMESTAMP DEFAULT NOW()
);

-- ════════════════════════════════════
-- MOTOR 2: AGENCIA DE LEADS
-- ════════════════════════════════════

-- Negocios que pagan por leads (dealers, clínicas, etc.)
CREATE TABLE business_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  industria TEXT CHECK (industria IN (
    'automotive','real_estate','medical',
    'hospitality','legal','restaurant','other'
  )),
  contacto_nombre TEXT,
  contacto_whatsapp TEXT NOT NULL,
  contacto_email TEXT,
  precio_por_lead DECIMAL(10,2),
  modelo_pago TEXT CHECK (modelo_pago IN (
    'por_lead','retainer_mensual','hibrido'
  )),
  retainer_mensual DECIMAL(10,2),
  leads_entregados INTEGER DEFAULT 0,
  leads_cerrados INTEGER DEFAULT 0,
  tasa_cierre DECIMAL(5,2),
  revenue_generado DECIMAL(10,2) DEFAULT 0,
  estado TEXT DEFAULT 'activo' CHECK (
    estado IN ('prospecto','activo','pausado','cancelado')
  ),
  stripe_customer_id TEXT,
  notas TEXT,
  fecha_inicio TIMESTAMP DEFAULT NOW()
);

-- Compradores potenciales que buscan algo (casas, carros, etc.)
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT,
  telefono TEXT,
  email TEXT,
  industria TEXT,
  business_client_id UUID REFERENCES business_clients(id),

  -- Lo que busca
  descripcion_necesidad TEXT,
  presupuesto_min DECIMAL(10,2),
  presupuesto_max DECIMAL(10,2),
  urgencia TEXT CHECK (
    urgencia IN ('inmediata','este_mes','3_meses','explorando')
  ),
  ubicacion TEXT,
  detalles_extras JSONB, -- info específica por industria

  -- Calificación por IA
  score INTEGER CHECK (score BETWEEN 1 AND 10),
  razon_score TEXT,
  es_calificado BOOLEAN DEFAULT FALSE,

  -- Trazabilidad
  fuente TEXT,
  fuente_url TEXT,
  mensaje_original TEXT,

  -- Estado del lead
  estado TEXT DEFAULT 'nuevo' CHECK (
    estado IN (
      'nuevo','calificando','calificado',
      'entregado','en_proceso','cerrado','perdido'
    )
  ),
  entregado_en TIMESTAMP,
  cerrado_en TIMESTAMP,
  motivo_perdida TEXT,

  fecha TIMESTAMP DEFAULT NOW()
);

-- Pagos por leads entregados
CREATE TABLE lead_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  business_client_id UUID REFERENCES business_clients(id),
  monto DECIMAL(10,2),
  tipo TEXT CHECK (tipo IN ('por_lead','retainer','bonus')),
  stripe_payment_id TEXT,
  fecha TIMESTAMP DEFAULT NOW()
);

-- ════════════════════════════════════
-- SISTEMA GENERAL
-- ════════════════════════════════════

-- Memoria acumulativa del sistema
CREATE TABLE system_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT, -- 'aprendizaje','patron','regla','insight'
  categoria TEXT, -- 'automotive','digital','general','seo'
  contenido TEXT,
  confianza DECIMAL(3,2), -- 0.0 a 1.0
  veces_validado INTEGER DEFAULT 1,
  activo BOOLEAN DEFAULT TRUE,
  fecha TIMESTAMP DEFAULT NOW()
);

-- Log de todas las acciones de los agentes
CREATE TABLE agent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agente TEXT NOT NULL,
  accion TEXT NOT NULL,
  detalle JSONB,
  exito BOOLEAN DEFAULT TRUE,
  duracion_ms INTEGER,
  costo_api DECIMAL(8,6),
  fecha TIMESTAMP DEFAULT NOW()
);

-- Gestión financiera del sistema
CREATE TABLE treasury (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  motor TEXT CHECK (motor IN ('digital','leadgen','sistema')),
  tipo TEXT CHECK (tipo IN ('ingreso','gasto','reinversion','reserva')),
  monto DECIMAL(10,2),
  descripcion TEXT,
  experiment_id UUID REFERENCES experiments(id),
  business_client_id UUID REFERENCES business_clients(id),
  fecha TIMESTAMP DEFAULT NOW()
);
```

---

## 🤖 MOTOR 1 — AGENTES DIGITALES EN DETALLE

### researcher.js — El Cazador de Nichos

```javascript
/*
MISIÓN: Encontrar el nicho más rentable disponible ahora mismo.
No adivina. Analiza datos reales antes de decidir.

PROCESO COMPLETO:
1. Consulta system_memory para saber qué ya funcionó/falló
2. Consulta niches-blacklist.json para evitar repetir errores
3. Usa Claude API con web_search habilitado para escanear:
   - Reddit: r/entrepreneur, r/sidehustle, r/digitalnomad,
             r/WorkOnline, r/passive_income
   - Twitter/X: trending en negocios y emprendimiento
   - Google Trends: picos de búsqueda últimas 24-48h
   - Product Hunt: nuevos lanzamientos digitales
   - Gumroad: top sellers esta semana por categoría
   - Etsy digital: productos más vendidos
4. Para cada nicho encontrado evalúa:
   - Demanda: ¿cuánta gente lo busca activamente?
   - Competencia: ¿qué tan saturado está el mercado?
   - Precio posible: ¿cuánto pagarían realmente?
   - Velocidad: ¿en cuánto tiempo se puede crear?
   - Fit con memoria: ¿el sistema aprendió algo de esto?
   - Alineación con mercado latino hispanohablante
5. Score compuesto 1-100 para cada nicho
6. Elige el top 1 y lo presenta al sistema con justificación

LÓGICA DE APROBACIÓN:
Score > 80 → lanza automáticamente
Score 60-80 → consulta al dueño por Telegram con opciones
Score < 60 → descarta y busca más opciones

TIPOS DE PRODUCTOS QUE PUEDE SUGERIR:
- PDF/Ebook ($7-47): más rápido de crear, buen volumen
- Pack de Prompts ($17-67): alta demanda en 2026
- Plantilla Notion/Excel ($9-37): evergreen, pasivo puro
- Mini Curso texto+audio ($47-197): mayor ticket
- Newsletter de Pago ($9-29/mes): ingreso recurrente fijo
- Mini SaaS con waitlist ($27-97): mayor potencial

ALERTA TELEGRAM:
"🔍 NICHO ENCONTRADO
Nicho: [nombre]
Score: [X]/100
Tipo sugerido: [tipo de producto]
Precio: $[X]
Razón: [por qué es bueno ahora]
Competencia: baja/media
Tiempo creación: [X] horas
→ Auto-aprobado (score > 80) / ¿Procedo? (score 60-80)"
*/
```

### generator.js — La Fábrica de Productos

```javascript
/*
MISIÓN: Crear productos digitales de alta calidad en horas.

PROCESO SEGÚN TIPO:

TIPO 1 — PDF/Ebook:
  - Claude genera índice y contenido completo
  - Puppeteer exporta PDF profesional con diseño
  - Portada con tipografía y colores del nicho
  - 30-50 páginas de valor real y accionable

TIPO 2 — Pack de Prompts:
  - 50-100 prompts organizados por categoría
  - Cada prompt tiene: texto, instrucciones, ejemplo de output
  - Formato PDF + template Notion incluido

TIPO 3 — Plantilla Notion/Excel:
  - Sistema funcional completo
  - Manual de uso detallado incluido
  - Personalizable por el comprador

TIPO 4 — Mini Curso (texto + audio):
  - 5-10 módulos generados con Claude
  - Audio generado con ElevenLabs API
  - Entregado secuencialmente por email

TIPO 5 — Newsletter de Pago:
  - Primera edición gratis como lead magnet
  - Stripe subscription automática configurada
  - Contenido generado semanalmente por Claude

EN TODOS LOS CASOS:
1. Genera el producto con Claude (modelo sonnet)
2. Crea producto en Stripe + Payment Link
3. Publica también en Gumroad (canal adicional)
4. Genera landing page HTML completa:
   - Headline que conecta con el dolor real
   - 5 bullets de beneficios concretos
   - Precio con contexto de urgencia
   - 3 testimonios realistas y creíbles
   - FAQ con 5 preguntas frecuentes
   - CTA con botón de Stripe Checkout
5. Guarda todo en Supabase
6. Alerta Telegram con link del producto
*/
```

### validator.js — El Juez de 72 Horas

```javascript
/*
MISIÓN: Determinar con datos reales si un experimento vive o muere.

CICLO: Corre cada 6 horas para cada experimento "corriendo"

MÉTRICAS QUE CONSULTA EN TIEMPO REAL:
- Ventas y revenue: Stripe API
- Signups de email: tabla digital_leads Supabase
- Clicks en landing: Umami Analytics API
- Engagement en redes: si hay posts activos

DECISIÓN A LAS 72 HORAS EXACTAS:

VIVE si cumple CUALQUIERA:
  ✅ Al menos 1 venta real ($1+)
  ✅ 5+ signups de email
  ✅ Tasa de conversión > 2%
  ✅ 100+ clicks orgánicos

ESCALA AUTOMÁTICAMENTE si:
  🚀 3+ ventas en 72h → aumenta presupuesto
  🚀 Revenue > $50 en 72h → replica inmediatamente
  🚀 Conversión > 5% → duplica tráfico

MUERE si no cumple ningún criterio en 72h:
  1. Claude genera "autopsia" del experimento:
     - ¿Por qué cree que falló? (headline, precio, nicho, timing)
     - ¿Qué aprendimos específicamente?
     - ¿Qué NO repetir?
  2. Guarda aprendizaje en system_memory con confianza 0.7
  3. Actualiza niches-blacklist si el nicho fue el problema
  4. Archiva la landing (nunca borra, siempre aprende)
  5. Lanza researcher.js automáticamente para el siguiente
  6. Alerta Telegram con autopsia completa

CUANDO VIVE:
  1. Alerta Telegram celebración con métricas
  2. Llama a replicator.js con los parámetros del ganador
  3. Activa upsell-engine para los compradores
  4. Activa content-army para SEO del nicho
  5. Actualiza system_memory con patrones de éxito
*/
```

### replicator.js — La Máquina de Clonación

```javascript
/*
MISIÓN: Multiplicar los ganadores como células.
Aquí es donde el interés compuesto se vuelve real.

CUANDO SE ACTIVA:
Experimento supera umbrales de éxito del validator.

GENERA 3 VARIACIONES SIMULTÁNEAS:

VARIACIÓN A — "Mismo producto, diferente ángulo"
  Mismo nicho, diferente problema que resuelve
  Diferente headline y posicionamiento
  Precio diferente para test de elasticidad
  Ejemplo: "Prompts para vender" → "Prompts para cerrar objeciones"

VARIACIÓN B — "Producto complementario"
  Algo que los compradores del original también necesitan
  Cross-sell natural y lógico
  Precio igual o mayor al original
  Ejemplo: "Prompts de ventas $17" → "Scripts de WhatsApp $27"

VARIACIÓN C — "Nicho adyacente"
  Nicho relacionado pero audiencia diferente
  Aprovecha el aprendizaje del original
  Ejemplo: "Prompts para vendedores" → "Prompts para coaches"

ADEMÁS — UPSELL A COMPRADORES EXISTENTES:
  Para cada comprador del ganador:
  48h después → email personalizado con oferta relacionada
  "Ya que compraste X, esto te va a encantar..."

ÁRBOL DE CRECIMIENTO (interés compuesto real):
  Generación 1: 1 producto ganador
  Generación 2: 3 productos (réplicas)
  Generación 3: 9 productos (réplicas de réplicas)
  Generación 4: 27 productos...

MODELO FINANCIERO DE AUTO-REPLICACIÓN:
  Revenue del ganador:
  60% → ganancia neta del dueño
  25% → reinversión (15% ads + 10% API)
  10% → fondo de expansión
  5%  → reserva de emergencias
*/
```

---

## 🎯 MOTOR 2 — AGENCIA DE LEADS EN DETALLE

### El modelo de negocio completo

```
EL CICLO DE UN LEAD:

1. AGENTE ENCUENTRA AL COMPRADOR
   Detecta en redes señales reales de compra:
   "buscando carro usado en Miami"
   "alguien recomienda hotel en Cancún"
   "necesito dentista urgente en Bogotá"
   "quiero comprar apartamento este mes"

2. AGENTE CALIFICA AL LEAD (score 1-10)
   Claude analiza el texto y asigna score:
   9-10 = "Quiero comprar esta semana, tengo presupuesto"
   7-8  = "Busco activamente, comparando opciones"
   5-6  = "Interesado pero sin urgencia clara"
   1-4  = "Solo mirando" → DESCARTA automáticamente
   Solo pasan leads con score 7+

3. AGENTE CONTACTA CON VALOR GENUINO
   Mensaje personalizado que ayuda primero:
   "Hola, vi que buscas [X].
    Tengo acceso a opciones que no siempre están publicadas.
    ¿Qué características son más importantes para ti?"

4. AGENTE CAPTURA INFORMACIÓN
   Nombre, teléfono, qué busca exactamente,
   presupuesto, cuándo quiere comprar, ubicación

5. AGENTE ENTREGA AL CLIENTE (dealer/clínica/etc.)
   WhatsApp automático al negocio cliente:
   formato específico por industria

6. COBRA AUTOMÁTICAMENTE
   Stripe cobra al negocio por cada lead entregado
   O cobra el retainer mensual el día 1

7. ALERTA AL DUEÑO
   Telegram: "Lead entregado + monto cobrado"
```

### Automotive — La vertical de arranque

```javascript
// verticals/automotive/config.json
{
  "industria": "automotive",
  "precio_lead_recomendado": 150,
  "precio_lead_premium": 250,   // leads ultra-calificados
  "precio_retainer": 2000,      // mensual flat

  "señales_de_compra": [
    "busco carro", "quiero comprar carro", "necesito un carro",
    "cambiar mi carro", "financiamiento carro", "carro usado",
    "dealer", "concesionario", "cuotas carro", "presupuesto carro",
    "what car should I buy", "looking for a car",
    "buying a car", "car dealer near me"
  ],

  "señales_alta_calificacion": [
    "tengo el dinero", "este mes", "urgente necesito",
    "ya decidí", "solo falta encontrar", "presupuesto de $"
  ],

  "plataformas": [
    "facebook_groups",    // grupos locales compra/venta carros
    "twitter_search",     // tweets con keywords
    "reddit",             // r/whatcarshouldibuy, r/UsedCars
    "instagram_comments", // comentarios en posts de dealers
    "craigslist",         // sección autos
    "mercadolibre"        // sección autos usado
  ],

  "preguntas_calificacion": [
    "¿Qué tipo de carro buscas exactamente?",
    "¿Cuál es tu presupuesto aproximado?",
    "¿Lo necesitas financiado o tienes efectivo?",
    "¿Para cuándo lo necesitas?"
  ],

  "formato_whatsapp": "🚗 LEAD CALIFICADO — NEXUS AGENT\n\nNombre: {nombre}\nTeléfono: {telefono}\nBusca: {descripcion}\nPresupuesto: ${presupuesto_min}-${presupuesto_max}\nPago: {tipo_pago}\nUrgencia: {urgencia}\nUbicación: {ubicacion}\nFuente: {fuente}\nScore IA: {score}/10\n\n✅ Lead verificado y calificado"
}

/*
CÓMO EL DUEÑO CIERRA EL PRIMER DEALER:

"Oye [nombre], tengo un sistema de IA que encuentra
personas buscando comprar carro con presupuesto definido.
No son formularios fríos — son personas que encontré
activamente buscando en Facebook, Reddit e Instagram.

Te mando 5 leads gratis esta semana para que veas la calidad.
Si uno solo cierra, el sistema se pagó 10 veces.
¿Lo intentamos?"

[Agente manda 5 leads]
[Dealer cierra 1-2 carros → $2,000-4,000 de comisión]
[Dealer llama él solo para el contrato]

Contrato sugerido: $150/lead O $2,000/mes flat
Con 5 dealers: $7,500-10,000/mes solo de automotive
*/
```

### Expansión progresiva por industria

```javascript
// core/vertical-spawner.js

/*
REGLA DE EXPANSIÓN AUTOMÁTICA:
Si [industria_actual] genera > $2,000/mes por 30 días
→ activa la siguiente industria en la lista

ORDEN Y VALOR POR INDUSTRIA:

FASE 1 — Automotive (MES 1)
  Precio/lead: $100-250
  Por qué primero: el dueño YA tiene contactos
  Cómo encuentra clientes: contactos directos del dueño
  Tiempo para primer ingreso: días

FASE 2 — Real Estate (MES 2-3)
  Precio/lead: $200-500
  Por qué: comisiones inmobiliarias enormes justifican el precio
  Quién paga: agentes y brokers inmobiliarios
  Leads que busca: "quiero comprar casa/apartamento"
  Cómo encuentra clientes: el agente busca agentes con anuncios

FASE 3 — Medical (MES 3-4)
  Precio/lead: $50-200
  Por qué: volumen alto, tratamientos de alto valor
  Quién paga: dentistas, clínicas estéticas, especialistas
  Leads que busca: "necesito dentista", "cirugía estética"
  Cómo encuentra clientes: Google Maps + LinkedIn

FASE 4 — Hospitality (MES 4-5)
  Precio/lead: $30-100 o comisión por reserva
  Por qué: temporadas altas generan explosión de leads
  Quién paga: hoteles, resorts, apart-hoteles
  Leads que busca: "hotel en [destino]", "vacaciones"

FASE 5 — Legal (MES 5-6)
  Precio/lead: $100-400
  Por qué: los abogados pagan MÁS que nadie por leads
  Quién paga: abogados de accidentes, divorcios, inmigración
  Leads que busca: "accidente de carro", "necesito abogado"

FASE 6 — Restaurant (MES 6+)
  Precio/lead: $5-20 (pero VOLUMEN masivo)
  Por qué: cientos de restaurantes × bajo precio = gran total
  Funnels de reservas y eventos corporativos

PLANTILLA UNIVERSAL (_template/):
Para cualquier industria no listada aquí,
Claude completa la plantilla con investigación real.
El sistema aprende una industria nueva en 1 hora.
*/
```

---

## 🚀 AGENTES AVANZADOS EN DETALLE

### trend-hunter.js — Ve el Futuro

```javascript
/*
Corre: 2 veces al día (6am y 6pm)

FUENTES MONITOREADAS:
- Google Trends API: picos de búsqueda emergentes
- Twitter/X trending: topics de negocios en crecimiento
- Reddit: posts con mayor velocidad de upvotes en 48h
- Product Hunt: nuevos lanzamientos con tracción
- Hacker News: Show HN con engagement alto
- Newsletters VC (a16z, YC): anticipar tendencias tech

LÓGICA:
1. Detecta tema con crecimiento > 300% en 48h
2. Evalúa si hay producto digital o nicho de leads posible
3. Calcula ventana de oportunidad antes de saturación
4. Si ventana > 14 días → alerta URGENTE al dueño

ALERTA ESPECIAL:
"🔥 TENDENCIA DETECTADA — VENTANA: [X] días

Tema: [nombre]
Crecimiento: [X]% en 48h
Producto sugerido: [tipo + precio]
Revenue potencial si entra HOY: $[X]

¿LANZAMOS? Responde SI — procedo en 30 minutos"

El que entra primero a una tendencia captura el 80% del mercado.
Este agente es esa ventaja.
*/
```

### competitor-spy.js — El Espía Estratégico

```javascript
/*
Corre: 1 vez al día

MONITOREA:
- Top sellers Gumroad por categoría semanal
- Productos más vendidos en Etsy (digitales)
- Cursos populares en Udemy/Teachable
- Newsletters de pago en Substack
- Otras agencias de leads en LinkedIn

PROCESO PARA PRODUCTOS DIGITALES:
1. Scraping de top 10 productos por nicho activo
2. Claude analiza: qué venden, precio, qué prometen
3. Lee reviews y comentarios: qué NO tienen los compradores
4. Genera brief de "versión mejorada":
   - Mismo nicho pero resuelve las quejas ignoradas
   - Precio estratégico vs competencia
5. Pasa el brief al generator.js

PROCESO PARA AGENCIA DE LEADS:
1. Busca otras agencias de leads en el área
2. Analiza sus precios y propuesta de valor
3. Identifica nichos que no cubren
4. Alerta al dueño con oportunidad

INSIGHT CLAVE:
Los comentarios negativos de la competencia
son el mapa exacto de lo que debes ofrecer tú.
*/
```

### price-optimizer.js — Maximiza Cada Dólar

```javascript
/*
Corre: Cada 48h para productos con 10+ visitas

PROCESO:
1. Para cada producto activo con suficientes datos:
2. Crea 3 variantes de precio en Stripe:
   - Control: precio actual
   - Test A: precio 30% mayor
   - Test B: precio 30% menor
3. Rota precios entre visitantes cada 48h
4. Después de 200 visitas totales → elige ganador
5. Actualiza precio automáticamente

TAMBIÉN PRUEBA:
- Pricing psicológico: $27 → $24.97
- Bundle: solo vs pack de 3 productos
- Urgencia: "precio sube en 24h"

TAMBIÉN PARA LEADS:
- Prueba $120 vs $150 vs $180/lead con diferentes dealers
- Encuentra el precio que maximiza revenue total

RESULTADO TÍPICO:
+16-35% de revenue sin cambiar nada más.
*/
```

### funnel-builder.js — La Máquina de Ventas

```javascript
/*
MISIÓN: Construir funnels completos para cada producto ganador.
Un producto sin funnel es dinero que se queda en la mesa.

FUNNEL COMPLETO QUE CONSTRUYE:

PASO 1 — LEAD MAGNET (gratis, captura email)
  Versión mini del producto
  Ejemplo: "5 prompts gratis" antes de vender los 50
  Landing separada solo para captura

PASO 2 — TRIPWIRE ($7-17)
  Producto pequeño de entrada muy barato
  Convierte visitantes fríos en compradores reales
  "Ya que tomaste los 5 gratis, aquí van 50 por $7"

PASO 3 — PRODUCTO CORE ($27-67)
  El producto principal
  Tasa de conversión mayor porque ya compraron antes

PASO 4 — UPSELL ($97-197)
  "Versión Pro" ofrecida inmediatamente después del core
  30-40% de compradores del core lo toman

PASO 5 — SECUENCIA DE EMAIL (7 emails en 14 días)
  Para quienes no compraron en cada paso
  Generados por Claude, personalizados por comportamiento
  Email final = last chance con descuento

RESULTADO:
Visitante sin funnel: $17 promedio
Visitante con funnel: $52-85 promedio
+200-400% revenue por visitante
*/
```

### upsell-engine.js — Más Dinero de Cada Cliente

```javascript
/*
Cuesta 5x más conseguir cliente nuevo que venderle más al existente.

PROCESO:
1. Comprador entra a la base → upsell-engine lo registra
2. Claude analiza qué compró y genera oferta relacionada
3. 48h post-compra → email personalizado:
   "Hola, vi que compraste [X].
    Los usuarios que también toman [Y]
    reportan [beneficio específico]. Lo tienes por $[Z] hoy."
4. Sin abrir en 72h → variación diferente del mensaje
5. Sin comprar en 7 días → oferta de bundle con descuento
6. Día 20 → "todos los productos" bundle especial
7. Día 30 → oferta de newsletter/membresía mensual

PARA CLIENTES B2B (dealers, clínicas):
1. Dealer lleva 3 meses → detecta alto volumen de cierres
2. Genera propuesta de upgrade:
   "Llevas 40 cierres con nosotros.
    Te ofrezco exclusividad en tu zona por $2,500/mes flat."

SIN UPSELL: $17-150 promedio por cliente
CON UPSELL: $45-400 promedio por cliente
*/
```

### affiliate-hunter.js — Gana Sin Crear Nada

```javascript
/*
MISIÓN: Encontrar programas de afiliados rentables
en los nichos activos del sistema.

BUSCA PROGRAMAS CON:
- Comisión > 30%
- Cookie duration > 30 días
- Producto con reviews positivas reales
- Pagos verificados y puntuales

MEJORES CATEGORÍAS 2026:
- SaaS tools: 20-40% recurrente mensual
- Cursos online: 30-50% por venta
- Hosting/dominios: $50-200 por referido
- Herramientas IA: 20-30% recurrente

PROCESO:
1. Para cada nicho activo → busca top 5 afiliados
2. Se registra automáticamente donde puede
3. Genera contenido de afiliado para el blog:
   - Reviews detalladas (optimizadas para SEO)
   - Comparativas de herramientas
   - "Top X herramientas para [nicho]"
4. Inserta links de afiliado naturalmente en el contenido
5. Reporta comisiones en dashboard

INGRESO PASIVO ADICIONAL:
$300-1,500/mes completamente pasivo
sin crear un solo producto propio
*/
```

### content-army.js — El Ejército SEO

```javascript
/*
MISIÓN: Dominar Google en todos los nichos activos.
Tráfico orgánico infinito y gratuito para siempre.

PRODUCE DIARIAMENTE (por nicho activo):
- 2 artículos SEO longform (1,500+ palabras)
- 5 posts cortos para redes sociales
- 1 thread completo para Twitter/X
- 1 respuesta de valor en Reddit (sin spam)
- 1 email para lista de suscriptores

ESTRATEGIA SEO AUTOMATIZADA:
1. Keyword research con Claude:
   - Volumen > 500 búsquedas/mes
   - Dificultad < 30 (competencia baja)
   - Intent comercial (quieren comprar)
2. Artículo generado con:
   - H1, H2, H3 con keywords naturales
   - Intro con keyword principal en primer párrafo
   - Links internos a otros artículos del blog
   - CTA natural hacia el producto
   - Meta description optimizada
3. Publica en blog del producto en Vercel
4. Pinga a Google Search Console para indexación rápida
5. Comparte automáticamente en redes sociales

A 6 MESES: 180+ artículos por nicho
Tráfico proyectado: 2,000-8,000 visitas/mes orgánicas
Revenue pasivo adicional: $300-1,500/mes por nicho
*/
```

### prospector.js — Busca Clientes para el Motor 2

```javascript
/*
MISIÓN: Encontrar negocios (dealers, clínicas, hoteles)
que quieran pagar por leads. El agente busca a los clientes,
no espera que lleguen solos.

PROCESO DIARIO:
1. Para cada vertical activa o por activar:
2. Busca negocios del tipo en:
   - Google Maps (negocios locales con reseñas)
   - LinkedIn (gerentes y dueños de negocios)
   - Instagram (negocios con anuncios activos)
   - Facebook Business (páginas de negocios)
3. Filtra por:
   - Tienen presupuesto para marketing (ads activos)
   - Son locales con operación real
   - No tienen sistema de leads con IA todavía
4. Genera propuesta personalizada por industria
5. Envía mensaje/email de contacto inicial
6. Si responden → alerta al dueño para cerrar el trato

ALERTA TELEGRAM:
"🏢 PROSPECTO B2B RESPONDIÓ

Negocio: [nombre]
Industria: [tipo]
Contacto: [nombre]
Respondió: [mensaje]
→ Continúa TÚ la conversación para cerrar"

El agente abre la puerta.
El dueño (con su experiencia en ventas) cierra.
*/
```

### partnership-agent.js — El Networker Automático

```javascript
/*
MISIÓN: Conseguir colaboraciones con creadores de contenido
para multiplicar alcance sin pagar ads.

BUSCA CREADORES CON:
- Audiencia: 1,000-50,000 (micro-influencers)
- Engagement real (ratio comentarios/likes > 3%)
- Audiencia hispanohablante activa
- Sin producto propio que compita directamente
- Contenido relacionado al nicho activo

TIPOS DE PROPUESTA:
A) Co-crear producto: revenue split 50/50
B) Ellos promocionan tu producto: comisión 40%
C) Intercambio de menciones: sin costo

PROCESO:
1. Analiza contenido del creador para personalizar
2. Claude genera propuesta irresistible específica
3. Envía DM personalizado (no template genérico)
4. Si responde → alerta al dueño para continuar

CON 5 COLABORACIONES ACTIVAS:
Acceso gratuito a 50,000+ personas
Sin pagar un centavo en publicidad
*/
```

### empire-builder.js — El Arquitecto del Siguiente Nivel

```javascript
/*
MISIÓN: Cuando el sistema genera ingresos estables,
construir automáticamente el siguiente nivel del negocio.

NIVELES Y CUÁNDO SE ACTIVAN:

NIVEL 1 ($0-500/mes) — BASE
  Productos digitales simples + automotive leads
  El sistema aprende qué funciona
  Foco: generar primeros ingresos reales

NIVEL 2 ($500-2K/mes) — CRECIMIENTO
  + Funnels completos activos
  + Upsells funcionando
  + Afiliados generando pasivo
  + Real estate leads activado

NIVEL 3 ($2K-5K/mes) — ESCALA
  + Newsletter de pago ($15/mes)
  + Agrega todos los leads como free trial
  + 10-20% convierten = $500-2,000/mes fijo
  + Medical y hospitality leads activos

NIVEL 4 ($5K-15K/mes) — AUTORIDAD
  + Curso premium que enseña el sistema ($297-997)
  + El sistema se convierte en el caso de éxito del curso
  + Comunidad privada de pago
  + Legal leads activo

NIVEL 5 ($15K+/mes) — FRANQUICIA
  + Vender el sistema completo llave en mano
  + Precio: $997-2,997
  + El agente hace el onboarding automático
  + Ingresos: $10K-50K en una sola campaña

TECHO REAL:
Año 1: $5,000-8,000/mes
Año 2: $15,000-40,000/mes
Año 3: $40,000-100,000+/mes
*/
```

---

## 🧠 MÓDULOS CORE EN DETALLE

### brain.js — El Director Estratégico

```javascript
/*
El módulo más importante. Toma decisiones con IA real.

DECISIONES QUE TOMA:
1. ¿Qué nicho atacar? → analiza memoria + tendencias + historial
2. ¿Qué tipo de producto? → según nicho y datos históricos
3. ¿A qué precio vender? → competencia + historial + audiencia
4. ¿Cuándo replicar? → solo lo que tiene potencial real
5. ¿Dónde prospectar hoy? → canales con mejor ROI reciente
6. ¿Cómo asignar el presupuesto? → por ROI demostrado

PROMPT INTERNO:
"Eres director estratégico de NEXUS AGENT.
Tienes estos datos: [historial de experimentos]
[qué funcionó y qué no] [revenue actual] [tendencias]
Decide: [decisión específica requerida]
Razona paso a paso. Conservador con dinero. Ambicioso con ideas."

MEMORIA ACUMULATIVA:
Después de cada ciclo → actualiza system_memory
Con el tiempo → decisiones son exponencialmente mejores
*/
```

### treasury.js — El CFO Automático

```javascript
/*
DISTRIBUCIÓN DE CADA DÓLAR QUE ENTRA:

60% → Ganancia neta del dueño
  Acumulado en Stripe, disponible para payout

25% → Reinversión en el sistema
  15% → ads para escalar ganadores
  10% → Claude API para más experimentos

10% → Fondo de expansión
  Para cuando empire-builder active siguiente nivel

5% → Reserva de emergencias
  Si algo falla, el sistema tiene colchón

REGLAS DE GASTO ESTRICTAS:
- Nunca > $5/día en API sin permiso del dueño
- Nunca lanzar ads sin al menos 1 venta orgánica previa
- Nunca escalar sin 72h de datos reales
- Siempre reportar revenue real, nunca proyectado

REPORTES AUTOMÁTICOS:
- Diario (Telegram 9am): revenue, gastos, ganancia neta
- Semanal: ROI por experimento y por vertical
- Mensual: P&L completo del sistema en PDF
*/
```

### telegram.js — La Línea Directa con el Dueño

```javascript
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true
});
const chatId = process.env.TELEGRAM_CHAT_ID;

// ── ENVIAR ALERTA ────────────────────────
async function alert(mensaje) {
  await bot.sendMessage(chatId, mensaje, { parse_mode: 'HTML' });
}

// ── PEDIR PERMISO (espera respuesta humana) ──
async function askPermission(pregunta, timeoutHoras = 4) {
  return new Promise((resolve) => {
    bot.sendMessage(chatId, pregunta, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ SÍ, procede', callback_data: 'yes' },
          { text: '❌ NO, pausa', callback_data: 'no' }
        ]]
      }
    });
    const timeout = setTimeout(() => {
      resolve(false); // opción conservadora si no responde
      alert('⏰ Sin respuesta en ' + timeoutHoras + 'h → tomé opción conservadora');
    }, timeoutHoras * 60 * 60 * 1000);

    bot.on('callback_query', (query) => {
      clearTimeout(timeout);
      bot.answerCallbackQuery(query.id);
      resolve(query.data === 'yes');
    });
  });
}

// ── TIPOS DE ALERTAS ─────────────────────

// Motor 1 - Digital
async function alertaNichoEncontrado(nicho, score, tipo, precio) {
  await alert(`🔍 <b>NICHO ENCONTRADO</b>\nNicho: ${nicho}\nScore: ${score}/100\nTipo: ${tipo}\nPrecio: $${precio}\n${score > 80 ? '→ Auto-aprobado' : '¿Procedo?'}`);
}

async function alertaVentaDigital(producto, monto, email, fuente) {
  await alert(`💰 <b>VENTA RECIBIDA</b>\nProducto: ${producto}\nMonto: <b>$${monto}</b>\nCliente: ${email}\nFuente: ${fuente}`);
}

async function alertaExperimentoMuerto(nombre, aprendizaje) {
  await alert(`💀 <b>EXPERIMENTO MUERTO</b>\nProducto: ${nombre}\nAprendizaje: ${aprendizaje}\n→ Buscando siguiente nicho...`);
}

// Motor 2 - Leads
async function alertaLeadEntregado(industria, dealer, score, descripcion, monto) {
  await alert(`🚗 <b>LEAD ENTREGADO</b>\nIndustria: ${industria}\nCliente: ${dealer}\nScore: ${score}/10\nBusca: ${descripcion}\nCobrado: $${monto}`);
}

async function alertaNuevaVertical(industria, precioPorLead) {
  const aprobado = await askPermission(
    `🆕 <b>NUEVA VERTICAL LISTA</b>\nIndustria: ${industria}\nPrecio/lead: $${precioPorLead}\n¿Activo búsqueda de clientes?`
  );
  return aprobado;
}

// Reporte diario automático 9am
async function reporteDiario(datos) {
  await alert(`
📊 <b>REPORTE DIARIO — ${new Date().toLocaleDateString('es-ES')}</b>

<b>MOTOR 1 — DIGITAL</b>
💰 Revenue hoy: $${datos.digital.revenueHoy}
📦 Ventas: ${datos.digital.ventas}
🟢 Experimentos vivos: ${datos.digital.vivos}
🔴 Muertos hoy: ${datos.digital.muertos}

<b>MOTOR 2 — LEADS</b>
🎯 Leads entregados: ${datos.leads.entregados}
💳 Cobrado: $${datos.leads.cobrado}
🏢 Clientes activos: ${datos.leads.clientesActivos}

<b>TOTAL</b>
💎 Revenue hoy: $${datos.totalHoy}
📈 Revenue mes: $${datos.totalMes}
🏆 Mejor producto: ${datos.mejorProducto}

💡 <i>${datos.insight}</i>
  `);
}

// Comandos del dueño
bot.onText(/\/status/, async (msg) => { /* estado completo */ });
bot.onText(/\/revenue/, async (msg) => { /* ingresos Stripe */ });
bot.onText(/\/leads/, async (msg) => { /* leads por industria */ });
bot.onText(/\/dealers/, async (msg) => { /* clientes B2B activos */ });
bot.onText(/\/experiments/, async (msg) => { /* experimentos digitales */ });
bot.onText(/\/launch/, async (msg) => { /* forzar nuevo experimento */ });
bot.onText(/\/expand/, async (msg) => { /* ver próxima vertical */ });
bot.onText(/\/pause/, async (msg) => { /* pausar sistema */ });
bot.onText(/\/resume/, async (msg) => { /* reanudar sistema */ });
bot.onText(/\/report/, async (msg) => { /* PDF reporte completo */ });
bot.onText(/\/help/, async (msg) => { /* lista de comandos */ });

module.exports = {
  alert, askPermission, alertaNichoEncontrado,
  alertaVentaDigital, alertaExperimentoMuerto,
  alertaLeadEntregado, alertaNuevaVertical, reporteDiario
};
```

---

## 🚦 ORQUESTADOR PRINCIPAL — index.js

```javascript
/*
EL DIRECTOR DE ORQUESTA. Coordina todos los agentes.

AL INICIAR:
1. Verifica TODAS las variables de entorno → para si falta alguna crítica
2. Conecta a Supabase y verifica schema completo
3. Verifica conexión con Stripe
4. Inicializa bot de Telegram → envía "🟢 NEXUS AGENT ONLINE"
5. Carga system_memory en caché
6. Revisa experimentos activos en Supabase
7. Si no hay ninguno → lanza researcher inmediatamente
8. Activa vertical automotive del Motor 2
9. Registra TODOS los cron jobs
10. Inicia servidor HTTP para webhooks

CRON JOBS DEL SISTEMA:
┌─────────────────────────────────────────────────────┐
│ CADA 6H   validator.js       revisa todos los exp.  │
│ CADA 6H   lead-hunter.js     busca nuevos leads      │
│ CADA 12H  trend-hunter.js    detecta tendencias      │
│ CADA 24H  competitor-spy.js  espía competencia       │
│ CADA 24H  content-army.js    genera contenido SEO    │
│ CADA 24H  affiliate-hunter.js busca afiliados        │
│ CADA 24H  prospector.js      busca clientes B2B      │
│ CADA 48H  price-optimizer.js optimiza precios        │
│ 9:00 AM   reporteDiario      Telegram al dueño       │
│ SEMANAL   empire-builder.js  evalúa siguiente nivel  │
└─────────────────────────────────────────────────────┘

ENDPOINTS HTTP:
POST /webhook/stripe     → procesa pagos recibidos
POST /webhook/email      → procesa respuestas de email
POST /webhook/whatsapp   → confirma entrega de leads
GET  /health             → estado del sistema
GET  /metrics            → métricas en tiempo real (dashboard)

MANEJO DE ERRORES:
1. Intenta reiniciar el agente fallido automáticamente
2. Si falla 3 veces → alerta Telegram urgente al dueño
3. Pausa SOLO el agente problemático
4. El resto del sistema sigue corriendo sin interrupción
5. NUNCA cae todo el sistema por un error parcial
6. Logs detallados de cada error en agent_logs

DEPLOY:
Railway.app → corre 24/7
Auto-restart si el proceso cae
Variables de entorno en Railway Dashboard
*/
```

---

## 📊 DASHBOARD COMPLETO (Next.js)

```
╔══════════════════════════════════════════════╗
║         NEXUS AGENT — MISSION CONTROL        ║
╠══════════════════════════════════════════════╣
║ 💰 Revenue Total: $X,XXX                     ║
║ Hoy: $XXX | Semana: $X,XXX | Mes: $X,XXX     ║
╠══════════════╦═══════════════════════════════╣
║ MOTOR 1      ║ MOTOR 2                       ║
║ 🟢 Vivos: X  ║ 🎯 Leads hoy: X              ║
║ 🔴 Muertos:X ║ 🏢 Clientes: X               ║
║ 🔄 Corriendo ║ 💳 Cobrado: $X               ║
╠══════════════╩═══════════════════════════════╣
║ Gráfico ingresos por día (últimos 30 días)   ║
╠══════════════════════════════════════════════╣
║ ACTIVIDAD EN TIEMPO REAL (Supabase Realtime) ║
║ 10:32 — 💰 Venta $27 — prompts-ia           ║
║ 10:15 — 🚗 Lead entregado — AutoDealer MIA  ║
║ 09:45 — 🔍 Nicho detectado — score 87/100   ║
║ 09:30 — ✍️ Artículo SEO publicado           ║
╚══════════════════════════════════════════════╝

PÁGINA: EL ÁRBOL DEL IMPERIO
  Visualización árbol interactivo:
  Experimento raíz ($X revenue)
  ├── Réplica A (🟢 viva, $X/mes)
  │   ├── Sub-réplica A1 (🔄 corriendo)
  │   └── Sub-réplica A2 (🟢 viva)
  ├── Réplica B (🔴 muerta — aprendizaje guardado)
  └── Réplica C (🔄 corriendo — 48h restantes)

PÁGINA: MAPA DE LEADS
  Vista por industria y geografía
  Automotive: X leads este mes | $X cobrado
  Real Estate: [INACTIVO — se activa mes 2]
  Medical: [INACTIVO — se activa mes 3]

PÁGINA: MEMORIA DEL SISTEMA
  Lista de todos los aprendizajes acumulados
  Nichos que fallaron y por qué
  Patrones de éxito identificados
  Reglas que el sistema se impuso solo
  Confianza de cada aprendizaje (0-100%)

PÁGINA: FINANZAS
  Revenue por motor (digital vs leads)
  Gastos de API y ads
  Ganancia neta real
  Proyección a 30/60/90 días
  P&L mensual descargable

CONTROLES:
  [Lanzar experimento] [Pausar sistema]
  [Forzar réplica]     [Activar vertical]
  [Ver logs completos] [Ajustar presupuesto]
```

---

## 📦 PRIMER EXPERIMENTO AL LANZAR

```
MOTOR 1 — PRODUCTO DIGITAL:
Nicho:    "Prompts de IA para emprendedores latinos"
Tipo:     PDF descargable + template Notion
Nombre:   "50 Prompts de IA para Ganar Dinero Online"
Precio:   $17 (tripwire)
Upsell:   Pack 200 prompts → $47
Idioma:   Español
Páginas:  40-50

Contenido (10 categorías × 5 prompts):
1. Crear productos digitales rápido
2. Copy que convierte y vende
3. Investigar nichos rentables
4. Automatizar tareas de negocio
5. Crear contenido viral en redes
6. Cerrar ventas por WhatsApp
7. Emails que generan respuesta
8. Reactivar clientes inactivos
9. Crear ofertas irresistibles
10. Escalar un negocio con IA

MOTOR 2 — PRIMER LEAD (esta semana):
El dueño contacta a 1 dealer conocido directamente.
Ofrece 5 leads gratis para demostrar calidad.
El agente genera esos 5 leads mientras hablan.
Después del primer cierre → contrato firmado.
```

---

## 💰 PROYECCIÓN FINANCIERA COMBINADA

```
MES 1-2: CONSTRUCCIÓN + PRIMERAS VENTAS ($0-900)
  Motor 1 digital:  $0-300
  Motor 2 leads:    $0-600  (2-4 dealers × 5 leads × $150)
  Aprendiendo qué funciona, primeros datos reales

MES 3-4: TRACCIÓN ($800-4,500)
  Motor 1 digital:  $500-1,500  (3-5 experimentos vivos)
  Motor 2 leads:    $1,500-3,000 (5-10 dealers activos)
  Funnels activos, primeros upsells, afiliados

MES 5-6: ESCALA ($4,500-9,000) ← META SUPERADA
  Motor 1 digital:  $1,500-3,000 (réplicas × réplicas)
  Motor 2 leads:    $3,000-6,000 (automotive + real estate)
  SEO generando tráfico orgánico, newsletter activa

MES 7-9: MADUREZ ($8,000-20,000)
  Motor 1 digital:  $3,000-6,000
  Motor 2 leads:    $5,000-14,000 (3-4 verticales)
  empire-builder evaluando nivel 4

MES 10-12: EMPIRE ($16,000-31,000+)
  Motor 1 digital:  $3,000-6,000
  Motor 2 leads:    $8,000-15,000
  Venta del sistema: $5,000-10,000 one-time
  Curso premium activo: $2,000-5,000

INVERSIÓN MENSUAL MÁXIMA: $200
ROI MES 6: 22-45x la inversión
ROI AÑO 1: 80-150x la inversión inicial
```

---

## ⚠️ REGLAS SAGRADAS DEL SISTEMA

```
DINERO — NUNCA VIOLAR:
□ Nunca gastar > $5/día en Claude API sin permiso
□ Nunca lanzar ads sin al menos 1 venta orgánica previa
□ Nunca escalar producto sin 72h de datos reales
□ Distribución sagrada: 60% dueño / 25% reinversión / 15% reserva
□ Reportar solo revenue REAL, nunca proyectado o estimado

LEADS — ÉTICA Y CALIDAD:
□ Solo entregar leads con score 7+ al cliente
□ Nunca contactar la misma persona dos veces
□ Siempre dar valor genuino antes de pedir datos
□ Si el lead pide que lo dejen de contactar → parar inmediatamente
□ Nunca hacer spam masivo — calidad siempre > cantidad

EXPANSIÓN — PACIENCIA ESTRATÉGICA:
□ Nunca activar vertical nueva sin que la anterior
  genere $2,000/mes estables por 30 días
□ Siempre empezar con automotive (los contactos ya existen)
□ Pedir permiso al dueño antes de entrar a industria nueva
□ El sistema crece con sus propias ganancias, nunca con deuda

SISTEMA — AUTONOMÍA RESPONSABLE:
□ Siempre pedir permiso antes de acciones irreversibles
□ Si el dueño no responde en 4h → opción conservadora
□ Nunca tomar decisión de > $50 sin aprobación
□ Guardar aprendizaje de absolutamente todo lo que falla
□ Si algo no está claro → preguntar por Telegram antes de actuar
□ El sistema trabaja PARA el dueño, nunca al revés
□ Logs detallados de cada acción en agent_logs
```

---

## 📋 CHECKLIST COMPLETO DE CUENTAS

```
CRÍTICAS — SIN ESTAS NO ARRANCA:
□ Anthropic API Key   → console.anthropic.com
□ Stripe              → ya tiene ✅ (con dominio)
□ Supabase            → supabase.com (tier gratis)
□ Vercel              → vercel.com (tier gratis)
□ Dominio             → ya tiene ✅
□ Telegram Bot        → ya tiene ✅ (con canal)
□ Railway             → railway.app (hosting 24/7)

PARA MOTOR 2 — LEADS:
□ WhatsApp Business   → twilio.com O meta.com/business
□ Twitter Developer   → developer.twitter.com
□ Reddit App          → reddit.com/prefs/apps
□ Facebook            → el agente usa sesión manual inicialmente

OPCIONALES — MÁS CANALES:
□ Resend              → resend.com (emails automáticos)
□ Gumroad             → gumroad.com (marketplace extra)
□ Umami               → umami.is (analytics sin cookies)
□ LemonSqueezy        → alternativa a Stripe

PRIMER CLIENTE MANUAL (esta semana):
□ Contactar 1 dealer conocido directamente
□ Ofrecer 5 leads gratis para demostrar
□ Cerrar contrato después del primer resultado
□ Ingresar dealer en el dashboard del sistema
```

---

## 🎯 PROMPT MAESTRO DEFINITIVO PARA CLAUDE CODE

```
Eres el CTO y arquitecto jefe de NEXUS AGENT v4.0.
Tienes acceso completo a esta carpeta de proyecto.
Lee este README completo antes de escribir una sola línea.

Tu misión: construir el sistema completo con DOS MOTORES.
No construyas partes. Construye TODO de una vez.

MOTOR 1: Sistema autónomo de productos digitales
MOTOR 2: Agencia de leads con IA por verticals

ORDEN DE CONSTRUCCIÓN:
1.  Estructura de carpetas exactamente como en el README
2.  package.json con TODAS las dependencias
3.  .env.example con todas las variables comentadas
4.  Schema SQL completo para Supabase (ejecutable)
5.  core/ — todos los módulos base con manejo de errores
6.  agents/digital/ — los 5 agentes del Motor 1
7.  agents/leadgen/ — los 5 agentes del Motor 2
8.  verticals/automotive/ — primera vertical completa
9.  verticals/_template/ — plantilla universal
10. agents/advanced/ — todos los agentes avanzados
11. dashboard/ — Next.js completo con todas las páginas
12. index.js — orquestador unificado de ambos motores
13. README de deploy paso a paso

DEPENDENCIAS:
@anthropic-ai/sdk, @supabase/supabase-js, stripe,
node-telegram-bot-api, node-cron, express, axios,
puppeteer, resend, cheerio, twilio, next, react,
recharts, dotenv, winston, uuid

IMPORTANTE:
- El dueño ya tiene Telegram Bot y canal funcionando
- El primer vertical es siempre automotive
- Los demás se activan solos según las reglas de expansión
- Código de calidad producción — maneja dinero real
- Logs de absolutamente todo
- Zero tolerancia a errores silenciosos

AL TERMINAR:
1. Lista exacta de variables del .env a completar
2. Instrucciones de deploy en Railway (paso a paso)
3. Envía "⚡ NEXUS AGENT v4.0 ONLINE 🟢" al Telegram
4. Lanza el primer experimento digital automáticamente
5. Activa búsqueda de leads para automotive
6. Abre el dashboard en localhost:3000
7. Muestra el primer lead encontrado en consola
```

---

*NEXUS AGENT v4.0 — DOCUMENTO MAESTRO DEFINITIVO*
*Dos motores. Expansión progresiva. Crecimiento infinito.*
*Filosofía: Darwin + Interés Compuesto + IA + Relaciones Humanas*
*El fundador supervisa desde Telegram. El sistema hace el resto.*
*Marzo 2026*
