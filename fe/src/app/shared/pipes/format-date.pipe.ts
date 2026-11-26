import { Pipe, PipeTransform, inject, LOCALE_ID } from '@angular/core';
import { formatDate } from '@angular/common';

// Fecha y hora en formato dd/MM/yyyy - HH:mm. Sin valor muestra un guion
@Pipe({
  name: 'formatDatePipe',
})
export class FormatDatePipe implements PipeTransform {
  private locale = inject(LOCALE_ID);

  transform(value: string | Date | null): string {
    if (!value) return '-';

    return formatDate(value, 'dd/MM/yyyy - HH:mm', this.locale) || '-';
  }
}
