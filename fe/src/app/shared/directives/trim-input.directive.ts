import { Directive, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/*
Al salir del campo quita los espacios de los extremos y junta los repetidos. Se aplica sola, sin atributo,
a todo input de texto, email o búsqueda y a los textarea.
En los campos de email además pasa el valor a minúsculas mientras se escribe, para que el patrón de email
lo acepte aunque el teclado ponga mayúsculas.
*/
@Directive({
  selector:
    'input[type="text"], input[type="email"], input[type="search"], textarea',
  host: {
    '(input)': 'onInput()',
    '(blur)': 'onBlur()',
  },
})
export class TrimInputDirective {
  private ngControl = inject(NgControl, { optional: true });
  private el =
    inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef)
      .nativeElement;

  /*
  Pasa a minúsculas el valor de un campo de email. Solo reescribe el campo si había alguna mayúscula.
  Los input de tipo email no permiten leer ni fijar la posición del cursor, así que, si la mayúscula
  se escribió en el medio, el cursor queda al final
  */
  protected onInput(): void {
    if (this.el.type !== 'email') return;

    const value = this.el.value;
    const lowerValue = value.toLowerCase();
    if (lowerValue === value) return;

    this.el.value = lowerValue;
    this.ngControl?.control?.setValue(lowerValue, { emitEvent: true });
  }

  // Quita los espacios de los extremos y junta los repetidos
  protected onBlur(): void {
    const value = this.el.value;

    if (value && typeof value === 'string') {
      const trimmedValue = value.trim().replace(/\s{2,}/g, ' ');

      // Sólo se actualiza si realmente hubo cambios, para no relanzar eventos innecesariamente
      if (trimmedValue !== value) {
        this.el.value = trimmedValue;
        if (this.ngControl && this.ngControl.control) {
          // emitEvent hace que se disparen las validaciones correspondientes con el texto limpio
          this.ngControl.control.setValue(trimmedValue, { emitEvent: true });
        }
      }
    }
  }
}
