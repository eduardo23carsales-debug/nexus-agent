# Cohete Bot — Venta automática (integrado a tu sistema Node)

Este proyecto ya cobra y entrega productos digitales por Stripe. Le agregamos el **Cohete Bot Lite**:
cuando alguien paga → se **emite la licencia** en tu `license_server` (Python) → se **manda por email** (Resend).
Todo reusando tu infra existente. **Idempotente**: si el email ya tiene licencia, no reemite ni reenvía.

## Archivos agregados / tocados
- `core/cohete.js` — el puente (emitir licencia + email + registrar cliente).
- `core/api-server.js` — el webhook `/webhook/stripe` ahora detecta la compra del Cohete y entrega la licencia.
- `crear-link-cohete.js` — crea el producto + payment link de $997.

## Pasos para encenderlo (una sola vez)

### 1. Variables en el `.env`
```
COHETE_LICENSE_SERVER_URL=https://cohete-license-server.onrender.com   # tu license_server (Render)
COHETE_ADMIN_KEY=...            # la MISMA X-Admin-Key del license_server
COHETE_PRICE_USD=997
COHETE_INSTALL_URL=             # (opcional) link a la guía de instalación / descarga
COHETE_FROM_NAME=Cohete Bot     # (opcional) remitente del email
# COHETE_PAYMENT_LINK=          # lo completás en el paso 2
```
> `STRIPE_SECRET_KEY` y `RESEND_API_KEY` ya los tenés configurados.

### 2. Crear el link de pago
```
node crear-link-cohete.js
```
Copia lo que imprime:
- `COHETE_PAYMENT_LINK=plink_...` → **pegalo en el `.env`** (así el webhook sabe cuál compra es del Cohete).
- La **URL** → va como `stripe_url` en el config del bot Lite (el botón "pagar $997").

### 3. Webhook de Stripe
Ya tenés `/webhook/stripe` configurado para tus otros productos → **no hay que tocar nada**.
(Verificá en Stripe → Developers → Webhooks que el endpoint apunte a `https://TU-DOMINIO/webhook/stripe`
y escuche `checkout.session.completed`.)

### 4. En el bot Lite (`cohete_lite/config/lite_config.json`)
```json
"stripe_url": "https://buy.stripe.com/....",              // la URL del paso 2
"license_server_url": "https://cohete-license-server.onrender.com"
```

## Cómo queda el flujo
```
Cliente paga el link → Stripe → /webhook/stripe (verifica firma)
  → cohete.esCompraCohete(session)?  → SÍ
  → ¿ya tiene licencia? (license_server /api/admin/get)  → NO
  → license_server /api/admin/issue  → clave CHT1...
  → email con la clave (Resend)  → registra cliente
```
El cliente pega la clave en el bot → **acceso completo**. Vos recibís el pago en Stripe.

## Respaldo (opcional)
`cohete.procesarCoheteNuevos()` reescanea pagos de las últimas 2h y entrega los que falten
(por si un webhook se pierde). Se puede colgar de un cron como hacés con los otros.
