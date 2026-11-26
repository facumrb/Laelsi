import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PasswordToggleButtonComponent } from '@shared/components/buttons/password-toggle-button/password-toggle-button.component';

/*
Campo de contraseña con el botón para mostrarla u ocultarla.
El label, el asterisco de obligatorio y los mensajes de error quedan en cada formulario.
La estética cambia según la pantalla: fieldClass e inputClass reciben las clases de cada una
(por defecto, las del panel de administración).
*/
@Component({
  selector: 'app-password-input',
  imports: [ReactiveFormsModule, PasswordToggleButtonComponent],
  templateUrl: './password-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordInputComponent {
  // Control del formulario padre
  control = input.required<FormControl<string | null>>();

  // id del input (lo usa el label de la página con for)
  inputId = input.required<string>();

  placeholder = input<string>('•••••••••••••••••');
  autocomplete = input<string>('new-password');
  maxlength = input<number>(100);

  // id del texto de ayuda que describe al campo (aria-describedby)
  describedBy = input<string | null>(null);

  // Dentro de un modal, marca el input para que reciba el foco al abrirse (cdkTrapFocusAutoCapture busca el atributo)
  focusInitial = input<boolean>(false);

  // Clases del contenedor (borde, foco). Siempre se suma password-field
  fieldClass = input<string>(
    'rounded-lg border border-gray-300 shadow-sm focus-within:[outline:auto]',
  );

  // Clases del input (relleno, texto). Siempre se suma password-field-input
  inputClass = input<string>('p-2.5 text-sm text-gray-900');

  // Indica si la contraseña se ve como texto
  visible = signal(false);

  private value = signal<string | null>('');

  // El ojito solo se muestra cuando hay algo escrito
  showEye = computed(() => !!this.value());

  constructor() {
    effect((onCleanup) => {
      const ctrl = this.control();
      this.value.set(ctrl.value);
      const sub = ctrl.valueChanges.subscribe((v) => this.value.set(v));
      onCleanup(() => sub.unsubscribe());
    });
  }
}
