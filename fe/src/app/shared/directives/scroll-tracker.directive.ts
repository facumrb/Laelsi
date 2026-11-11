import {
  Directive,
  ElementRef,
  HostListener,
  signal,
  inject,
  AfterViewInit,
  DestroyRef,
} from '@angular/core';

// Directiva utilizada para los botones < y > de los carruseles

const RESPALDO_FIN_DESPLAZAMIENTO_MS = 1000;

@Directive({
  selector: '[appScrollTracker]',
  exportAs: 'scrollTracker',
})
export class ScrollTrackerDirective implements AfterViewInit {
  private el = inject(ElementRef<HTMLElement>);

  atStart = signal(true);
  atEnd = signal(false);

  private suspendTracking = false;
  private respaldo?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.respaldo));
  }

  ngAfterViewInit() {
    // Timeout para asegurar que el contenido dentro del carrusel ya ha sido pintado
    setTimeout(() => this.checkScroll(), 0);
  }

  // Los botones fijan el estado al momento del clic (predicción del destino). Mientras dura el desplazamiento
  // suave se ignoran los eventos 'scroll' intermedios, que reactivarían la flecha a mitad de camino; la posición
  // real se vuelve a leer en 'scrollend', o con el respaldo si el navegador no lo emite o no hubo desplazamiento.
  forceState(isAtStart: boolean, isAtEnd: boolean) {
    this.atStart.set(isAtStart);
    this.atEnd.set(isAtEnd);

    this.suspendTracking = true;
    clearTimeout(this.respaldo);
    this.respaldo = setTimeout(() => this.finishForced(), RESPALDO_FIN_DESPLAZAMIENTO_MS);
  }

  @HostListener('scroll')
  onScroll() {
    this.checkScroll();
  }

  @HostListener('scrollend')
  onScrollEnd() {
    this.finishForced();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScroll();
  }

  private finishForced() {
    clearTimeout(this.respaldo);
    this.suspendTracking = false;
    this.checkScroll();
  }

  checkScroll() {
    if (this.suspendTracking) return;

    const element = this.el.nativeElement;
    // Agregamos en start y end un margen de tolerancia de 5px para errores de redondeo de renderización
    this.atStart.set(element.scrollLeft <= 5);
    this.atEnd.set(
      Math.ceil(element.scrollLeft + element.clientWidth) >=
        element.scrollWidth - 5,
    );
  }
}
