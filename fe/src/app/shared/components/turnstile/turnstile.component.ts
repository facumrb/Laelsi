import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { environment } from 'src/environments/environment';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Parte de la API global de Turnstile que usa este componente.
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

/*
Tamaño del widget según el ancho que tiene disponible (el de su contenedor, no el de la ventana).

Según la documentación de Cloudflare: `normal` mide 300×65 px y `compact` 150×140 px. Desde 300 px se usa `normal`,
centrada y sin estirarse. Con menos de 300 px solo entra `compact`: pasa en un celular de 320 px o en una columna
angosta. El tamaño se pasa al dibujar el widget y la documentación no dice que se pueda cambiar después, por eso se
decide una sola vez, al dibujarlo.
*/
export const ANCHO_DEL_WIDGET_NORMAL = 300;

export function elegirTamanoDelWidget(
  anchoDisponible: number,
): 'normal' | 'compact' {
  return anchoDisponible < ANCHO_DEL_WIDGET_NORMAL ? 'compact' : 'normal';
}

// Alto de cada tamaño del widget, según la documentación de Cloudflare
export const ALTO_DEL_WIDGET = { normal: 65, compact: 140 } as const;

// Alto que se reserva para que el formulario no salte cuando aparece el widget
export function altoReservado(tamano: 'normal' | 'compact'): number {
  return ALTO_DEL_WIDGET[tamano];
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

/*
Widget anti-bots de Cloudflare Turnstile.

Verifica en segundo plano que quien usa la página es una persona y emite un
token. Ese token se envía al backend junto con la operación a proteger, y el
backend lo valida contra Cloudflare antes de ejecutarla.

El token sirve UNA sola vez: después de usarlo hay que llamar a reset().
*/
@Component({
  selector: 'app-turnstile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Bloque: un elemento personalizado es en línea por defecto y el espacio de `space-y-*` del formulario no se aplica
  host: { class: 'block', '[style.min-height.px]': 'alto()' },
  templateUrl: './turnstile.component.html',
})
export class TurnstileComponent {
  // Emite el token cuando la verificación termina, o null si venció o falló
  tokenChange = output<string | null>();

  private container = viewChild.required<ElementRef<HTMLElement>>('container');
  // Tamaño con el que se dibuja el widget (y el alto que se le reserva)
  private tamano = signal<'normal' | 'compact'>('normal');
  protected alto = computed(() => altoReservado(this.tamano()));
  private widgetId: string | null = null;
  private destroyed = false;

  constructor() {
    // Solo en el navegador: el script y el widget usan window y document
    afterNextRender(() => this.dibujar());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.widgetId && window.turnstile)
        window.turnstile.remove(this.widgetId);
    });
  }

  // Pide un token nuevo. Hay que llamarlo después de cada intento de uso.
  reset(): void {
    this.tokenChange.emit(null);
    if (this.widgetId && window.turnstile) {
      window.turnstile.reset(this.widgetId);
    }
  }

  // Carga el script de Cloudflare (si hace falta) y dibuja el widget en el contenedor
  private async dibujar(): Promise<void> {
    // Sin clave configurada el widget no se muestra (las pantallas tampoco lo exigen)
    if (!environment.turnstileSiteKey) return;

    // Se decide antes de bajar el script para reservar el alto definitivo cuanto antes
    const contenedor = this.container().nativeElement;
    this.tamano.set(elegirTamanoDelWidget(contenedor.clientWidth));

    try {
      await loadTurnstileScript();
    } catch {
      this.tokenChange.emit(null);
      return;
    }

    // El componente pudo destruirse mientras se descargaba el script
    if (this.destroyed || !window.turnstile) return;

    this.widgetId = window.turnstile.render(contenedor, {
      sitekey: environment.turnstileSiteKey,
      size: this.tamano(),
      // El sitio no tiene modo oscuro: con 'auto' el widget saldría oscuro en una tarjeta blanca
      theme: 'light',
      language: 'es',
      callback: (token: string) => this.tokenChange.emit(token),
      'expired-callback': () => this.tokenChange.emit(null),
      'error-callback': () => this.tokenChange.emit(null),
    });
  }
}
