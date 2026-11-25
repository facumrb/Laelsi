import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormPageHeaderComponent } from '@admin/components/form-page-header/form-page-header.component';
import { FormActionsComponent } from '@admin/components/form-actions/form-actions.component';
import { PasswordInputComponent } from '@shared/components/inputs/password/password-input/password-input.component';
import { PasswordRuleHintComponent } from '@shared/components/inputs/password/password-rule-hint/password-rule-hint.component';
import { catchError, finalize, Observable, switchMap } from 'rxjs';
import { ApiClientService } from '@services/api-services/api-client.service';
import {
  IApiClient,
  ICreateClient,
  IUpdateClient,
  UserRole,
  FiscalCondition,
} from '@models/user.model';
import { IApiUserPhoto } from '@models/photo.model';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { PhotoManagerComponent } from '@shared/components/photo-manager/photo-manager.component';
import { AlertService } from '@services/alert.service';
import { FormUtils } from '@shared/validators/form-utils';
import {
  LARGO_MAXIMO_TELEFONO,
  LARGO_MINIMO_TELEFONO,
} from '@shared/utils/telefono';
import { NumericInputDirective } from '@shared/directives/numeric-input.directive';
import { AuditInfoComponent } from '@admin/components/audit-info/audit-info.component';
import { PhoneInputDirective } from '@shared/directives/phone-input.directive';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { injectInvalidateClients } from '@services/queries/client-queries';
import { FiscalConditionSelectComponent } from './components/fiscal-condition-select/fiscal-condition-select.component';

@Component({
  selector: 'app-clients-form',
  imports: [
    ReactiveFormsModule,
    NumericInputDirective,
    PhoneInputDirective,
    PhotoManagerComponent,
    AuditInfoComponent,
    FormPageHeaderComponent,
    FormActionsComponent,
    PasswordInputComponent,
    PasswordRuleHintComponent,
    FieldErrorComponent,
    TrimInputDirective,
    FiscalConditionSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients-form.component.html',
})
export class ClientsFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private routeActive = inject(ActivatedRoute);
  private location = inject(Location);
  private clientService = inject(ApiClientService);
  private alertService = inject(AlertService);
  private http = inject(HttpClient);
  private invalidateClients = injectInvalidateClients();

  photoManager = viewChild.required(PhotoManagerComponent);

  isEditMode = signal(false);
  clientId = signal<number | null>(null);
  currentPhoto = signal<IApiUserPhoto | null>(null);
  // Hay un guardado en curso: evita el doble envío
  saving = signal(false);

  // Signal para guardar el estado inicial del formulario
  initialFormValue = signal<string>('');

  // Auditoría (signals de auditoria solo lectura)
  auditCreatedAt = signal<string | null>(null);
  auditUpdatedAt = signal<string | null>(null);
  auditStatusDate = signal<string | null>(null);

  formClient = this.fb.nonNullable.group(
    {
      // --- DATOS PERSONALES ---
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
      phone: [
        '',
        [
          FormUtils.minLength(LARGO_MINIMO_TELEFONO),
          FormUtils.maxLength(LARGO_MAXIMO_TELEFONO),
          Validators.pattern(FormUtils.phonePattern),
        ],
      ],

      // --- CUENTA DE USUARIO ---
      username: [
        '',
        [
          Validators.required,
          FormUtils.minLength(4),
          FormUtils.maxLength(30),
          Validators.pattern(FormUtils.usernamePattern),
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
      password: [
        '',
        [
          FormUtils.maxLength(100),
          Validators.pattern(FormUtils.passwordPattern),
        ],
      ],
      confirmPassword: ['', [FormUtils.maxLength(100)]],

      // --- DATOS DE FACTURACIÓN ---
      fiscalCondition: [FiscalCondition.ConsumidorFinal as FiscalCondition],
      cuit: [
        '',
        [
          FormUtils.minLength(11),
          FormUtils.maxLength(11),
          Validators.pattern(FormUtils.cuitPattern),
        ],
      ],

      // --- DIRECCIÓN ---
      street: ['', FormUtils.maxLength(100)],
      streetNumber: ['', FormUtils.maxLength(10)],
      city: ['', FormUtils.maxLength(100)],
      province: ['', FormUtils.maxLength(100)],
      postalCode: ['', FormUtils.maxLength(10)],
      floor: ['', FormUtils.maxLength(5)],
      apartment: ['', FormUtils.maxLength(5)],
    },
    {
      validators: [
        FormUtils.isFieldOneEqualFieldTwo('password', 'confirmPassword'),
      ],
    },
  );

  ngOnInit() {
    this.checkEditMode();
    if (!this.isEditMode()) {
      this.formClient.get('password')?.addValidators(Validators.required);
      this.formClient
        .get('confirmPassword')
        ?.addValidators(Validators.required);
    }
  }

  checkEditMode() {
    const id = this.routeActive.snapshot.paramMap.get('id');
    if (id) {
      this.loadClientData(+id);
    } else {
      this.setupAsyncValidators();
    }
  }

  private setupAsyncValidators(excludeId?: number) {
    this.formClient.controls.dni.setAsyncValidators(
      FormUtils.uniqueFieldValidator('Client', 'dni', this.http, excludeId),
    );
    this.formClient.controls.username.setAsyncValidators(
      FormUtils.uniqueFieldValidator(
        'Client',
        'username',
        this.http,
        excludeId,
      ),
    );
    this.formClient.controls.email.setAsyncValidators(
      FormUtils.uniqueFieldValidator('Client', 'email', this.http, excludeId),
    );
    this.formClient.controls.cuit.setAsyncValidators(
      FormUtils.uniqueFieldValidator('Client', 'cuit', this.http, excludeId),
    );
  }

  loadClientData(id: number) {
    this.clientId.set(id);
    this.isEditMode.set(true);

    this.clientService.getClientById(id).subscribe({
      next: (client) => {
        this.currentPhoto.set(client.photo);

        this.formClient.patchValue({
          name: client.name ?? '',
          lastName: client.lastName ?? '',
          dni: client.dni ?? '',
          phone: client.phone ?? '',
          username: client.username,
          email: client.email,

          // Mapeo de campos extra
          cuit: client.cuit || '',
          fiscalCondition:
            client.fiscalCondition || FiscalCondition.ConsumidorFinal,
          street: client.street || '',
          streetNumber: client.streetNumber
            ? client.streetNumber.toString()
            : '',
          city: client.city || '',
          province: client.province || '',
          postalCode: client.postalCode || '',
          floor: client.floor || '',
          apartment: client.apartment || '',
        });

        // Auditoría
        this.auditCreatedAt.set(client.createdAt);
        this.auditUpdatedAt.set(client.updatedAt);
        this.auditStatusDate.set(client.deletedAt || client.createdAt);

        this.setupAsyncValidators(id);

        const formSnapshot = this.formClient.getRawValue();
        this.initialFormValue.set(JSON.stringify(formSnapshot));
      },
      error: () => {
        this.location.back();
      },
    });
  }

  // Valor actual del formulario como señal
  private formValue = toSignal(this.formClient.valueChanges, {
    initialValue: this.formClient.getRawValue(),
  });

  // Nombre completo para las iniciales de la foto
  fullName = computed(
    () => `${this.formValue().name ?? ''} ${this.formValue().lastName ?? ''}`,
  );

  // Indica si hay algo para guardar: al crear siempre; al editar, si cambió el formulario o la foto
  hasRealChanges = computed(() => {
    if (!this.isEditMode()) return true;
    const formHasChanges =
      JSON.stringify(this.formValue()) !== this.initialFormValue();
    return formHasChanges || this.photoManager().hasChanges();
  });

  onSubmit() {
    if (this.saving()) return;
    if (!this.formClient.valid) {
      this.formClient.markAllAsTouched();
      return;
    }
    this.saving.set(true);

    const formValue = this.formClient.getRawValue();
    const editing = this.isEditMode();

    /*
    Al editar, la dirección vacía se manda vacía ('' o null en la altura): si la clave no viaja,
    el servidor no toca la columna y no se podría borrar un dato. Al crear, lo vacío no se manda.
    */
    const optionalText = (value: string) =>
      editing ? value : value || undefined;

    // Construimos el objeto base
    const baseData = {
      name: formValue.name,
      lastName: formValue.lastName,
      dni: formValue.dni,
      phone: formValue.phone,
      username: formValue.username,
      email: formValue.email,
      role: UserRole.Client,

      // Campos opcionales
      cuit: formValue.cuit || undefined,
      fiscalCondition: formValue.fiscalCondition,
      street: optionalText(formValue.street),
      streetNumber: formValue.streetNumber
        ? Number(formValue.streetNumber)
        : editing
          ? null
          : undefined,
      city: optionalText(formValue.city),
      province: optionalText(formValue.province),
      postalCode: optionalText(formValue.postalCode),
      floor: optionalText(formValue.floor),
      apartment: optionalText(formValue.apartment),
    };

    const clientData = formValue.password
      ? {
          ...baseData,
          password: formValue.password,
          confirmPassword: formValue.confirmPassword,
        }
      : baseData;

    // Guardar datos
    const clientId = this.clientId();
    const request$: Observable<IApiClient> =
      editing && clientId
        ? this.clientService.updateClient(clientId, clientData as IUpdateClient)
        : this.clientService.addClient(clientData as ICreateClient);

    // Procesar foto y guardar
    // Si falla la foto se muestra solo el aviso: sweetalert2 muestra un toast por vez
    let photoFailed = false;

    request$
      .pipe(
        switchMap((res) => {
          const userId = editing ? clientId : res.id;

          if (!userId) {
            console.error(
              'No se pudo obtener el ID del usuario para subir la foto',
              res,
            );
            return of(null);
          }

          if (this.photoManager().hasChanges()) {
            return this.savePhotoOrWarn(userId, () => (photoFailed = true));
          }

          return of(null);
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.invalidateClients();
          if (!photoFailed) {
            this.alertService.toast('Guardado exitosamente', 'success');
          }
          this.router.navigate(['/admin/clients']); // Redirección al listado de clientes
        },
        // El aviso del error lo muestra el interceptor
        error: () => undefined,
      });
  }

  // Sube o borra la foto. Si falla, el cliente ya quedó guardado: se avisa, se llama a onFail y se sigue igual
  private savePhotoOrWarn(userId: number, onFail: () => void) {
    return this.photoManager()
      .saveChanges(userId)
      .pipe(
        catchError(() => {
          onFail();
          this.alertService.toast(
            'Se guardó, pero no se pudo actualizar la foto',
            'warning',
          );
          return of(null);
        }),
      );
  }
}
