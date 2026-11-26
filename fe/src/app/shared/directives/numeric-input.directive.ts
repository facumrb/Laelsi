import { Directive, ElementRef, inject } from '@angular/core';

// Campo que solo acepta dígitos del 0 al 9, al tipear y al pegar
@Directive({
  selector: '[appNumericInput]',
  host: {
    '(keydown)': 'onKeyDown($event)',
    '(paste)': 'onPaste()',
  },
})
export class NumericInputDirective {
  private el = inject(ElementRef);

  private readonly specialKeys = [
    'Backspace',
    'Tab',
    'End',
    'Home',
    'ArrowLeft',
    'ArrowRight',
    'Delete',
    'Enter',
    'Escape',
  ];

  // Bloquea las teclas que escribirían algo que no es un dígito
  protected onKeyDown(event: KeyboardEvent) {
    if (this.specialKeys.includes(event.key)) return;

    // Permitir todas las teclas no imprimibles (F1-F12, Shift, Alt, CapsLock, etc.)
    if (event.key.length > 1) return;

    // Permitir los atajos con Ctrl/Cmd. Con Alt además es AltGr, que escribe caracteres (por ejemplo @)
    if ((event.ctrlKey || event.metaKey) && !event.altKey) return;

    // Bloquear cualquier carácter que no sea dígito del 0 al 9
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  // Limpia lo pegado y deja solo los dígitos
  protected onPaste() {
    /*
    No se llama a preventDefault() para cumplir con las buenas prácticas de accesibilidad.
    Se sanitiza el valor resultante en el siguiente tick eliminando todo lo que no sea dígito.
    */
    setTimeout(() => {
      const input = this.el.nativeElement as HTMLInputElement;
      const sanitized = input.value.replace(/[^0-9]/g, '');
      if (input.value !== sanitized) {
        input.value = sanitized;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 0);
  }
}
