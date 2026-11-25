import { Component, computed, input, signal, effect } from '@angular/core';
import {
  AbstractControl,
  FormControlStatus,
  ValidationErrors,
} from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapArrowClockwise,
  bootstrapCheckCircleFill,
  bootstrapXCircleFill,
} from '@ng-icons/bootstrap-icons';
import { FormUtils } from '@shared/validators/form-utils';

/*
Componente reutilizable para mostrar errores de validación de campos.
Soporta validación síncrona, asíncrona (spinner, éxito o aviso de que no se pudo verificar) y el aviso
de "Límite alcanzado." cuando el valor llega a maxLength.
*/
@Component({
  selector: 'app-field-error',
  imports: [NgIconComponent],
  viewProviders: [
    provideIcons({
      bootstrapArrowClockwise,
      bootstrapCheckCircleFill,
      bootstrapXCircleFill,
    }),
  ],
  templateUrl: './field-error.component.html',
})
export class FieldErrorComponent {
  control = input.required<AbstractControl>();

  /*
  Texto que se muestra cuando el control es válido y no está vacío.
  Ejemplo: validLabel="Email disponible"
  */
  validLabel = input<string>();

  // Longitud máxima permitida. Al alcanzarla se muestra "Límite alcanzado.". Si no se provee, no se controla
  maxLength = input<number>();

  private status = signal<FormControlStatus>('VALID');
  private value = signal<unknown>(null);
  private touched = signal(false);
  private pristine = signal(true);
  private controlErrors = signal<ValidationErrors | null>(null);
  private verificacionFallida = signal(false);

  constructor() {
    effect((onCleanup) => {
      const ctrl = this.control();

      this.syncState(ctrl);

      // Suscribirse a todos los eventos del control (Touch, StatusChange, ValueChange, etc)
      const sub = ctrl.events.subscribe(() => this.syncState(ctrl));

      onCleanup(() => sub.unsubscribe());
    });
  }

  private syncState(ctrl: AbstractControl): void {
    this.status.set(ctrl.status);
    this.value.set(ctrl.value);
    this.touched.set(ctrl.touched);
    this.pristine.set(ctrl.pristine);
    this.controlErrors.set(ctrl.errors);
    this.verificacionFallida.set(FormUtils.verificacionPendiente(ctrl));
  }

  // Determina si el componente debe mostrar feedback de validación asíncrona.
  isAsyncMode = computed(() => !!this.validLabel());

  currentLength = computed(() => {
    const val = this.value();
    return val ? String(val).length : 0;
  });

  isPending = computed(() => this.status() === 'PENDING');

  // El valor es válido pero la verificación en el servidor no pudo hacerse
  isUnverified = computed(
    () =>
      this.status() === 'VALID' && !!this.value() && this.verificacionFallida(),
  );

  isAvailable = computed(
    () =>
      this.status() === 'VALID' &&
      !!this.value() &&
      !this.pristine() &&
      !this.verificacionFallida(),
  );

  isLimitReached = computed(() => {
    const limit = this.maxLength();
    return limit !== undefined && this.currentLength() >= limit;
  });

  hasErrors = computed(() => {
    return (!!this.controlErrors() || this.isLimitReached()) && this.touched();
  });

  hasTakenError = computed(() => {
    const errors = this.controlErrors();
    if (!errors) return false;
    return Object.keys(errors).some((key) => key.endsWith('Taken'));
  });

  errorText = computed(() => {
    if (this.isLimitReached()) return 'Límite alcanzado.';
    const errors = this.controlErrors();
    if (!errors) return null;
    return FormUtils.getTextError(errors);
  });
}
