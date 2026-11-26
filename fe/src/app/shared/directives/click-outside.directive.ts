import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject, output } from '@angular/core';

// Avisa cuando se hace clic fuera del elemento o se presiona Escape. La usan los menús y desplegables para cerrarse
@Directive({
  selector: '[clickOutside]',
  host: {
    '(document:mousedown)': 'onMouseDown($event)',
    '(document:click)': 'onClick($event)',
    '(document:keydown.escape)': 'onEscapeKey()',
  },
})
export class ClickOutsideDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);

  // Se emite al hacer clic fuera del elemento (menús, desplegables) y al presionar Escape.
  clickOutside = output<void>();

  /*
  Solo emite si el clic no empezó dentro del elemento: al presionar adentro (por ejemplo, para seleccionar
  texto) y soltar afuera, no se emite.
  */
  private pressStartedInside = false;

  // Recuerda si la presión empezó dentro del elemento
  protected onMouseDown(event: MouseEvent): void {
    this.pressStartedInside = this.elementRef.nativeElement.contains(
      event.target as Node,
    );
  }

  // Emite si el clic terminó afuera y no había empezado adentro
  protected onClick(event: MouseEvent): void {
    const pressStartedInside = this.pressStartedInside;
    this.pressStartedInside = false;

    const targetElement = event.target as HTMLElement;

    if (!targetElement) {
      return;
    }

    const clickedInside = this.elementRef.nativeElement.contains(targetElement);

    if (!clickedInside && !pressStartedInside) {
      this.clickOutside.emit();
    }
  }

  // Lógica para la tecla Escape
  protected onEscapeKey(): void {
    const activo = this.document.activeElement;
    if (
      activo instanceof HTMLElement &&
      this.elementRef.nativeElement.contains(activo)
    ) {
      activo.blur();
    }
    this.clickOutside.emit();
  }
}
