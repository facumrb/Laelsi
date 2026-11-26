import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
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
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { FormUtils } from '@shared/validators/form-utils';
import {
  LARGO_MAXIMO_TELEFONO,
  LARGO_MINIMO_TELEFONO,
} from '@shared/utils/telefono';
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
    ListboxDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  // Perfil que muestra el formulario. Lo pasa ProfilePageComponent al activar la pestaña
  profile = input<IApiClient | null>(null);

  // Avisa que se guardaron los datos, para recargar el perfil
  profileUpdated = output<void>();

  // Guardado en curso: desde que se pide la contraseña (si hace falta) hasta que responde el servidor
  saving = signal(false);
  // Opciones del menú de condición fiscal
  fiscalConditions = Object.values(FiscalCondition);
  isFiscalMenuOpen = signal(false);

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
        FormUtils.minLength(LARGO_MINIMO_TELEFONO),
        FormUtils.maxLength(LARGO_MAXIMO_TELEFONO),
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
    streetNumber: [''],
    city: ['', FormUtils.maxLength(100)],
    province: ['', FormUtils.maxLength(100)],
    postalCode: ['', FormUtils.maxLength(10)],
    floor: ['', FormUtils.maxLength(5)],
    apartment: ['', FormUtils.maxLength(5)],
  });

  // Valores con los que se cargó el formulario: sirven para saber si hay cambios y para descartarlos
  private initialValue = signal<string | null>(null);
  private formValue = toSignal(this.formPerfil.valueChanges);
  /*
  Estado del formulario como signal: las validaciones asíncronas (DNI, email y CUIT ya usados) terminan
  sin un evento de la plantilla y, con OnPush, el botón de guardar no se enteraría
  */
  private formStatus = toSignal(this.formPerfil.statusChanges, {
    initialValue: this.formPerfil.status,
  });

  hasChanges = computed(() => {
    this.formValue();
    const initial = this.initialValue();
    return (
      initial !== null &&
      JSON.stringify(this.formPerfil.getRawValue()) !== initial
    );
  });

  // Se puede guardar con cambios, el formulario válido y ningún guardado en curso
  canSubmit = computed(
    () => this.formStatus() === 'VALID' && this.hasChanges() && !this.saving(),
  );

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (profile) {
        this.patchForm(profile);
      }
    });
  }

  // Abre o cierra el menú de condición fiscal
  toggleFiscalMenu() {
    this.isFiscalMenuOpen.update((v) => !v);
  }

  // Elige una condición fiscal y cierra el menú
  selectFiscalCondition(condition: FiscalCondition) {
    this.formPerfil.patchValue({ fiscalCondition: condition });
    this.isFiscalMenuOpen.set(false);
  }

  // Carga el perfil en el formulario y lo toma como punto de partida para detectar cambios
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
      streetNumber:
        fullUser.streetNumber != null ? String(fullUser.streetNumber) : '',
      city: fullUser.city || '',
      province: fullUser.province || '',
      postalCode: fullUser.postalCode || '',
      floor: fullUser.floor || '',
      apartment: fullUser.apartment || '',
    });

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

    this.initialValue.set(JSON.stringify(this.formPerfil.getRawValue()));
  }

  // Vuelve el formulario a los valores con los que se cargó
  discardChanges() {
    const initial = this.initialValue();
    if (initial === null) return;
    this.formPerfil.reset(JSON.parse(initial));
    this.isFiscalMenuOpen.set(false);
  }

  async onSubmit() {
    if (this.saving()) return;
    if (!this.formPerfil.valid) {
      this.formPerfil.markAllAsTouched();
      return;
    }

    const userId = this.profile()?.id;
    if (!userId) return;

    const rawValue = this.formPerfil.getRawValue();
    this.saving.set(true);

    // Cambiar el email de la propia cuenta exige confirmar con la contraseña actual (el servidor lo pide)
    const emailChanged =
      rawValue.email.trim().toLowerCase() !==
      (this.profile()?.email ?? '').trim().toLowerCase();
    const currentPassword = await this.currentPasswordService.requestIfNeeded({
      editingOwnAccount: true,
      changesEmail: emailChanged,
      changesPassword: false,
      username: this.profile()?.username,
    });
    if (currentPassword === null) {
      // La persona canceló: no se guarda nada
      this.saving.set(false);
      return;
    }

    const clientData: IUpdateClient = {
      name: rawValue.name,
      lastName: rawValue.lastName,
      dni: rawValue.dni,
      email: rawValue.email,
      phone: rawValue.phone,
      cuit: rawValue.cuit,
      fiscalCondition: rawValue.fiscalCondition as FiscalCondition,
      street: rawValue.street,
      // Vacía se manda null para que el servidor la borre
      streetNumber: rawValue.streetNumber
        ? Number(rawValue.streetNumber)
        : null,
      city: rawValue.city,
      province: rawValue.province,
      postalCode: rawValue.postalCode,
      floor: rawValue.floor,
      apartment: rawValue.apartment,
      ...(currentPassword ? { currentPassword } : {}),
    };

    this.apiClientService
      .updateClient(userId, clientData)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.alertService.toast('Perfil actualizado correctamente', 'success');
          this.profileUpdated.emit();
        },
        // El errorInterceptor ya avisó: el formulario queda como estaba para reintentar
        error: () => undefined,
      });
  }
}
