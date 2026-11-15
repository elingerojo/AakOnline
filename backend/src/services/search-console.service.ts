/**
 * search-console.service.ts — Cliente mínimo de Google Search Console.
 *
 * Sin dependencias nuevas: el JWT RS256 se firma con `node:crypto` y el access
 * token se canjea en el endpoint OAuth2 de Google.
 *
 * Reglas:
 * - Si faltan credenciales se informa `missing-credentials`, nunca se lanza.
 * - Los errores se sanean: solo se conserva el `message` de Google, jamás
 *   llaves privadas, assertions ni access tokens.
 * - Rango por defecto: ventana de 28 días que termina en `hoy - 3 días`
 *   (Google publica los datos con 2–3 días de retraso).
 */

import { createSign } from 'node:crypto';

// ── Constantes ──────────────────────────────────────────────────────────────

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const JWT_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites';

const DEFAULT_SITE_URL = 'https://aakbejuco.com/';
export const DEFAULT_SEO_DAYS = 28;
export const SEO_LAG_DAYS = 3;
export const SEO_SNAPSHOT_VERSION = 1;

const REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_SAFETY_MS = 60_000;
const MAX_ERROR_LENGTH = 300;

// ── Tipos del snapshot ──────────────────────────────────────────────────────

export interface SeoMetricRow {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoDailyRow extends SeoMetricRow {
  date: string;
}

export interface SeoQueryRow extends SeoMetricRow {
  query: string;
}

export interface SeoPageRow extends SeoMetricRow {
  page: string;
}

export interface SeoDeviceRow extends SeoMetricRow {
  device: string;
}

export interface SeoSnapshot {
  version: number;
  siteUrl: string;
  range: {
    startDate: string;
    endDate: string;
    days: number;
    lagDays: number;
  };
  totals: SeoMetricRow;
  daily: SeoDailyRow[];
  queries: SeoQueryRow[];
  pages: SeoPageRow[];
  devices: SeoDeviceRow[];
  fetchedAt: string;
}

export interface SeoConfig {
  disabled: boolean;
  hasCredentials: boolean;
  siteUrl: string;
}

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

interface GoogleAnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface GoogleAnalyticsResponse {
  rows?: GoogleAnalyticsRow[];
}

// ── Estado del token (en memoria del proceso) ───────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let cachedCredentialRaw: string | null = null;
let cachedCredentials: ServiceAccountCredentials | null = null;

// ── Configuración ───────────────────────────────────────────────────────────

/** Normaliza la propiedad: por prefijo de URL exige slash final. */
function normalizeSiteUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (value.length === 0) return DEFAULT_SITE_URL;
  if (value.startsWith('sc-domain:')) return value;
  return value.endsWith('/') ? value : `${value}/`;
}

export function getSeoConfig(): SeoConfig {
  const rawCredentials = (process.env['SEARCH_CONSOLE_SA_JSON'] ?? '').trim();
  return {
    disabled: (process.env['SEARCH_CONSOLE_DISABLED'] ?? '').trim() === '1',
    hasCredentials: rawCredentials.length > 0,
    siteUrl: normalizeSiteUrl(process.env['SEARCH_CONSOLE_SITE_URL']),
  };
}

/**
 * Lee la service account desde `SEARCH_CONSOLE_SA_JSON`, aceptando el JSON
 * crudo o su versión en base64. Devuelve `null` si falta o está mal formado.
 */
function readCredentials(): ServiceAccountCredentials | null {
  const raw = (process.env['SEARCH_CONSOLE_SA_JSON'] ?? '').trim();
  if (raw.length === 0) return null;

  if (cachedCredentials && cachedCredentialRaw === raw) return cachedCredentials;

  let jsonText = raw;
  if (!raw.startsWith('{')) {
    try {
      jsonText = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const clientEmail = typeof parsed['client_email'] === 'string' ? parsed['client_email'] : '';
    let privateKey = typeof parsed['private_key'] === 'string' ? parsed['private_key'] : '';
    // En algunas variables de entorno los saltos de línea llegan escapados.
    privateKey = privateKey.replace(/\\n/g, '\n');
    if (clientEmail.length === 0 || privateKey.length === 0) return null;

    cachedCredentialRaw = raw;
    cachedCredentials = { clientEmail, privateKey };
    return cachedCredentials;
  } catch {
    return null;
  }
}

/** Sanea cualquier error antes de guardarlo o devolverlo. */
export function sanitizeSeoError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const withoutSecrets = raw
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '[private-key]')
    .replace(/(ya29\.[\w.-]+)/g, '[token]')
    .replace(/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, '[jwt]')
    .replace(/\s+/g, ' ')
    .trim();
  const message = withoutSecrets.length > 0 ? withoutSecrets : 'Error desconocido';
  return message.slice(0, MAX_ERROR_LENGTH);
}

// ── JWT / OAuth ─────────────────────────────────────────────────────────────

function base64Url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signServiceAccountJwt(credentials: ServiceAccountCredentials): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: credentials.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credentials.privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

export class SeoCredentialsError extends Error {
  constructor() {
    super('missing-credentials');
    this.name = 'SeoCredentialsError';
  }
}

async function requestAccessToken(credentials: ServiceAccountCredentials): Promise<CachedToken> {
  const assertion = signServiceAccountJwt(credentials);
  const body = new URLSearchParams({ grant_type: JWT_GRANT_TYPE, assertion });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(await describeGoogleError(response, 'token'));
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  if (accessToken.length === 0) throw new Error('Google no devolvió access_token');

  const expiresInSeconds = Number(json.expires_in ?? 3600);
  return {
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresInSeconds) * 1000 - TOKEN_SAFETY_MS,
  };
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const credentials = readCredentials();
  if (!credentials) throw new SeoCredentialsError();

  cachedToken = await requestAccessToken(credentials);
  return cachedToken.accessToken;
}

/** Mensaje legible de Google sin exponer cabeceras ni credenciales. */
async function describeGoogleError(response: Response, stage: string): Promise<string> {
  let detail = '';
  try {
    const text = await response.text();
    if (text.length > 0) {
      try {
        const json = JSON.parse(text) as {
          error?: string | { message?: string; status?: string };
          error_description?: string;
        };
        if (typeof json.error === 'string') detail = json.error;
        else if (json.error && typeof json.error.message === 'string') detail = json.error.message;
        if (!detail && typeof json.error_description === 'string') detail = json.error_description;
      } catch {
        detail = text;
      }
    }
  } catch {
    detail = '';
  }

  const statusText = response.statusText ? ` ${response.statusText}` : '';
  const suffix = detail.length > 0 ? `: ${detail}` : '';
  return `Search Console ${stage} falló (${response.status}${statusText})${suffix}`;
}

// ── Consultas ───────────────────────────────────────────────────────────────

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * POST searchAnalytics/query con timeout de 15 s y un reintento en 429/5xx.
 * Un 401 invalida el token cacheado y reintenta con uno nuevo.
 */
async function querySearchConsole(
  siteUrl: string,
  body: Record<string, unknown>,
  attempt = 0,
  forceTokenRefresh = false
): Promise<GoogleAnalyticsRow[]> {
  const token = await getAccessToken(forceTokenRefresh);
  const url = `${API_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.ok) {
    const json = (await response.json()) as GoogleAnalyticsResponse;
    return Array.isArray(json.rows) ? json.rows : [];
  }

  const retriable = response.status === 429 || response.status >= 500;
  const unauthorized = response.status === 401;

  if (attempt === 0 && (retriable || unauthorized)) {
    if (unauthorized) cachedToken = null;
    await delay(retriable ? 750 : 150);
    return querySearchConsole(siteUrl, body, attempt + 1, unauthorized);
  }

  throw new Error(await describeGoogleError(response, 'query'));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toMetricRow(row: GoogleAnalyticsRow): SeoMetricRow {
  const clicks = Math.max(0, Math.round(Number(row.clicks ?? 0)));
  const impressions = Math.max(0, Math.round(Number(row.impressions ?? 0)));
  const rawCtr = Number(row.ctr);
  const rawPosition = Number(row.position);
  return {
    clicks,
    impressions,
    ctr: Number.isFinite(rawCtr) ? round(rawCtr, 6) : impressions > 0 ? round(clicks / impressions, 6) : 0,
    position: Number.isFinite(rawPosition) ? round(rawPosition, 2) : 0,
  };
}

function getKey(row: GoogleAnalyticsRow): string {
  return Array.isArray(row.keys) && typeof row.keys[0] === 'string' ? row.keys[0] : '';
}

// ── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Descarga las cuatro dimensiones (date, query, page, device) y las normaliza
 * en un único payload cacheable. Lanza si Google falla; el llamador decide.
 */
export async function fetchSeoSnapshot(days: number = DEFAULT_SEO_DAYS): Promise<SeoSnapshot> {
  const { siteUrl } = getSeoConfig();
  const windowDays = Math.min(90, Math.max(7, Math.trunc(days) || DEFAULT_SEO_DAYS));

  const endDate = addDays(todayUtc(), -SEO_LAG_DAYS);
  const startDate = addDays(endDate, -(windowDays - 1));

  const baseBody = {
    startDate,
    endDate,
    dataState: 'final',
    type: 'web',
  };

  const [dateRows, queryRows, pageRows, deviceRows] = await Promise.all([
    querySearchConsole(siteUrl, { ...baseBody, dimensions: ['date'], rowLimit: 500 }),
    querySearchConsole(siteUrl, { ...baseBody, dimensions: ['query'], rowLimit: 1000 }),
    querySearchConsole(siteUrl, { ...baseBody, dimensions: ['page'], rowLimit: 1000 }),
    querySearchConsole(siteUrl, { ...baseBody, dimensions: ['device'], rowLimit: 10 }),
  ]);

  const daily: SeoDailyRow[] = dateRows
    .map((row) => ({ date: getKey(row), ...toMetricRow(row) }))
    .filter((row) => row.date.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const queries: SeoQueryRow[] = queryRows
    .map((row) => ({ query: getKey(row), ...toMetricRow(row) }))
    .filter((row) => row.query.length > 0);

  const pages: SeoPageRow[] = pageRows
    .map((row) => ({ page: getKey(row), ...toMetricRow(row) }))
    .filter((row) => row.page.length > 0);

  const devices: SeoDeviceRow[] = deviceRows
    .map((row) => ({ device: getKey(row), ...toMetricRow(row) }))
    .filter((row) => row.device.length > 0);

  return {
    version: SEO_SNAPSHOT_VERSION,
    siteUrl,
    range: {
      startDate,
      endDate,
      days: windowDays,
      lagDays: SEO_LAG_DAYS,
    },
    totals: aggregateTotals(daily),
    daily,
    queries,
    pages,
    devices,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Totales del periodo: suma de clics/impresiones de la serie diaria y
 * posición media ponderada por impresiones (como lo hace Google).
 */
function aggregateTotals(daily: SeoMetricRow[]): SeoMetricRow {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;

  for (const row of daily) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? round(clicks / impressions, 6) : 0,
    position: impressions > 0 ? round(weightedPosition / impressions, 2) : 0,
  };
}
