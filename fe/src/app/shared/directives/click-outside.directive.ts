import { Directive, ElementRef, output, HostListener } from '@angular/core';

@Directive({
  selector: '[clickOutside]',
})
export class ClickOutsideDirective {
  // Se emite al hacer clic fuera del elemento (menús, desplegables) y al presionar Escape.
  clickOutside = output<void>();

  constructor(private elementRef: ElementRef) {}

  /*
  Solo emite si el clic no empezó dentro del elemento: al presionar adentro (por ejemplo, para seleccionar
  texto) y soltar afuera, no se emite.
  */
  private pressStartedInside = false;

  @HostListener('document:mousedown', ['$event'])
  public onMouseDown(event: MouseEvent): void {
    this.pressStartedInside = this.elementRef.nativeElement.contains(
      event.target as Node,
    );
  }

  @HostListener('document:click', ['$event'])
  public onClick(event: MouseEvent): void {
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
  @HostListener('document:keydown.escape')
  public onEscapeKey(): void {
    const activo = document.activeElement;
    if (
      activo instanceof HTMLElement &&
      this.elementRef.nativeElement.contains(activo)
    ) {
      activo.blur();
    }
    this.clickOutside.emit();
  }
}
