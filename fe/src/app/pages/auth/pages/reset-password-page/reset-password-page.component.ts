import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapArrowClockwise,
  bootstrapExclamationTriangle,
} from '@ng-icons/bootstrap-icons';
import { AuthService } from '@services/auth.service';
import { AlertService } from '@services/alert.service';
import { FormUtils } from '@shared/validators/form-utils';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { PasswordToggleButtonComponent } from '@shared/components/buttons/password-toggle-button/password-toggle-button.component';
import { LogoComponent } from '@shared/components/logo/logo.component';

// checking: consultando si el enlace sirve | ready: se puede cargar la contraseña | invalid: enlace vencido o inexistente
type ResetState = 'checking' | 'ready' | 'invalid';

/**
 * Pantalla a la que lleva el enlace del correo de recuperación. Permite elegir
 * una contraseña nueva ("Contraseña" y "Confirmar contraseña").
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    FieldErrorComponent,
    PasswordToggleButtonComponent,
    LogoComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapArrowClockwise,
      bootstrapExclamationTriangle,
    }),
  ],
  templateUrl: './reset-password-page.component.html',
})
export class ResetPasswordPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertService = inject(AlertService);

  state = signal<ResetState>('checking');
  loading = signal(false);
  passwordVisible = signal(false);
  confirmPasswordVisible = signal(false);

  // Cuenta a la que pertenece el enlace (la informa el backend)
  username = signal('');

  // Token del enlace. Vive solo en memoria: no se guarda en ningún almacenamiento.
  private token = '';

  formReset = this.fb.nonNullable.group(
    {
      password: [
        '',
        [
          Validators.required,
          FormUtils.maxLength(100),
          Validators.pattern(FormUtils.passwordPattern),
        ],
      ],
      confirmPassword: ['', [Validators.required, FormUtils.notOnlyWhiteSpace]],
    },
    {
      validators: FormUtils.isFieldOneEqualFieldTwo(
        'password',
        'confirmPassword',
      ),
    },
  );

  private passwordValue = toSignal(
    this.formReset.controls.password.valueChanges,
    { initialValue: '' },
  );

  private confirmPasswordValue = toSignal(
    this.formReset.controls.confirmPassword.valueChanges,
    { initialValue: '' },
  );

  private passwordControl = this.formReset.controls.password;

  private passwordEvents = toSignal(this.passwordControl.events);

  // La regla de la contraseña se muestra siempre (reserva su espacio) y pasa a rojo cuando no se cumple
  passwordHintError = computed(() => {
    this.passwordEvents();
    return this.passwordControl.touched && this.passwordControl.invalid;
  });

  showEyeIcon = computed(() => this.passwordValue().length > 0);
  showConfirmEyeIcon = computed(() => this.confirmPasswordValue().length > 0);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.state.set('invalid');
      return;
    }

    // Se quita el token de la barra de direcciones para que no quede a la vista
    // ni en el historial del navegador. La pantalla lo conserva en memoria.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });

    this.checkToken();
  }

  /** Consulta al backend si el enlace sigue vigente (no lo gasta). */
  private checkToken(): void {
    this.authService.validateResetToken(this.token).subscribe({
      next: (status) => {
        this.username.set(status.username ?? '');
        this.state.set(status.valid ? 'ready' : 'invalid');
      },
      error: () => this.state.set('invalid'),
    });
  }

  onSubmit() {
    if (!this.formReset.valid) {
      this.formReset.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { password, confirmPassword } = this.formReset.getRawValue();

    this.authService
      .resetPassword(this.token, password, confirmPassword)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.alertService.toast(
            'Contraseña actualizada',
            'success',
            'Ya podés iniciar sesión con tu contraseña nueva.',
          );

          // Con la contraseña nueva hay que volver a iniciar sesión: si en este
          // navegador había quedado una sesión abierta, se cierra antes de ir al login.
          if (this.authService.isLoggedIn()) {
            this.authService.logout('/auth/login');
          } else {
            this.router.navigate(['/auth/login']);
          }
        },
        // Si falló porque el enlace venció o ya se usó, se muestra el aviso correspondiente
        error: () => this.checkToken(),
      });
  }
}
