import {
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
  templateUrl: './verify-password-modal.component.html',
})
export class VerifyPasswordModalComponent {
  private authService = inject(AuthService);

  username = input<string>('');
  verified = output<string>();
  close = output<void>();

  form = new FormGroup({
    password: new FormControl('', { nonNullable: true }),
  });
  private password = this.form.controls.password;
  verifying = signal(false);
  errorMessage = signal('');

  constructor() {
    this.password.valueChanges.subscribe(() => this.errorMessage.set(''));
  }

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

  onClose() {
    if (this.verifying()) return;
    this.close.emit();
  }
}
