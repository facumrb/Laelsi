import { Directive, ElementRef, inject } from '@angular/core';

// Campo de ajuste de precios: un número con signo opcional y coma decimal, al tipear y al pegar
@Directive({
  selector: '[appPriceAdjustmentInput]',
  host: {
    '(keydown)': 'onKeyDown($event)',
    '(paste)': 'onPaste()',
  },
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

  // Bloquea las teclas que dejarían un número inválido y convierte el punto en coma
  protected onKeyDown(event: KeyboardEvent) {
    if (this.specialKeys.includes(event.key)) return;

    // Permitir todas las teclas no imprimibles (F1-F12, Shift, Alt, CapsLock, etc.)
    if (event.key.length > 1) return;

    // Permitir los atajos con Ctrl/Cmd. Con Alt además es AltGr, que escribe caracteres (por ejemplo @)
    if ((event.ctrlKey || event.metaKey) && !event.altKey) return;

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

  // Limpia lo pegado y lo deja con el formato del campo
  protected onPaste() {
    /*
    No se llama a preventDefault() para cumplir con las buenas prácticas de accesibilidad.
    La sanitización se aplica sobre el valor resultante en el siguiente tick del event loop.
    El debounce de 500ms del componente garantiza que la API nunca reciba el valor crudo.
    */
    setTimeout(() => {
      const input = this.el.nativeElement as HTMLInputElement;
      const sanitized = this.sanitize(input.value);
      if (input.value !== sanitized) {
        input.value = sanitized;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 0);
  }

  // Convierte un número pegado (con separadores de miles y decimales en cualquier formato) al formato del campo
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
      /*
      Solo punto, sin coma: es ambiguo.
      Si hay exactamente 3 dígitos después del último punto, se toma como separador de miles y se eliminan todos los puntos.
      Si hay otra cantidad, se toma como decimal y se mantiene (se convierte a coma al final).
      */
      const afterLastDot = result.substring(lastDot + 1);
      if (/^\d{3}$/.test(afterLastDot)) {
        result = result.replace(/\./g, '');
      }
    }
    // Si no hay ningún separador → número entero, sin ambigüedad

    // El signo menos solo vale al inicio: se extrae, se limpia el resto y se repone si corresponde
    const isNegative = result.startsWith('-');
    result = (isNegative ? '-' : '') + result.replace(/[^\d.]/g, '');

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
