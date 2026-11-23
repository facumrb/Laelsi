import { Component, inject, signal } from '@angular/core';
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
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { PasswordInputComponent } from '@shared/components/inputs/password/password-input/password-input.component';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { injectAccessDraft } from '@shared/utils/access-draft';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    GoBackButtonComponent,
    FieldErrorComponent,
    TrimInputDirective,
    PasswordInputComponent,
    LogoComponent,
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

  // Signals para el estado de la UI
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

        // Lógica de redireccionamiento post-login
        const returnUrl = this.activatedRoute.snapshot.queryParams['returnUrl'];
        if (returnUrl) {
          // Si existe una ruta de retorno (ej: /cart-page), vamos allí
          this.router.navigateByUrl(returnUrl);
        } else {
          // Si no existe, navegamos al home correspondiente según el rol
          if (this.authService.isAdmin()) {
            this.router.navigate(['/admin']); // Dashboard Admin
          } else {
            this.router.navigate(['/']); // Home Cliente
          }
        }
      },
      error: (error) => {
        this.loading.set(false);
      },
    });
  }
}
