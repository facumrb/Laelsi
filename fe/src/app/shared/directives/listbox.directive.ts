import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, output } from '@angular/core';

/**
 * Teclado de los desplegables hechos a mano (estado, categoría, condición fiscal, regla de redondeo...).
 *
 * Antes las opciones eran <li> o <div> con clic: quien usa teclado o lector de pantalla no podía elegirlas. Va en el
 * contenedor de las opciones, que se marcan con role="option" tabindex="-1" y aria-selected:
 *
 *   <ul appListbox (closed)="menuAbierto.set(false)">
 *     <li role="option" tabindex="-1" [attr.aria-selected]="elegida" (click)="elegir()">…</li>
 *
 * - Al abrirse, el foco va a la opción elegida (o a la primera).
 * - Flechas arriba y abajo, Inicio y Fin mueven el foco; Enter y Espacio eligen (disparan el clic de la opción).
 * - Escape y Tab piden cerrar la lista (`closed`). Escape no se propaga: cierra la lista y nada más.
 * - Al cerrarse con el foco adentro, el foco vuelve al botón que la abrió; con el foco en otro lado (un clic afuera) no
 *   se lo roba.
 */
@Directive({
  selector: '[appListbox]',
  host: {
    role: 'listbox',
    '(keydown)': 'alTeclear($event)',
    '(focusin)': 'focoAdentro = true',
    '(focusout)': 'alPerderElFoco($event)',
  },
})
export class ListboxDirective implements AfterViewInit, OnDestroy {
  private lista = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Se pide cerrar la lista (Escape o Tab). */
  readonly closed = output<void>();

  protected focoAdentro = false;
  private disparador: HTMLElement | null = document.activeElement as HTMLElement | null;

  ngAfterViewInit(): void {
    const opciones = this.opciones();
    const inicial = opciones.find((o) => o.getAttribute('aria-selected') === 'true') ?? opciones[0];
    inicial?.focus();
  }

  ngOnDestroy(): void {
    // Solo si el foco estaba en la lista (se eligió una opción): vuelve al botón. Si la persona hizo clic en otro lado,
    // el foco ya está donde ella lo puso.
    if (this.focoAdentro && this.disparador?.isConnected) this.disparador.focus();
  }

  protected alPerderElFoco(evento: FocusEvent): void {
    if (!this.lista.contains(evento.relatedTarget as Node | null)) this.focoAdentro = false;
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const opciones = this.opciones();
    // La opción que recibió la tecla (-1 si fue otra cosa de la lista, por ejemplo un botón)
    const actual = opciones.indexOf((evento.target as HTMLElement).closest('[role="option"]') as HTMLElement);

    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        opciones[Math.min(actual + 1, opciones.length - 1)]?.focus();
        break;
      case 'ArrowUp':
        evento.preventDefault();
        opciones[Math.max(actual - 1, 0)]?.focus();
        break;
      case 'Home':
        evento.preventDefault();
        opciones[0]?.focus();
        break;
      case 'End':
        evento.preventDefault();
        opciones[opciones.length - 1]?.focus();
        break;
      case 'Enter':
      case ' ':
        // Solo si el foco está en una opción: un botón dentro de la lista tiene que seguir funcionando con Enter
        if (actual < 0) break;
        evento.preventDefault();
        opciones[actual].click();
        break;
      case 'Escape':
        // Cierra solo la lista: si llegara al documento, el `clickOutside` le sacaría el foco al elemento activo (el
        // foco no volvería al botón) y el modal que contiene la lista también se cerraría, con lo que se haya tipeado.
        evento.preventDefault();
        evento.stopPropagation();
        this.closed.emit();
        break;
      case 'Tab':
        this.closed.emit();
        break;
    }
  }

  private opciones(): HTMLElement[] {
    return Array.from(this.lista.querySelectorAll<HTMLElement>('[role="option"]'));
  }
}
