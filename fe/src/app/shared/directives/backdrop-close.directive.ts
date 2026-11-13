import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  output,
} from '@angular/core';

/*
 Cierre de un modal al hacer clic en su fondo. Solo emite si el clic empezó y terminó en el
 propio fondo: al presionar dentro de la tarjeta (por ejemplo, para seleccionar texto) y soltar
 afuera, el modal no se va a cerrar.
*/
@Directive({
  selector: '[backdropClose]',
})
export class BackdropCloseDirective {
  private host = inject(ElementRef<HTMLElement>);
  private pressStartedOnBackdrop = false;

  backdropClose = output<void>();

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.pressStartedOnBackdrop = event.target === this.host.nativeElement;
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    const isBackdropClick =
      this.pressStartedOnBackdrop && event.target === this.host.nativeElement;
    this.pressStartedOnBackdrop = false;
    if (isBackdropClick) this.backdropClose.emit();
  }
}
