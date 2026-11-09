import {
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapPerson,
  bootstrapReceipt,
  bootstrapGeoAlt,
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { IApiClient, IUpdateClient, FiscalCondition } from '@models/user.model';
import { ApiClientService } from '@services/api-services/api-client.service';
import { AlertService } from '@services/alert.service';
import { CurrentPasswordService } from '@services/current-password.service';
import { PhoneInputDirective } from '@shared/directives/phone-input.directive';
import { NumericInputDirective } from '@shared/directives/numeric-input.directive';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { FormUtils } from '@shared/validators/form-utils';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';

@Component({
  selector: 'app-profile-details',
  imports: [
    ReactiveFormsModule,
    NgIconComponent,
    PhoneInputDirective,
    NumericInputDirective,
    ClickOutsideDirective,
    FieldErrorComponent,
    TrimInputDirective,
  ],
  viewProviders: [
    provideIcons({
      bootstrapPerson,
      bootstrapReceipt,
      bootstrapGeoAlt,
      bootstrapChevronDown,
      bootstrapCheckLg,
    }),
  ],
  templateUrl: './profile-details.component.html',
})
export class ProfileDetailsComponent {
  private fb = inject(FormBuilder);
  private apiClientService = inject(ApiClientService);
  private http = inject(HttpClient);
  private alertService = inject(AlertService);
  private currentPasswordService = inject(CurrentPasswordService);

  profile = input<IApiClient | null>(null);

  // Como output, disparamos un evento para decir que se actualizó
  profileUpdated = output<void>();

  saving = signal(false);
  fiscalConditions = Object.values(FiscalCondition);
  isFiscalMenuOpen = signal(false);

  // ID 71 (pregunta 1 de la comparativa): nombre, apellido, DNI y teléfono son opcionales; un cliente creado con
  // lo mínimo no tiene que completarlos para guardar otro cambio. Si se cargan, se siguen validando.
  formPerfil = this.fb.nonNullable.group({
    name: [
      '',
      [
        FormUtils.minLength(2),
        FormUtils.maxLength(100),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    lastName: [
      '',
      [
        FormUtils.minLength(2),
        FormUtils.maxLength(100),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    dni: [
      '',
      [
        FormUtils.minLength(7),
        FormUtils.maxLength(15),
        Validators.pattern(FormUtils.numberPattern),
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
    phone: [
      '',
      [
        FormUtils.minLength(7),
        FormUtils.maxLength(20),
        Validators.pattern(FormUtils.phonePattern),
      ],
    ],
    cuit: [
      '',
      [
        FormUtils.minLength(11),
        FormUtils.maxLength(11),
        Validators.pattern(FormUtils.cuitPattern),
      ],
    ],
    fiscalCondition: [FiscalCondition.ConsumidorFinal],
    street: ['', FormUtils.maxLength(100)],
    streetNumber: [0],
    city: ['', FormUtils.maxLength(100)],
    province: ['', FormUtils.maxLength(100)],
    postalCode: ['', FormUtils.maxLength(10)],
    floor: ['', FormUtils.maxLength(5)],
    apartment: ['', FormUtils.maxLength(5)],
  });

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (profile) {
        this.patchForm(profile);
      }
    });
  }

  toggleFiscalMenu() {
    this.isFiscalMenuOpen.update((v) => !v);
  }

  selectFiscalCondition(condition: FiscalCondition) {
    this.formPerfil.patchValue({ fiscalCondition: condition });
    this.isFiscalMenuOpen.set(false);
  }

  private patchForm(fullUser: IApiClient) {
    this.formPerfil.patchValue({
      // La base guarda NULL en lo que el cliente nunca cargó: el formulario lo muestra vacío
      name: fullUser.name ?? '',
      lastName: fullUser.lastName ?? '',
      dni: fullUser.dni ?? '',
      email: fullUser.email,
      phone: fullUser.phone ?? '',
      cuit: fullUser.cuit || '',
      fiscalCondition:
        fullUser.fiscalCondition || FiscalCondition.ConsumidorFinal,
      street: fullUser.street || '',
      streetNumber: fullUser.streetNumber || 0,
      city: fullUser.city || '',
      province: fullUser.province || '',
      postalCode: fullUser.postalCode || '',
      floor: fullUser.floor || '',
      apartment: fullUser.apartment || '',
    });

    // Validación async para edición
    const id = fullUser.id;
    this.formPerfil.controls.dni.setAsyncValidators(
      FormUtils.uniqueFieldValidator('Client', 'dni', this.http, id),
    );
    this.formPerfil.controls.email.setAsyncValidators(
      FormUtils.uniqueFieldValidator('Client', 'email', this.http, id),
    );
    this.formPerfil.controls.cuit.setAsyncValidators(
      FormUtils.uniqueFieldValidator('Client', 'cuit', this.http, id),
    );
  }

  async onSubmit() {
    if (!this.formPerfil.valid) {
      this.formPerfil.markAllAsTouched();
      return;
    }

    const userId = this.profile()?.id;
    if (!userId) return;

    const rawValue = this.formPerfil.getRawValue();

    // Cambiar el email de la propia cuenta exige confirmar con la contraseña actual (el servidor lo pide)
    const emailChanged =
      rawValue.email.trim().toLowerCase() !==
      (this.profile()?.email ?? '').trim().toLowerCase();
    const currentPassword = await this.currentPasswordService.requestIfNeeded({
      editingOwnAccount: true,
      changesEmail: emailChanged,
      changesPassword: false,
    });
    if (currentPassword === null) return; // la persona canceló: no se guarda nada

    this.saving.set(true);

    const clientData: IUpdateClient = {
      name: rawValue.name,
      lastName: rawValue.lastName,
      dni: rawValue.dni,
      email: rawValue.email,
      phone: rawValue.phone,
      cuit: rawValue.cuit,
      fiscalCondition: rawValue.fiscalCondition as FiscalCondition,
      street: rawValue.street,
      streetNumber: rawValue.streetNumber
        ? Number(rawValue.streetNumber)
        : undefined,
      city: rawValue.city,
      province: rawValue.province,
      postalCode: rawValue.postalCode,
      floor: rawValue.floor,
      apartment: rawValue.apartment,
      ...(currentPassword ? { currentPassword } : {}),
    };

    this.apiClientService.updateClient(userId, clientData).subscribe({
      next: () => {
        this.saving.set(false);
        this.alertService.toast('Perfil actualizado correctamente', 'success');
        this.profileUpdated.emit();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
