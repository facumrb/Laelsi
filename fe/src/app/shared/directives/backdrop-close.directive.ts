import { Directive, ElementRef, inject, output } from '@angular/core';

/*
Cierre de un modal al hacer clic en su fondo. Solo emite si el clic empezó y terminó en el
propio fondo: al presionar dentro de la tarjeta (por ejemplo, para seleccionar texto) y soltar
afuera, el modal no se va a cerrar.
*/
@Directive({
  selector: '[backdropClose]',
  host: {
    '(mousedown)': 'onMouseDown($event)',
    '(click)': 'onClick($event)',
  },
})
export class BackdropCloseDirective {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private pressStartedOnBackdrop = false;

  backdropClose = output<void>();

  // Recuerda si la presión empezó en el fondo
  protected onMouseDown(event: MouseEvent) {
    this.pressStartedOnBackdrop = event.target === this.host.nativeElement;
  }

  // Emite si el clic empezó y terminó en el fondo
  protected onClick(event: MouseEvent) {
    const isBackdropClick =
      this.pressStartedOnBackdrop && event.target === this.host.nativeElement;
    this.pressStartedOnBackdrop = false;
    if (isBackdropClick) this.backdropClose.emit();
  }
}
