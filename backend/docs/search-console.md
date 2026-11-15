# Search Console — integración y operación

Datos de Google Search Console (clics, impresiones, CTR, posición, consultas,
páginas y dispositivos) cacheados en Neon y expuestos en `/admin/metrics`
(pestaña **SEO**). Sin dependencias nuevas: el JWT RS256 se firma con
`node:crypto`.

## Variables de entorno (Railway)

| Variable | Obligatoria | Valor |
|----------|-------------|-------|
| `SEARCH_CONSOLE_SA_JSON` | sí | JSON completo de la service account, crudo (empieza con `{`) o en base64. |
| `SEARCH_CONSOLE_SITE_URL` | no | Propiedad de Search Console. Default `https://aakbejuco.com/`; el slash final se añade solo. Para propiedades de dominio usa `sc-domain:ejemplo.com`. |
| `SEARCH_CONSOLE_DISABLED` | no | `1` apaga la integración y hace que el panel muestre el aviso de desactivado. |

Codificar el JSON en base64:

```bash
# Git Bash / Linux / macOS
base64 -w0 service-account.json
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

## Preparación en Google (una sola vez)

1. Google Cloud Console → nuevo proyecto **sin facturación** → *APIs y servicios*
   → habilitar **Google Search Console API**.
2. *IAM y administración* → *Cuentas de servicio* → crear una cuenta (sin roles
   de proyecto) → *Claves* → **Añadir clave → JSON** y descargar el archivo.
3. Copiar el correo de la service account
   (`...@....iam.gserviceaccount.com`).
4. Search Console (`https://search.google.com/search-console`) → propiedad
   `https://aakbejuco.com/` → *Configuración* → *Usuarios y permisos* →
   **Añadir usuario** con ese correo y permiso **Restringido**.
5. Railway → servicio del backend → *Variables* → añadir
   `SEARCH_CONSOLE_SA_JSON` y `SEARCH_CONSOLE_SITE_URL` → redeploy.

El permiso *Restringido* basta para leer `searchAnalytics`; no se necesita
*Completo* ni *Propietario*.

## API

| Endpoint | Respuesta |
|----------|-----------|
| `GET /api/seo/status` | `{ connected, hasCredentials, siteUrl, disabled, lastAttemptAt, lastSuccessAt, lastError, snapshotAt, stale }` |
| `GET /api/seo/summary?days=28` | `{ connected: true, stale, fetchedAt, siteUrl, snapshot }` o `{ connected: false, reason, message, lastAttemptAt, lastError }` |
| `POST /api/seo/refresh` | Igual que `summary`; refresco en línea con presupuesto de 20 s. |

- `reason` posibles: `missing-credentials`, `no-data`, `disabled`, `error`,
  `timeout`.
- `summary` sirve el último snapshot y, si tiene más de 24 h, lanza un refresco
  en background sin bloquear la respuesta (`stale: true`).
- Si no hay snapshot, `summary` dispara un refresco en background y responde
  `no-data`: recargar la pestaña unos segundos después suele mostrar datos.
- `POST /api/seo/refresh` deduplica llamadas concurrentes.
- Retención: se borran los snapshots con más de 30 días al refrescar con éxito.
- Ventana consultada: `endDate = hoy - 3 días`, `startDate = endDate - 27 días`
  (Google publica con 2–3 días de retraso).

## Tablas

| Tabla | Uso |
|-------|-----|
| `seo_snapshots` | Snapshot completo en `payload` (jsonb) por `site_url` y `days`; `fetched_at` marca la antigüedad. |
| `seo_sync_state` | Fila única `id = 1` con `last_attempt_at`, `last_success_at` y `last_error` (solo el mensaje de Google). |

Migración: `backend/drizzle/0002_lame_magma.sql`
(`npm run db:migrate -w backend`).

## Troubleshooting

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| `reason: missing-credentials` | Falta la variable o el JSON está mal formado | Revisar `SEARCH_CONSOLE_SA_JSON` (raw o base64) y redesplegar. |
| `Search Console token falló (400): invalid_grant` | Reloj desfasado, llave revocada o correo equivocado | Regenerar la llave JSON y actualizar la variable. |
| `Search Console query falló (403)` | La service account no está en la propiedad o el `siteUrl` no coincide | Añadir el correo en Search Console y verificar el slash final. |
| Panel con ceros | Google aún no publica (2–3 días de retraso) | Esperar; comparar con el panel de Google. |
| `stale: true` persistente | El refresco falla | Revisar `lastError` en `/api/seo/status` y los logs de Railway. |

## Seguridad

- La llave privada y la assertion JWT nunca se serializan: los errores pasan por
  `sanitizeSeoError()`, que recorta PEM, `ya29.*` y JWT.
- El access token se cachea en memoria hasta 60 s antes de expirar; no se
  persiste en Neon ni se devuelve por API.
- Sin credenciales la API responde `200 { connected: false }`, nunca 500.
