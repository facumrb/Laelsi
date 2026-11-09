import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { switchMap } from 'rxjs';
import { ApiClientService } from '@services/api-services/api-client.service';
import { ICreateClient, UserRole, FiscalCondition } from '@models/user.model';
import { IApiUserPhoto } from '@models/photo.model';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { PhotoManagerComponent } from '@shared/components/photo-manager/photo-manager.component';
import { AlertService } from '@services/alert.service';
import { FormUtils } from '@shared/validators/form-utils';
import { NumericInputDirective } from '@shared/directives/numeric-input.directive';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { AuditInfoComponent } from '@admin/components/audit-info/audit-info.component';
import { PhoneInputDirective } from '@shared/directives/phone-input.directive';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';

@Component({
  selector: 'app-clients-form',
  imports: [
    ReactiveFormsModule,
    NgIconComponent,
    NumericInputDirective,
    PhoneInputDirective,
    PhotoManagerComponent,
    ClickOutsideDirective,
    AuditInfoComponent,
    GoBackButtonComponent,
    FieldErrorComponent,
    TrimInputDirective,
    ListboxDirective,
  ],
  viewProviders: [
    provideIcons({
      bootstrapChevronDown,
      bootstrapCheckLg,
    }),
  ],
  templateUrl: './clients-form.component.html',
})
export class ClientsFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private routeActive = inject(ActivatedRoute);
  location = inject(Location);
  private clientService = inject(ApiClientService);
  private alertService = inject(AlertService);
  private http = inject(HttpClient);

  photoManager = viewChild.required(PhotoManagerComponent);

  isEditMode = signal(false);
  clientId = signal<number | null>(null);
  currentPhoto = signal<IApiUserPhoto | null>(null);

  // Signal para guardar el estado inicial del formulario
  initialFormValue = signal<string>('');

  // Auditoría (signals de auditoria solo lectura)
  auditCreatedAt = signal<string | null>(null);
  auditUpdatedAt = signal<string | null>(null);
  auditStatusDate = signal<string | null>(null);

  fiscalConditions = Object.values(FiscalCondition) as FiscalCondition[];
  isFiscalMenuOpen = signal(false);

  // Alternar estado
  toggleFiscalMenu() {
    this.isFiscalMenuOpen.update((v) => !v);
  }

  // Seleccionar opción y cerrar
  selectFiscalCondition(value: FiscalCondition) {
    this.formClient.get('fiscalCondition')?.setValue(value);
    this.isFiscalMenuOpen.set(false);
  }

  formClient = this.fb.group(
    {
      // --- DATOS PERSONALES ---
      // ID 71: nombre, apellido, DNI y teléfono son opcionales (la base los guarda como NULL y el registro
      // propio tampoco los pide). Si se cargan, se siguen validando.
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
          FormUtils.minLength(7),
          FormUtils.maxLength(20),
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
      fiscalCondition: [FiscalCondition.ConsumidorFinal],
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
          name: client.name,
          lastName: client.lastName,
          dni: client.dni,
          phone: client.phone,
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

        this.formClient.get('password')?.removeValidators(Validators.required);
        this.formClient.get('password')?.updateValueAndValidity();

        this.setupAsyncValidators(id);

        const formSnapshot = this.formClient.getRawValue();
        this.initialFormValue.set(JSON.stringify(formSnapshot));
      },
      error: () => {
        this.location.back();
      },
    });
  }

  get fullName(): string {
    const name = this.formClient.get('name')?.value || '';
    const lastName = this.formClient.get('lastName')?.value || '';
    return `${name} ${lastName}`;
  }

  get hasRealChanges(): boolean {
    // Si estamos creando, siempre permitimos guardar (si es válido)
    if (!this.isEditMode()) return true;

    // Comparar formulario actual vs inicial
    const currentJson = JSON.stringify(this.formClient.getRawValue());
    const formHasChanges = currentJson !== this.initialFormValue();

    // Verificar cambios en la foto
    const photoHasChanges = this.photoManager().hasChanges();

    return formHasChanges || photoHasChanges;
  }

  onSubmit() {
    if (!this.formClient.valid) {
      this.formClient.markAllAsTouched();
      return;
    }

    const formValue = this.formClient.getRawValue();

    // Construimos el objeto base
    const baseData = {
      name: formValue.name!,
      lastName: formValue.lastName!,
      dni: formValue.dni!,
      phone: formValue.phone!,
      username: formValue.username!,
      email: formValue.email!,
      role: UserRole.Client,

      // Campos opcionales
      cuit: formValue.cuit || undefined,
      fiscalCondition: formValue.fiscalCondition!,
      street: formValue.street || undefined,
      streetNumber: formValue.streetNumber
        ? Number(formValue.streetNumber)
        : undefined,
      city: formValue.city || undefined,
      province: formValue.province || undefined,
      postalCode: formValue.postalCode || undefined,
      floor: formValue.floor || undefined,
      apartment: formValue.apartment || undefined,
    };

    const clientData = formValue.password
      ? {
          ...baseData,
          password: formValue.password,
          confirmPassword: formValue.confirmPassword,
        }
      : baseData;

    // Guardar datos
    let request$;
    if (this.isEditMode() && this.clientId()) {
      request$ = this.clientService.updateClient(
        this.clientId()!,
        clientData as Partial<ICreateClient>,
      );
    } else {
      request$ = this.clientService.addClient(clientData as ICreateClient);
    }

    // Procesar foto y guardar
    request$
      .pipe(
        switchMap((res: any) => {
          const userId = this.isEditMode()
            ? this.clientId()!
            : res.user?.id || res.id;

          if (!userId) {
            console.error(
              'No se pudo obtener el ID del usuario para subir la foto',
              res,
            );
            return of(null);
          }

          if (this.photoManager().hasChanges()) {
            return this.photoManager().saveChanges(userId);
          }

          return of(null);
        }),
      )
      .subscribe({
        next: () => {
          this.alertService.toast('Guardado exitosamente', 'success');
          this.router.navigate(['/admin/clients']); // Redirección al listado de clientes
        },
      });
  }
}
