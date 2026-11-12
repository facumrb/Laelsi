import { Directive, ElementRef, output, HostListener } from '@angular/core';

@Directive({
  selector: '[clickOutside]',
})
export class ClickOutsideDirective {
  // Este evento se emitirá cuando el usuario haga clic fuera del menu
  clickOutside = output<void>();

  constructor(private elementRef: ElementRef) {}

  /*
  Cierre de un modal al hacer clic en su fondo. Solo emite si el clic empezó y terminó en el
  propio fondo: al presionar dentro de la tarjeta (por ejemplo, para seleccionar texto) y soltar
  afuera, el modal no se va a cerrar.
  */
  private pressStartedInside = false;

  @HostListener('document:mousedown', ['$event'])
  public onMouseDown(event: MouseEvent): void {
    this.pressStartedInside = this.elementRef.nativeElement.contains(
      event.target as Node,
    );
  }

  // Escuchamos todos los clics del documento
  @HostListener('document:click', ['$event'])
  public onClick(event: MouseEvent): void {
    const pressStartedInside = this.pressStartedInside;
    this.pressStartedInside = false;

    // Convertimos explícitamente el target a un HTMLElement
    const targetElement = event.target as HTMLElement;

    // Verificación de seguridad (por si el target es nulo)
    if (!targetElement) {
      return;
    }

    // Si el elemento donde pusimos la directiva NO contiene al elemento clickeado...
    const clickedInside = this.elementRef.nativeElement.contains(targetElement);

    if (!clickedInside && !pressStartedInside) {
      // ... entonces fue un clic afuera. Emitimos el evento.
      this.clickOutside.emit();
    }
  }

  // 2. Lógica para la tecla Escape (Teclado)
  @HostListener('document:keydown.escape')
  public onEscapeKey(): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.clickOutside.emit();
  }
}
