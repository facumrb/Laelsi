import {
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { AuthService } from '@services/auth.service';
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';
import { PasswordToggleButtonComponent } from '@shared/components/buttons/password-toggle-button/password-toggle-button.component';

@Component({
  selector: 'app-verify-password-modal',
  imports: [
    ReactiveFormsModule,
    A11yModule,
    CloseModalButtonComponent,
    PasswordToggleButtonComponent,
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
  passwordVisible = signal(false);

  private passwordValue = toSignal(this.password.valueChanges, {
    initialValue: '',
  });
  showEyeIcon = computed(() => this.passwordValue().length > 0);

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

  // Solo cierra si el clic empezó y terminó en el fondo: al seleccionar texto del campo y soltar
  // el mouse afuera, el navegador dispara el click en el fondo y el modal se cerraba.
  private pressStartedOnBackdrop = false;

  onBackdropMouseDown(event: MouseEvent) {
    this.pressStartedOnBackdrop = event.target === event.currentTarget;
  }

  onBackdropClick(event: MouseEvent) {
    const isBackdropClick =
      this.pressStartedOnBackdrop && event.target === event.currentTarget;
    this.pressStartedOnBackdrop = false;
    if (isBackdropClick) this.onClose();
  }

  onClose() {
    if (this.verifying()) return;
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.onClose();
  }
}
