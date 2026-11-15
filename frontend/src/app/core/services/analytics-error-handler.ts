import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';

/**
 * AnalyticsErrorHandler — reporta errores JS no capturados a la ingesta de
 * métricas propias (`js_error`) sin Sentry ni datos personales.
 *
 * `AnalyticsService` se resuelve de forma perezosa con `Injector` dentro de
 * `handleError`: si se inyectara en el constructor se crearía un ciclo
 * ErrorHandler → AnalyticsService → Router → ErrorHandler y la app no
 * arrancaría. Nunca se relanza el error: Angular lo considera no manejado y
 * volvería a entrar en un bucle.
 */
@Injectable()
export class AnalyticsErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);

  handleError(error: unknown): void {
    try {
      console.error(error);
    } catch {
      // console puede no estar disponible en entornos raros.
    }

    try {
      const analytics = this.injector.get(AnalyticsService);
      analytics.track('js_error', {
        meta: {
          message: this.message(error),
          stack: this.stack(error),
        },
      });
    } catch {
      // Un fallo al reportar nunca debe romper la app ni recursar.
    }
  }

  private message(error: unknown): string {
    try {
      if (error instanceof Error && typeof error.message === 'string' && error.message.length > 0) {
        return error.message.slice(0, 200);
      }
      const text = typeof error === 'string' ? error : String(error);
      return text.length > 0 ? text.slice(0, 200) : 'Error desconocido';
    } catch {
      return 'Error desconocido';
    }
  }

  /** Solo las 3 primeras líneas del stack: suficiente para agrupar. */
  private stack(error: unknown): string {
    try {
      if (!(error instanceof Error) || typeof error.stack !== 'string') return '';
      return error.stack.split('\n').slice(0, 3).join('\n').slice(0, 512);
    } catch {
      return '';
    }
  }
}
