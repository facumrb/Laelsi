import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { environment } from 'src/environments/environment';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Parte de la API global de Turnstile que usa este componente. */
interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Tamaño del widget según el ancho de la ventana (ID 64, hallazgo 6).
 *
 * Según la documentación de Cloudflare: `normal` mide 300×65 px, `flexible` ocupa el 100 % con un mínimo de 300 px y
 * `compact` mide 150×140 px. En un celular de 320 o 360 px el contenido de una tarjeta mide 222 o 262 px, así que
 * `normal` sobresale y `flexible` tampoco entra (su mínimo es 300): solo `compact` cabe. El tamaño se pasa al dibujar el
 * widget y la documentación no dice que se pueda cambiar después, por eso se decide una sola vez, al dibujarlo.
 */
export const ANCHO_DESDE_EL_QUE_ENTRA_EL_NORMAL = 400;

export function elegirTamanoDelWidget(anchoDeVentana: number): 'normal' | 'compact' {
  return anchoDeVentana < ANCHO_DESDE_EL_QUE_ENTRA_EL_NORMAL ? 'compact' : 'normal';
}

// El script se carga una sola vez, la primera vez que hace falta
let scriptLoading: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Se permite reintentar en el próximo uso
      scriptLoading = null;
      reject(new Error('No se pudo cargar Cloudflare Turnstile'));
    };
    document.head.appendChild(script);
  });

  return scriptLoading;
}

/**
 * Widget anti-bots de Cloudflare Turnstile.
 *
 * Verifica en segundo plano que quien usa la página es una persona y emite un
 * token. Ese token se envía al backend junto con la operación a proteger, y el
 * backend lo valida contra Cloudflare antes de ejecutarla.
 *
 * El token sirve UNA sola vez: después de usarlo hay que llamar a reset().
 */
@Component({
  selector: 'app-turnstile',
  // Bloque: un elemento personalizado es en línea por defecto y el espacio de `space-y-*` del formulario no se aplica
  host: { class: 'block' },
  template: `<div #container class="flex justify-center"></div>`,
})
export class TurnstileComponent implements AfterViewInit, OnDestroy {
  // Emite el token cuando la verificación termina, o null si venció o falló
  tokenChange = output<string | null>();

  private container = viewChild.required<ElementRef<HTMLElement>>('container');
  private widgetId: string | null = null;
  private destroyed = false;

  async ngAfterViewInit(): Promise<void> {
    // Sin clave configurada (desarrollo local) el widget no se muestra
    if (!environment.turnstileSiteKey) return;

    try {
      await loadTurnstileScript();
    } catch {
      this.tokenChange.emit(null);
      return;
    }

    // El componente pudo destruirse mientras se descargaba el script
    if (this.destroyed || !window.turnstile) return;

    this.widgetId = window.turnstile.render(this.container().nativeElement, {
      sitekey: environment.turnstileSiteKey,
      size: elegirTamanoDelWidget(window.innerWidth),
      callback: (token: string) => this.tokenChange.emit(token),
      'expired-callback': () => this.tokenChange.emit(null),
      'error-callback': () => this.tokenChange.emit(null),
    });
  }

  /** Pide un token nuevo. Hay que llamarlo después de cada intento de uso. */
  reset(): void {
    this.tokenChange.emit(null);
    if (this.widgetId && window.turnstile) {
      window.turnstile.reset(this.widgetId);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId && window.turnstile) {
      window.turnstile.remove(this.widgetId);
    }
  }
}
