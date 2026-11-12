import { Component, input, model } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapEye, bootstrapEyeSlash } from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-password-toggle-button',
  imports: [NgIconComponent],
  viewProviders: [
    provideIcons({
      bootstrapEye,
      bootstrapEyeSlash,
    }),
  ],
  templateUrl: './password-toggle-button.component.html',
  // Espacio fijo aunque el botón no se muestre, para que el ícono de las extensiones no se mueva al escribir
  host: { class: 'flex w-10 shrink-0 items-center justify-center' },
})
export class PasswordToggleButtonComponent {
  // Indica si la contraseña está actualmente visible (texto) o no (password).

  visible = model.required<boolean>();

  // Determina si se debe mostrar el botón. Útil para ocultarlo si el campo de contraseña está vacío.
  show = input<boolean>(true);

  // Alterna el estado de visibilidad.
  toggleVisible(): void {
    this.visible.update((val) => !val);
  }
}
