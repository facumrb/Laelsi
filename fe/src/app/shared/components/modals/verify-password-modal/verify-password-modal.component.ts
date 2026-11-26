import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@services/auth.service';
import { PasswordInputComponent } from '@shared/components/inputs/password/password-input/password-input.component';
import {
  ModalDescriptionDirective,
  ModalShellComponent,
  ModalSubtitleDirective,
} from '@shared/components/modals/modal-shell/modal-shell.component';

@Component({
  selector: 'app-verify-password-modal',
  imports: [
    ReactiveFormsModule,
    ModalShellComponent,
    ModalDescriptionDirective,
    ModalSubtitleDirective,
    PasswordInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-password-modal.component.html',
})
export class VerifyPasswordModalComponent {
  private authService = inject(AuthService);

  // Qué se va a cambiar con la contraseña verificada
  mensaje = input<string>(
    'Para cambiar tu contraseña, primero confirmá la actual.',
  );
  // Usuario de la cuenta: el navegador lo usa para ofrecer la contraseña guardada. Vacío = no se agrega
  username = input<string>('');
  // La contraseña es correcta: se emite para enviarla junto con la nueva
  verified = output<string>();
  close = output<void>();

  form = new FormGroup({
    password: new FormControl('', { nonNullable: true }),
  });
  private password = this.form.controls.password;
  // Verificación en curso
  verifying = signal(false);
  errorMessage = signal('');

  constructor() {
    // Al volver a escribir se borra el error anterior
    this.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.errorMessage.set(''));
  }

  // Le pide al servidor que verifique la contraseña actual
  onSubmit() {
    if (this.verifying()) return;

    const password = this.password.value;
    if (!password) {
      this.errorMessage.set('Ingresá tu contraseña actual.');
      return;
    }

    this.verifying.set(true);
    this.authService.verifyPassword(password).subscribe({
      next: () => {
        this.verifying.set(false);
        this.verified.emit(password);
      },
      error: (err) => {
        this.verifying.set(false);
        this.errorMessage.set(
          err?.error?.message || 'No se pudo verificar la contraseña.',
        );
      },
    });
  }

  // Cierra el modal, salvo mientras se está verificando
  onClose() {
    if (this.verifying()) return;
    this.close.emit();
  }
}
