import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapArrowClockwise,
  bootstrapCheckCircleFill,
  bootstrapWhatsapp,
} from '@ng-icons/bootstrap-icons';
import { ICreateRevocation } from '@models/revocation.model';
import { ApiRevocationService } from '@services/api-services/api-revocation.service';
import { AlertService } from '@services/alert.service';
import { FormUtils } from '@shared/validators/form-utils';
import { LARGO_MAXIMO_TELEFONO } from '@shared/utils/telefono';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { PhoneInputDirective } from '@shared/directives/phone-input.directive';
import { NumericInputDirective } from '@shared/directives/numeric-input.directive';
import { TurnstileComponent } from '@shared/components/turnstile/turnstile.component';
import { environment } from '@environments/environment';
import { LEGAL_INFO } from '@client/pages/footer-pages/legal-info';

/*
Botón de arrepentimiento (Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y
Lealtad Comercial).

La norma exige que cualquier persona pueda pedir la revocación de su compra SIN registrarse ni
hacer otro trámite, y que se le informe un código de identificación por el mismo medio. Por eso
esta pantalla es pública y, al enviarla, muestra el código al instante (el servidor además lo
manda por email).
*/
@Component({
  selector: 'app-revocation-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    FieldErrorComponent,
    TrimInputDirective,
    PhoneInputDirective,
    NumericInputDirective,
    TurnstileComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapArrowClockwise,
      bootstrapCheckCircleFill,
      bootstrapWhatsapp,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './revocation-page.component.html',
})
export class RevocationPageComponent {
  private fb = inject(FormBuilder);
  private apiRevocation = inject(ApiRevocationService);
  private alertService = inject(AlertService);

  readonly legal = LEGAL_INFO;

  loading = signal(false);
  // Código de identificación que devolvió el servidor. Mientras es null se muestra el formulario
  code = signal<string | null>(null);
  // Email al que se envió la copia, para mostrarlo en la confirmación
  sentTo = signal('');

  // Verificación anti-bots (Cloudflare Turnstile). Solo se exige si hay una clave configurada.
  turnstileEnabled = !!environment.turnstileSiteKey;
  turnstileToken = signal<string | null>(null);
  private turnstile = viewChild(TurnstileComponent);

  form = this.fb.nonNullable.group({
    firstName: [
      '',
      [
        Validators.required,
        FormUtils.maxLength(100),
        Validators.pattern(FormUtils.namePattern),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    lastName: [
      '',
      [
        Validators.required,
        FormUtils.maxLength(100),
        Validators.pattern(FormUtils.namePattern),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    email: [
      '',
      [
        Validators.required,
        FormUtils.maxLength(255),
        Validators.pattern(FormUtils.emailPattern),
      ],
    ],
    // Opcionales
    phone: [
      '',
      [
        FormUtils.maxLength(LARGO_MAXIMO_TELEFONO),
        Validators.pattern(FormUtils.phonePattern),
      ],
    ],
    orderNumber: [
      '',
      [FormUtils.maxLength(9), Validators.pattern(FormUtils.numberPattern)],
    ],
    details: [
      '',
      [
        Validators.required,
        FormUtils.minLength(10),
        FormUtils.maxLength(1000),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
  });

  onSubmit() {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
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

    const value = this.form.getRawValue();
    const data: ICreateRevocation = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      phone: value.phone.trim() || null,
      orderNumber: value.orderNumber.trim() ? Number(value.orderNumber) : null,
      details: value.details.trim(),
    };

    this.loading.set(true);
    this.apiRevocation
      .create(data, this.turnstileToken())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (receipt) => {
          this.sentTo.set(data.email);
          this.code.set(receipt.code);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        // El token de Turnstile es de un solo uso: si la solicitud falla, se pide uno nuevo
        error: () => this.turnstile()?.reset(),
      });
  }
}
