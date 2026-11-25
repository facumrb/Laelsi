import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@services/auth.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapArrowClockwise,
  bootstrapGoogle,
} from '@ng-icons/bootstrap-icons';
import { FormUtils } from '@shared/validators/form-utils';
import { AlertService } from '@services/alert.service';
import { NavigationHistoryService } from '@services/navigation-history.service';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { PasswordInputComponent } from '@shared/components/inputs/password/password-input/password-input.component';
import { injectAccessDraft } from '@shared/utils/access-draft';
import { AuthShellComponent } from '@auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    FieldErrorComponent,
    TrimInputDirective,
    PasswordInputComponent,
    AuthShellComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapArrowClockwise,
      bootstrapGoogle,
    }),
  ],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private alertService = inject(AlertService);

  // Destino del Volver: la última página fuera de /auth, para no volver al registro ni a recuperar
  backUrl = inject(NavigationHistoryService).lastUrlOutsideAuth;

  // Hay un inicio de sesión en curso (con usuario o con Google)
  loading = signal(false);

  formLogin = this.fb.group({
    // Acepta nombre de usuario o email (el backend resuelve la cuenta por cualquiera
    // de los dos). El máximo es el mismo que usa forgot-password.
    username: [
      '',
      [
        Validators.required,
        FormUtils.minLength(4),
        FormUtils.maxLength(255),
        Validators.pattern(FormUtils.loginIdentifierPattern),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    password: ['', [FormUtils.maxLength(100), Validators.required]],
  });

  // Conserva el usuario ingresado si la persona sale de la pantalla y vuelve.
  // La contraseña no se guarda: la completa el navegador o el gestor de contraseñas.
  private draft = injectAccessDraft('login', this.formLogin, ['username']);

  // Inicio de sesión con Google: redirige a Google y vuelve a la tienda con la sesión iniciada
  loginWithGoogle() {
    this.loading.set(true);

    this.authService.loginWithGoogle().subscribe({
      error: () => {
        this.loading.set(false);
        this.alertService.error(
          'Error',
          'No se pudo iniciar sesión con Google. Intentá de nuevo.',
        );
      },
    });
  }

  onSubmit() {
    if (!this.formLogin.valid) {
      this.formLogin.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { username, password } = this.formLogin.getRawValue();

    this.authService.login(username!, password!).subscribe({
      next: () => {
        this.loading.set(false);
        // La pantalla se envió bien: el borrador ya no hace falta
        this.draft.clear();
        this.alertService.toast('¡Bienvenido de nuevo!', 'success');

        // Si llegó desde una pantalla que pedía sesión (ej: /cart-page) vuelve ahí. Si no, al inicio según el rol
        const returnUrl = this.activatedRoute.snapshot.queryParams['returnUrl'];
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else if (this.authService.isAdmin()) {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        // Los errores HTTP ya los avisa errorInterceptor. Los demás (ej: no se pudo guardar la sesión) no
        if (!(error instanceof HttpErrorResponse)) {
          this.alertService.error(
            'Error',
            'No se pudo iniciar sesión. Intentá de nuevo.',
          );
        }
      },
    });
  }
}
