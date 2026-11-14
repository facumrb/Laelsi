import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapArrowClockwise,
  bootstrapEnvelopeCheck,
  bootstrapWhatsapp,
} from '@ng-icons/bootstrap-icons';
import { AuthService } from '@services/auth.service';
import { AlertService } from '@services/alert.service';
import { injectAccessDraft, readAccessDraft } from '@services/access-draft';
import { FormUtils } from '@shared/validators/form-utils';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { TurnstileComponent } from '@shared/components/turnstile/turnstile.component';
import { environment } from 'src/environments/environment';

/**
 * Pantalla "Recuperar contraseña": la persona indica su email, DNI o nombre de
 * usuario y, si corresponde a una cuenta, recibe por email un enlace para
 * elegir una contraseña nueva.
 */
@Component({
  selector: 'app-recover-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    FieldErrorComponent,
    GoBackButtonComponent,
    TrimInputDirective,
    LogoComponent,
    TurnstileComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapArrowClockwise,
      bootstrapEnvelopeCheck,
      bootstrapWhatsapp,
    }),
  ],
  templateUrl: './recover-password-page.component.html',
})
export class RecoverPasswordPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);

  loading = signal(false);
  // Cuando la solicitud se envió, el formulario se reemplaza por el mensaje de confirmación
  sent = signal(false);

  // Verificación anti-bots (Cloudflare Turnstile). Solo se exige si hay una clave configurada.
  turnstileEnabled = !!environment.turnstileSiteKey;
  turnstileToken = signal<string | null>(null);
  private turnstile = viewChild(TurnstileComponent);

  formRecover = this.fb.nonNullable.group({
    identifier: [
      '',
      [
        Validators.required,
        FormUtils.minLength(4),
        FormUtils.maxLength(255),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
  });

  // Conserva el dato ingresado si la persona sale de la pantalla y vuelve
  private draft = injectAccessDraft('recover-password', this.formRecover, [
    'identifier',
  ]);

  // Ayuda para quien ya no tiene acceso a su email
  private whatsappNumber = '5493417121860';
  private whatsappMessage = 'Hola, necesito recuperar mi contraseña en Laelsi';

  get whatsappLink(): string {
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(this.whatsappMessage)}`;
  }

  constructor() {
    // Si la persona venía del login y ya había escrito su usuario, se lo proponemos acá
    const identifier = this.formRecover.controls.identifier;
    if (!identifier.value) {
      const loginUsername = readAccessDraft('login')['username'];
      if (loginUsername) identifier.setValue(loginUsername);
    }
  }

  onSubmit() {
    if (!this.formRecover.valid) {
      this.formRecover.markAllAsTouched();
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
    const { identifier } = this.formRecover.getRawValue();

    this.authService
      .requestPasswordReset(identifier.trim(), this.turnstileToken())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          // La pantalla se envió bien: el borrador ya no hace falta
          this.draft.clear();
          this.sent.set(true);
        },
        // El token de Turnstile es de un solo uso: si la solicitud falla, se pide uno nuevo
        error: () => this.turnstile()?.reset(),
      });
  }
}
