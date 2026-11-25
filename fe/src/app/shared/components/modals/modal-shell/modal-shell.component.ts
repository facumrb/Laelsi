import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  contentChild,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { NgIconComponent } from '@ng-icons/core';
import { BackdropCloseDirective } from '@shared/directives/backdrop-close.directive';
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';
import { ModalStackService } from '@services/ui/modal-stack.service';
import { ScrollLockService } from '@services/ui/scroll-lock.service';

export type ModalTone = 'neutral' | 'danger' | 'warning' | 'info' | 'success';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type ModalHeight = 'auto' | 'md' | 'full';

const ANCHOS: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-lg md:max-w-xl lg:max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'md:max-w-4xl',
};

const ALTOS: Record<ModalHeight, string> = {
  auto: 'max-h-[90dvh]',
  md: 'h-130 max-h-[85dvh]',
  full: 'h-[95dvh]',
};

const TONOS: Record<ModalTone, string> = {
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  danger: 'bg-red-50 text-red-600 border-red-100/80',
  warning: 'bg-amber-50 text-amber-600 border-amber-100/80',
  info: 'bg-indigo-50 text-brand border-indigo-100',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

let siguienteId = 0;

/*
Estructura común de los modales: fondo con cierre por clic, tarjeta con trampa de foco, header (ícono con tono,
título, subtítulo y X), cuerpo desplazable y pie. El padre lo muestra con un `@if` y lo cierra al recibir `close`:
el shell no se oculta solo.

Contenido proyectado:
- `[modalSubtitle]` (con `ModalSubtitleDirective` importada): subtítulo con contenido propio, debajo del título y
  con su mismo estilo. Si también llega el input `subtitle`, gana el proyectado. Con `modalDescription` en el mismo
  elemento, el subtítulo es además la descripción accesible.
- sin atributo: el cuerpo, que es lo único que se desplaza. Con `flushBody` pierde el padding y el espacio entre
  sus hijos (para una lista que llega a los bordes) y sigue desplazándose.
- `[modalStrip]`: franja fija entre el header y el cuerpo (por ejemplo, un buscador).
- `[modalFooter]`: los botones del pie (o un texto). Si no hay, el pie no se muestra.
- `[modalForm]`: un formulario que envuelve cuerpo y pie sin incluir el header. Adentro se usan las clases
  `modal-body` y `modal-footer` (styles.css) en lugar de las otras dos ranuras. `flushBody` no actúa acá: el
  formulario pone sus propias clases (por ejemplo `modal-body modal-body-flush`).

Alturas en `dvh`, para que con la barra del navegador visible el pie no quede fuera de la pantalla. En pantallas de
480 px de alto o menos (celular apaisado) la tarjeta se desplaza entera: el cuerpo y el formulario crecen con su
contenido en vez de desplazarse solos.

Regla de las ranuras con nombre: Angular decide la ranura por el nodo raíz de cada bloque de control de flujo.
Dentro de un `@if` o `@for` tiene que haber un solo nodo raíz con `modalFooter` (o un envoltorio
`<div modalFooter class="contents">` con los botones adentro). Si el bloque tiene varios nodos raíz, todo va al
cuerpo.

`[modalDescription]` en un elemento del contenido lo enlaza con `aria-describedby`.

Solo el modal de arriba de la pila responde a Escape y al fondo. Con `dismissible` en `false` es bloqueante: sin X,
sin Escape y sin fondo. Con `busy` en `true` no se cierra por ninguna vía. La capa (z-index) la decide la pila:
`--z-modal` el primero, `--z-modal-nested` los de encima, `--z-blocking` los bloqueantes, y lo que se abre sobre un
bloqueante queda por encima de él. Los toasts (`--z-toast`) siguen arriba de todo.
*/
@Component({
  selector: 'app-modal-shell',
  imports: [
    CdkTrapFocus,
    NgIconComponent,
    BackdropCloseDirective,
    CloseModalButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal-shell.component.html',
})
export class ModalShellComponent implements OnInit, OnDestroy {
  private readonly pila = inject(ModalStackService);
  private readonly bloqueoScroll = inject(ScrollLockService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
  readonly tone = input<ModalTone>('neutral');
  readonly size = input<ModalSize>('lg');
  readonly height = input<ModalHeight>('auto');
  readonly tintedHeader = input(false);
  readonly dismissible = input(true);
  readonly busy = input(false);
  readonly lockScroll = input(true);
  readonly flushBody = input(false);

  readonly close = output<void>();

  private readonly n = ++siguienteId;
  readonly titleId = `modal-shell-${this.n}-titulo`;
  readonly descriptionId = `modal-shell-${this.n}-descripcion`;

  private readonly descripciones = signal(0);
  protected readonly describedBy = computed(() =>
    this.descripciones() > 0 ? this.descriptionId : null,
  );

  private readonly subtituloProyectado = contentChild(ModalSubtitleDirective);
  protected readonly subtituloDeTexto = computed(() =>
    this.subtituloProyectado() ? undefined : this.subtitle(),
  );

  private readonly tarjeta =
    viewChild.required<ElementRef<HTMLElement>>('tarjeta');
  private readonly entrada = this.pila.registrar({
    alEscape: () => this.cerrarSiSePuede(),
    bloqueante: () => !this.dismissible(),
  });
  private soltarScroll: (() => void) | null = null;

  protected readonly capaBase = computed(
    () => `var(--z-${this.entrada.capa().base})`,
  );
  protected readonly capaExtra = computed(() =>
    String(this.entrada.capa().extra),
  );
  protected readonly clasesTarjeta = computed(
    () => `${ANCHOS[this.size()]} ${ALTOS[this.height()]}`,
  );
  protected readonly clasesHeader = computed(() =>
    this.tintedHeader() ? 'bg-gray-50/50' : '',
  );
  protected readonly clasesIcono = computed(() => TONOS[this.tone()]);

  ngOnInit(): void {
    if (this.lockScroll())
      this.soltarScroll = this.bloqueoScroll.bloquear(
        () => this.tarjeta().nativeElement,
      );
  }

  ngOnDestroy(): void {
    this.soltarScroll?.();
    this.entrada.liberar();
  }

  // Lo usa ModalDescriptionDirective. Devuelve la función que deshace el registro.
  registrarDescripcion(): () => void {
    this.descripciones.update((n) => n + 1);
    return () => this.descripciones.update((n) => n - 1);
  }

  protected alClicEnElFondo(): void {
    if (this.entrada.esElDeArriba()) this.cerrarSiSePuede();
  }

  protected alClicEnLaX(): void {
    if (!this.busy()) this.close.emit();
  }

  private cerrarSiSePuede(): void {
    if (this.dismissible() && !this.busy()) this.close.emit();
  }
}

/*
Marca el subtítulo proyectado en el header. El shell le da el estilo del subtítulo (el contenido no necesita
clases propias) y, mientras exista, no muestra el input `subtitle`.
*/
@Directive({ selector: '[modalSubtitle]' })
export class ModalSubtitleDirective {}

// Marca el texto que describe el diálogo: el shell lo enlaza con `aria-describedby`.
@Directive({
  selector: '[modalDescription]',
  host: { '[id]': 'shell.descriptionId' },
})
export class ModalDescriptionDirective {
  protected readonly shell = inject(ModalShellComponent);

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.registrarDescripcion());
  }
}
