import {
  Directive,
  ElementRef,
  signal,
  inject,
  DestroyRef,
  afterNextRender,
} from '@angular/core';

const RESPALDO_FIN_DESPLAZAMIENTO_MS = 1000;

// Directiva utilizada para los botones < y > de los carruseles: indica si el carrusel está al principio o al final
@Directive({
  selector: '[appScrollTracker]',
  exportAs: 'scrollTracker',
  host: {
    '(scroll)': 'onScroll()',
    '(scrollend)': 'onScrollEnd()',
    '(window:resize)': 'onResize()',
  },
})
export class ScrollTrackerDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  atStart = signal(true);
  atEnd = signal(false);

  private suspendTracking = false;
  private respaldo?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.respaldo));
    // Después del primer render, cuando el contenido del carrusel ya está pintado (no corre en el prerender)
    afterNextRender(() => this.checkScroll());
  }

  /*
  Los botones fijan el estado al momento del clic (predicción del destino). Mientras dura el desplazamiento
  suave se ignoran los eventos 'scroll' intermedios, que reactivarían la flecha a mitad de camino. La posición
  real se vuelve a leer en 'scrollend', o con el respaldo si el navegador no lo emite o no hubo desplazamiento.
  */
  forceState(isAtStart: boolean, isAtEnd: boolean) {
    this.atStart.set(isAtStart);
    this.atEnd.set(isAtEnd);

    this.suspendTracking = true;
    clearTimeout(this.respaldo);
    this.respaldo = setTimeout(
      () => this.finishForced(),
      RESPALDO_FIN_DESPLAZAMIENTO_MS,
    );
  }

  protected onScroll() {
    this.checkScroll();
  }

  protected onScrollEnd() {
    this.finishForced();
  }

  protected onResize() {
    this.checkScroll();
  }

  private finishForced() {
    clearTimeout(this.respaldo);
    this.suspendTracking = false;
    this.checkScroll();
  }

  // Lee la posición real del carrusel y actualiza atStart y atEnd
  checkScroll() {
    if (this.suspendTracking) return;

    const element = this.el.nativeElement;
    // Margen de tolerancia de 5px en el principio y el final, por errores de redondeo de renderización
    this.atStart.set(element.scrollLeft <= 5);
    this.atEnd.set(
      Math.ceil(element.scrollLeft + element.clientWidth) >=
        element.scrollWidth - 5,
    );
  }
}
