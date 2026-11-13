import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@services/auth.service';
import { HttpClient } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapArrowClockwise } from '@ng-icons/bootstrap-icons';
import { FormUtils } from '@shared/validators/form-utils';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { PasswordToggleButtonComponent } from '@shared/components/buttons/password-toggle-button/password-toggle-button.component';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { TurnstileComponent } from '@shared/components/turnstile/turnstile.component';
import { environment } from 'src/environments/environment';
import { toSignal } from '@angular/core/rxjs-interop';
import { AlertService } from '@services/alert.service';
import { finalize } from 'rxjs';
import { IClientRegister } from '@models/auth.model';
import { injectAccessDraft } from '@services/access-draft';
import { LEGAL_INFO } from '@client/pages/footer-pages/legal-info';

@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    FieldErrorComponent,
    GoBackButtonComponent,
    TrimInputDirective,
    PasswordToggleButtonComponent,
    LogoComponent,
    TurnstileComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapArrowClockwise,
    }),
  ],
  templateUrl: './register-page.component.html',
})
export class RegisterPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private alertService = inject(AlertService);

  loading = signal(false);
  passwordVisible = signal(false);
  confirmPasswordVisible = signal(false);

  // Verificación anti-bots (Cloudflare Turnstile). Solo se exige si hay una clave configurada.
  turnstileEnabled = !!environment.turnstileSiteKey;
  turnstileToken = signal<string | null>(null);
  private turnstile = viewChild(TurnstileComponent);

  formRegister = this.fb.nonNullable.group(
    {
      username: [
        '',
        {
          validators: [
            Validators.required,
            FormUtils.minLength(4),
            FormUtils.maxLength(30),
            Validators.pattern(FormUtils.usernamePattern),
            FormUtils.notOnlyWhiteSpace,
          ],
          asyncValidators: [
            FormUtils.uniqueFieldValidator('Client', 'username', this.http),
          ],
        },
      ],
      email: [
        '',
        {
          validators: [
            Validators.required,
            FormUtils.maxLength(255),
            Validators.pattern(FormUtils.emailPattern),
          ],
          asyncValidators: [
            FormUtils.uniqueFieldValidator('Client', 'email', this.http),
          ],
        },
      ],
      password: [
        '',
        [
          Validators.required,
          FormUtils.maxLength(100),
          Validators.pattern(FormUtils.passwordPattern),
        ],
      ],
      confirmPassword: ['', [Validators.required, FormUtils.notOnlyWhiteSpace]],
      // Aceptación de los Términos y la Política de Privacidad. El servidor la vuelve a exigir
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: FormUtils.isFieldOneEqualFieldTwo(
        'password',
        'confirmPassword',
      ),
    },
  );

  // Conserva el usuario y el email si la persona sale de la pantalla y vuelve.
  // Las contraseñas no se guardan: las completa el navegador o el gestor de contraseñas.
  private draft = injectAccessDraft('register', this.formRegister, [
    'username',
    'email',
  ]);

  private formStatus = toSignal(this.formRegister.statusChanges, {
    initialValue: this.formRegister.status,
  });

  isPending = computed(() => this.formStatus() === 'PENDING');
  isValid = computed(() => this.formStatus() === 'VALID');

  private passwordValue = toSignal(
    this.formRegister.get('password')!.valueChanges,
    { initialValue: '' },
  );

  private confirmPasswordValue = toSignal(
    this.formRegister.get('confirmPassword')!.valueChanges,
    { initialValue: '' },
  );

  private passwordControl = this.formRegister.controls.password;

  private passwordEvents = toSignal(this.passwordControl.events);

  // La regla de la contraseña se muestra siempre (reserva su espacio) y pasa a rojo cuando no se cumple
  passwordHintError = computed(() => {
    this.passwordEvents();
    return this.passwordControl.touched && this.passwordControl.invalid;
  });

  showEyeIcon = computed(() => {
    const val = this.passwordValue();
    return !!(val && val.length > 0);
  });

  showConfirmEyeIcon = computed(() => {
    const val = this.confirmPasswordValue();
    return !!(val && val.length > 0);
  });

  onSubmit() {
    if (!this.isValid()) {
      this.formRegister.markAllAsTouched();
      return;
    }

    if (this.turnstileEnabled && !this.turnstileToken()) {
      this.alertService.modal(
        'Verificación en curso',
        'Todavía estamos verificando que no seas un robot. Esperá unos segundos y volvé a intentar.',
        'info',
      );
      return;
    }

    this.loading.set(true);

    const { confirmPassword, ...registerData } =
      this.formRegister.getRawValue();

    // El servidor guarda la fecha de la aceptación junto con la versión de los textos que se mostraron
    const payload: IClientRegister = {
      ...registerData,
      termsVersion: LEGAL_INFO.version,
    };

    this.authService
      .register(payload, this.turnstileToken())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          // La pantalla se envió bien: el borrador ya no hace falta
          this.draft.clear();
          this.alertService.toast('¡Cuenta creada exitosamente!', 'success');
          this.router.navigate(['/auth/login'], {
            queryParams: { registered: 'true' },
            replaceUrl: true,
          });
        },
        error: (err) => {
          // El token de Turnstile es de un solo uso: si el registro falla, se pide uno nuevo
          this.turnstile()?.reset();
          const message =
            err.error?.message ||
            'Ocurrió un error al intentar crear tu cuenta.';
          this.alertService.toast(message, 'error');
        },
      });
  }
}
