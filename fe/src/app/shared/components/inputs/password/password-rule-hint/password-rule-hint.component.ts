import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FormUtils } from '@shared/validators/form-utils';

/*
Texto fijo debajo del campo de contraseña con la regla que tiene que cumplir.
Reserva su espacio siempre y pasa a rojo cuando el campo se tocó y no la cumple.
Con keepHint (al editar), si el campo está vacío avisa que se conserva la contraseña actual.
*/
@Component({
  selector: 'app-password-rule-hint',
  templateUrl: './password-rule-hint.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordRuleHintComponent {
  // Control de la contraseña nueva
  control = input.required<AbstractControl<string | null>>();

  // id del texto: el input lo referencia con aria-describedby
  hintId = input<string>('password-hint');

  // Muestra "Dejar vacío para mantener la actual." mientras el campo esté vacío
  keepHint = input<boolean>(false);

  // Color del texto cuando no hay error
  idleClass = input<string>('text-gray-500');

  readonly passwordRule = FormUtils.passwordRule;

  private value = signal<string | null>('');
  private touched = signal(false);
  private invalid = signal(false);

  showKeepHint = computed(() => this.keepHint() && !this.value());
  hasError = computed(() => this.touched() && this.invalid());

  constructor() {
    effect((onCleanup) => {
      const ctrl = this.control();
      this.syncState(ctrl);
      const sub = ctrl.events.subscribe(() => this.syncState(ctrl));
      onCleanup(() => sub.unsubscribe());
    });
  }

  private syncState(ctrl: AbstractControl<string | null>): void {
    this.value.set(ctrl.value);
    this.touched.set(ctrl.touched);
    this.invalid.set(ctrl.invalid);
  }
}
