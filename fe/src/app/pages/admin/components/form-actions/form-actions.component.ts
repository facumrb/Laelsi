import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';

/*
Pie de los formularios del panel: "Cancelar" y el botón de envío.
El botón es type="submit": como queda dentro del <form> del padre, dispara su ngSubmit.
*/
@Component({
  selector: 'app-form-actions',
  host: { class: 'block' },
  templateUrl: './form-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormActionsComponent {
  private router = inject(Router);

  // Texto del botón de envío
  submitLabel = input.required<string>();

  // Deshabilita el botón de envío
  submitDisabled = input<boolean>(false);

  // Clases extra del botón de envío
  submitClass = input<string>('px-8');

  // Ruta de "Cancelar"; si es null, se emite cancelClick
  cancelUrl = input<string | null>(null);

  // Deshabilita "Cancelar"
  cancelDisabled = input<boolean>(false);

  // Se emite al tocar "Cancelar" cuando no hay cancelUrl
  cancelClick = output<void>();

  // Con cancelUrl navega ahí (navigateByUrl respeta la query, si la trae); si no, avisa al padre
  onCancel() {
    const url = this.cancelUrl();
    if (url) {
      this.router.navigateByUrl(url);
    } else {
      this.cancelClick.emit();
    }
  }
}
