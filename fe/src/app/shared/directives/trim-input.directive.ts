import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

// Al salir del campo quita los espacios de los extremos y junta los repetidos. Se aplica sola, sin atributo,
// a todo input de texto, email o búsqueda y a los textarea.

@Directive({
  selector:
    'input[type="text"], input[type="email"], input[type="search"], textarea',
})
export class TrimInputDirective {
  private ngControl = inject(NgControl, { optional: true });
  private el = inject(ElementRef);

  @HostListener('blur')
  onBlur(): void {
    const value = this.el.nativeElement.value;

    if (value && typeof value === 'string') {
      const trimmedValue = value.trim().replace(/\s{2,}/g, ' ');

      // Sólo actualizamos si realmente hubo cambios para evitar ciclos o re-lanzar eventos innecesariamente
      if (trimmedValue !== value) {
        this.el.nativeElement.value = trimmedValue;
        if (this.ngControl && this.ngControl.control) {
          // emitEvent hace que se disparen las validaciones correspondientes con el string limpio
          this.ngControl.control.setValue(trimmedValue, { emitEvent: true });
        }
      }
    }
  }
}
