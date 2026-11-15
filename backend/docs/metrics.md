# Métricas propias — operación, privacidad y retención

Sistema de medición propio (sin GA4, sin Sentry, sin cookies de terceros) que
alimenta `/admin/metrics`. Toda la data vive en la tabla `analytics_events` de
Neon.

## Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| `POST` | `/api/metrics/events` | Ingesta pública en lote (`{ events: [...] }`) o evento suelto. Acepta JSON y `text/plain` (sendBeacon). Responde `202 { accepted, rejected }`. |
| `GET` | `/api/metrics/summary?days=7\|30\|90` | Agregados de tráfico: `totals`, `daily`, `topPages`, `topProducts`, `topCategories`, `funnel`, `events`. |
| `GET` | `/api/metrics/health` | Ping de la tabla: `{ ok, lastEventAt }`. |
| `GET` | `/api/metrics/health-summary?days=7\|30\|90` | Errores JS y Core Web Vitals (p75): `errors`, `topErrors`, `vitals`, `range`, `generatedAt`. |
| `POST` | `/api/metrics/purge` | Borra eventos con más de 90 días y responde `{ deleted }`. |

Si Neon no responde, las rutas de lectura/ingesta devuelven `503 { error: 'metrics-unavailable' }`
sin afectar al resto de la API.

## Tipos de evento (lista blanca)

`page_view`, `product_view`, `category_view`, `add_to_quote`, `quote_open`,
`pdf_download`, `contact_click`, `shipping_calc`, `search`, `wishlist_add`,
`js_error`, `web_vital`.

- `js_error`: `meta.message` (≤200 caracteres) y `meta.stack` (3 primeras líneas).
- `web_vital`: `value` en ms para LCP/INP o número para CLS; `meta.metric` es
  `lcp`, `inp` o `cls`; `meta.rating` es `good`, `needs-improvement` o `poor`.
- `/admin` no genera `page_view` ni `web_vital` para no mezclar el panel con la
  tienda en las estadísticas.

## Privacidad

- No se guarda IP, user-agent crudo, email ni ningún dato personal.
- `visitorId` es un UUID anónimo de `SessionService` (`localStorage`,
  `aak_session_id`). `sessionId` expira a los 30 min de inactividad
  (`sessionStorage`).
- Se respeta `navigator.doNotTrack === '1'`: el cliente no envía eventos.
- El `meta` de los eventos está limitado a 1 KB y se descarta si excede.

## Retención y purga

- Retención: **90 días**. Los eventos más antiguos se eliminan solos en ~1 de
  cada 100 ingestas (`purgeOldEvents()`).
- Purga manual: botón **"Purgar datos de más de 90 días"** en
  `/admin/metrics` → pestaña **Salud**, o
  `POST https://aakonline-production.up.railway.app/api/metrics/purge`.
- La purga nunca toca eventos recientes: el corte es `created_at < now() - 90 days`.

## Runbook

1. **Verificar que hay datos**: `GET /api/metrics/health` debe devolver
   `ok: true` y un `lastEventAt` reciente tras navegar la tienda.
2. **Probar errores JS**: en DevTools de la tienda ejecutar
   `setTimeout(() => { throw new Error('prueba-metricas') })`, recargar y abrir
   `/admin/metrics` → **Salud**. El mensaje debe aparecer con su ruta.
3. **Ver vitals**: navegar 2–3 páginas de la tienda y esperar ~1 minuto. LCP/INP
   se reportan al cargar/interactuar; CLS e INP suelen llegar al ocultar la
   pestaña. Un `p75` alto en las primeras muestras es normal: el panel muestra
   el número de muestras para distinguir "pocas" de "malas".
4. **Purgar**: pulsar el botón y confirmar. Debe responder con el conteo
   eliminado (0 si no hay eventos fuera de retención).
5. **503 persistente**: revisar `DATABASE_URL` en Railway y que la tabla
   `analytics_events` exista (`npm run db:migrate -w backend`).

## Mantenimiento

- Los agregados usan índices sobre `created_at`, `(type, created_at)`,
  `product_id` y `path`. Revisar si el volumen crece.
- El snapshot de Search Console (pestaña SEO) se documenta en
  [`search-console.md`](search-console.md).
