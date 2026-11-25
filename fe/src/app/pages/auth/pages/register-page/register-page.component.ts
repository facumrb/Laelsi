import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@services/auth.service';
import { HttpClient } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapArrowClockwise } from '@ng-icons/bootstrap-icons';
import { FormUtils } from '@shared/validators/form-utils';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { PasswordInputComponent } from '@shared/components/inputs/password/password-input/password-input.component';
import { PasswordRuleHintComponent } from '@shared/components/inputs/password/password-rule-hint/password-rule-hint.component';
import { TurnstileComponent } from '@shared/components/turnstile/turnstile.component';
import { environment } from 'src/environments/environment';
import { toSignal } from '@angular/core/rxjs-interop';
import { AlertService } from '@services/alert.service';
import { finalize } from 'rxjs';
import { IClientRegister } from '@models/auth.model';
import { injectAccessDraft } from '@shared/utils/access-draft';
import { LEGAL_INFO } from '@client/pages/footer-pages/legal-info';
import { AuthShellComponent } from '@auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    FieldErrorComponent,
    TrimInputDirective,
    PasswordInputComponent,
    PasswordRuleHintComponent,
    AuthShellComponent,
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
          this.router.navigate(['/auth/login'], { replaceUrl: true });
        },
        // El aviso del error lo muestra errorInterceptor. El token de Turnstile es de un solo uso: se pide uno nuevo
        error: () => this.turnstile()?.reset(),
      });
  }
}
