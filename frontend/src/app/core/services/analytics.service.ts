import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';
import { SessionService } from './session.service';

/**
 * AnalyticsService — captura propia de tráfico y comportamiento del catálogo.
 *
 * Sin cookies nuevas, sin GA4 y sin PII: el único identificador es el UUID de
 * `SessionService` (localStorage `aak_session_id`). Todo es fire-and-forget:
 * cualquier fallo de red o de entorno se traga y nunca rompe la UI.
 */

const API_BASE = 'https://aakonline-production.up.railway.app/api';
const SESSION_KEY = 'aak_metrics_session';
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min de inactividad
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 20;
const MAX_QUEUE = 100;

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'category_view'
  | 'add_to_quote'
  | 'quote_open'
  | 'pdf_download'
  | 'contact_click'
  | 'shipping_calc'
  | 'search'
  | 'wishlist_add'
  | 'js_error'
  | 'web_vital';

export interface TrackOptions {
  /** Ruta a reportar; por defecto la ruta actual del navegador. */
  path?: string;
  productId?: number;
  categoryId?: number;
  value?: number;
  meta?: Record<string, unknown>;
}

interface QueuedEvent {
  type: AnalyticsEventType;
  path: string;
  productId?: number;
  categoryId?: number;
  visitorId: string;
  sessionId?: string;
  referrerHost?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  value?: number;
  meta?: Record<string, unknown>;
}

const EVENT_TYPES = new Set<string>([
  'page_view',
  'product_view',
  'category_view',
  'add_to_quote',
  'quote_open',
  'pdf_download',
  'contact_click',
  'shipping_calc',
  'search',
  'wishlist_add',
  'js_error',
  'web_vital',
]);

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);

  private initialized = false;
  private disabled = false;
  private queue: QueuedEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Arranca el tracking. Idempotente y fail-safe. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      if (!this.isSupported() || this.doNotTrack()) {
        this.disabled = true;
        return;
      }

      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => this.trackPageView(event.urlAfterRedirects));

      window.addEventListener('pagehide', this.onPageHide);
      document.addEventListener('visibilitychange', this.onVisibilityChange);

      this.timer = setInterval(() => this.flush(false), FLUSH_INTERVAL_MS);

      this.initVitals();
    } catch {
      this.disabled = true;
    }
  }

  /**
   * Registra un evento. Nunca lanza, nunca bloquea y nunca espera la red.
   */
  track(type: AnalyticsEventType, options: TrackOptions = {}): void {
    try {
      if (this.disabled || !EVENT_TYPES.has(type) || !this.isSupported()) return;
      if (this.doNotTrack()) return;

      this.queue.push(this.buildEvent(type, options));
      if (this.queue.length > MAX_QUEUE) {
        this.queue.splice(0, this.queue.length - MAX_QUEUE);
      }
      if (this.queue.length >= MAX_BATCH) this.flush(false);
    } catch {
      // Nunca romper la UI por métricas.
    }
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private readonly onPageHide = (): void => this.flush(true);

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.flush(true);
  };

  private isSupported(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private doNotTrack(): boolean {
    try {
      return typeof navigator !== 'undefined' && navigator.doNotTrack === '1';
    } catch {
      return false;
    }
  }

  /**
   * Core Web Vitals reales del navegador. Un evento `web_vital` por métrica con
   * `value` en ms (LCP/INP) o número (CLS) y `meta.metric = lcp|inp|cls`.
   * `/admin` se excluye igual que en `page_view` para no mezclar el panel con
   * la tienda en el p75.
   */
  private initVitals(): void {
    try {
      const report = (metric: Metric): void => {
        const path = this.currentPath();
        if (path.startsWith('/admin')) return;

        this.track('web_vital', {
          path,
          value: metric.name === 'CLS' ? metric.value : Math.round(metric.value),
          meta: { metric: metric.name.toLowerCase(), rating: metric.rating },
        });
      };

      onLCP(report);
      onINP(report);
      onCLS(report);
    } catch {
      // Los vitals son opcionales: nunca bloquean el arranque.
    }
  }

  private trackPageView(url: string): void {
    try {
      const path = (url ?? '').split('?')[0].split('#')[0];
      if (!path || path.startsWith('/admin')) return;
      this.track('page_view', { path });
    } catch {
      // ignore
    }
  }

  private buildEvent(type: AnalyticsEventType, options: TrackOptions): QueuedEvent {
    const event: QueuedEvent = {
      type,
      path: this.currentPath(options.path),
      visitorId: this.sessionService.getSessionId(),
      sessionId: this.currentSessionId(),
      device: this.device(),
    };

    const referrerHost = this.referrerHost();
    if (referrerHost) event.referrerHost = referrerHost;

    if (typeof options.productId === 'number' && Number.isFinite(options.productId)) {
      event.productId = Math.trunc(options.productId);
    }
    if (typeof options.categoryId === 'number' && Number.isFinite(options.categoryId)) {
      event.categoryId = Math.trunc(options.categoryId);
    }
    if (typeof options.value === 'number' && Number.isFinite(options.value)) {
      event.value = options.value;
    }
    if (options.meta && typeof options.meta === 'object') {
      event.meta = options.meta;
    }

    return event;
  }

  private currentPath(override?: string): string {
    try {
      const raw = override ?? window.location.pathname;
      const path = String(raw ?? '/').split('?')[0].split('#')[0] || '/';
      return path.slice(0, 300);
    } catch {
      return '/';
    }
  }

  /** sessionId con expiración de 30 min de inactividad (sessionStorage). */
  private currentSessionId(): string | undefined {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: unknown; ts?: unknown };
        if (
          typeof parsed.id === 'string' &&
          parsed.id.length > 0 &&
          typeof parsed.ts === 'number' &&
          Date.now() - parsed.ts < SESSION_IDLE_MS
        ) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, ts: Date.now() }));
          return parsed.id;
        }
      }

      const id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
      return id;
    } catch {
      return undefined;
    }
  }

  private referrerHost(): string | undefined {
    try {
      const referrer = document.referrer;
      if (!referrer) return undefined;
      const host = new URL(referrer).hostname;
      return host ? host.slice(0, 120) : undefined;
    } catch {
      return undefined;
    }
  }

  private device(): 'mobile' | 'tablet' | 'desktop' {
    try {
      const width = window.innerWidth;
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    } catch {
      return 'desktop';
    }
  }

  /**
   * Vacía la cola. Al salir de la página usa sendBeacon (text/plain, request
   * simple sin preflight); en el resto de casos usa fetch keepalive.
   */
  private flush(onExit: boolean): void {
    try {
      if (this.queue.length === 0) return;

      const batch = this.queue.splice(0, Math.min(this.queue.length, MAX_BATCH));
      const payload = JSON.stringify({ events: batch });

      if (onExit && this.sendBeacon(payload)) return;

      void fetch(`${API_BASE}/metrics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // ignore
    }
  }

  private sendBeacon(payload: string): boolean {
    try {
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
      const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
      return navigator.sendBeacon(`${API_BASE}/metrics/events`, blob);
    } catch {
      return false;
    }
  }

  /** Permite liberar el intervalo en pruebas o en SSR. */
  dispose(): void {
    try {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      window.removeEventListener('pagehide', this.onPageHide);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    } catch {
      // ignore
    }
  }
}
