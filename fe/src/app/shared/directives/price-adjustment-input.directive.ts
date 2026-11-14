import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[appPriceAdjustmentInput]',
})
export class PriceAdjustmentInputDirective {
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

  // Regex permisiva con coma como decimal (formato europeo/argentino): acepta "-", "1,"
  private readonly VALID_NUMBER_REGEX = /^-?\d*,?\d*$/;

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.specialKeys.includes(event.key)) return;

    // Permitir todas las teclas no imprimibles (F1-F12, Shift, Alt, CapsLock, etc.)
    if (event.key.length > 1) return;

    // Permitir Ctrl/Cmd + a, c, v, x, z
    if (
      (event.ctrlKey || event.metaKey) &&
      ['a', 'c', 'v', 'x', 'z'].includes(event.key.toLowerCase())
    ) {
      return;
    }

    const input = this.el.nativeElement as HTMLInputElement;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;

    // Interceptar punto y convertirlo en coma decimal (formato europeo/argentino)
    if (event.key === '.') {
      event.preventDefault();
      const newVal =
        input.value.substring(0, start) + ',' + input.value.substring(end);
      if (this.VALID_NUMBER_REGEX.test(newVal)) {
        input.value = newVal;
        input.setSelectionRange(start + 1, start + 1);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    const nextVal =
      input.value.substring(0, start) + event.key + input.value.substring(end);

    if (!this.VALID_NUMBER_REGEX.test(nextVal)) {
      event.preventDefault();
    }
  }

  @HostListener('paste')
  onPaste() {
    // No se llama a preventDefault() para cumplir con las buenas prácticas de accesibilidad.
    // La sanitización se aplica sobre el valor resultante en el siguiente tick del event loop.
    // El debounce de 500ms del componente garantiza que la API nunca reciba el valor crudo.
    setTimeout(() => {
      const input = this.el.nativeElement as HTMLInputElement;
      const sanitized = this.sanitize(input.value);
      if (input.value !== sanitized) {
        input.value = sanitized;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 0);
  }

  private sanitize(text: string): string {
    let result = text.trim();

    const lastDot = result.lastIndexOf('.');
    const lastComma = result.lastIndexOf(',');

    if (lastDot !== -1 && lastComma !== -1) {
      // Ambos separadores presentes: el último indica cuál es el decimal
      if (lastComma > lastDot) {
        // Formato europeo: 1.021.238,15 → quitar todos los puntos, coma → punto
        result = result.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato anglosajón: 1,021,238.15 → quitar todas las comas
        result = result.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      // Solo coma: separador decimal → reemplazar por punto (temporal)
      result = result.replace(',', '.');
    } else if (lastDot !== -1) {
      // Solo punto, sin coma: el punto es separador de miles.
      // Si hay exactamente 3 dígitos después del último punto → miles → eliminar todos los puntos.
      // Si hay distinta cantidad → decimal → mantener (se convertirá a coma al final).
      const afterLastDot = result.substring(lastDot + 1);
      if (/^\d{3}$/.test(afterLastDot)) {
        result = result.replace(/\./g, '');
      }
    }
    // Si no hay ningún separador → número entero, sin ambigüedad

    result = result.replace(/[^-\d.]/g, '');

    // Colapsar múltiples puntos residuales (caso de seguridad)
    const parts = result.split('.');
    if (parts.length > 2) {
      result = parts[0] + '.' + parts.slice(1).join('');
    }

    // El punto decimal interno vuelve a coma (formato argentino)
    result = result.replace('.', ',');

    return result;
  }
}
