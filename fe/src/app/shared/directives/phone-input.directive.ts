import { Directive, ElementRef, inject } from '@angular/core';

// Campo de teléfono: acepta dígitos, espacios, guiones y un + inicial, al tipear y al pegar
@Directive({
  selector: '[appPhoneInput]',
  host: {
    '(keydown)': 'onKeyDown($event)',
    '(paste)': 'onPaste()',
  },
})
export class PhoneInputDirective {
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

  // Bloquea las teclas que escribirían un carácter no permitido en un teléfono
  protected onKeyDown(event: KeyboardEvent) {
    if (this.specialKeys.includes(event.key)) return;

    // Permitir todas las teclas no imprimibles (F1-F12, Shift, Alt, CapsLock, etc.)
    if (event.key.length > 1) return;

    // Permitir los atajos con Ctrl/Cmd. Con Alt además es AltGr, que escribe caracteres (por ejemplo @)
    if ((event.ctrlKey || event.metaKey) && !event.altKey) return;

    // El + solo es válido al inicio del campo y si no hay ya uno
    if (event.key === '+') {
      const input = this.el.nativeElement as HTMLInputElement;
      const cursorAtStart = (input.selectionStart ?? 0) === 0;
      const alreadyHasPlus = input.value.startsWith('+');
      if (!cursorAtStart || alreadyHasPlus) event.preventDefault();
      return;
    }

    // Permitir - y espacio en cualquier posición
    if (['-', ' '].includes(event.key)) return;

    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  // Limpia lo pegado y deja solo los caracteres permitidos
  protected onPaste() {
    /*
    No se llama a preventDefault() para cumplir con las buenas prácticas de accesibilidad.
    Se sanitiza el valor resultante en el siguiente tick eliminando caracteres inválidos.
    */
    setTimeout(() => {
      const input = this.el.nativeElement as HTMLInputElement;
      const raw = input.value;
      // El + solo es válido al inicio: se extrae, se limpia el resto y se repone si corresponde
      const hasLeadingPlus = raw.startsWith('+');
      const digits = raw.replace(/[^0-9\-\s]/g, '');
      const sanitized = hasLeadingPlus ? '+' + digits : digits;
      if (raw !== sanitized) {
        input.value = sanitized;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 0);
  }
}
