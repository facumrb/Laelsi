import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Hace que un elemento que no es un botón pero se usa como uno (el nombre de un cliente que abre su ficha, una fila
 * que abre el detalle de un pedido) pueda alcanzarse y activarse con el teclado: rol de botón, entra en el orden de
 * tabulación y Enter o Espacio disparan su clic, así que el `(click)` que ya tiene sigue siendo la única acción.
 *
 * Preferí un <button> real cuando el diseño lo permite; esto es para donde cambiar la etiqueta rompería el diseño.
 */
@Directive({
  selector: '[appActivable]',
  host: {
    role: 'button',
    tabindex: '0',
    '(keydown.enter)': 'activar($event)',
    '(keydown.space)': 'activar($event)',
  },
})
export class ActivableDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected activar(evento: Event): void {
    // El Espacio no tiene que desplazar la página; el Enter no tiene que enviar un formulario por debajo
    evento.preventDefault();
    this.el.click();
  }
}
