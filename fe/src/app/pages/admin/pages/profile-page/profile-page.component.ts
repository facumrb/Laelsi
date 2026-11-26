import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY, finalize, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { ApiAdminService } from '@services/api-services/api-admin.service';
import { IApiAdmin, ICreateAdmin, UserRole } from '@models/user.model';
import { IApiUserPhoto } from '@models/photo.model';
import { UserSession } from '@models/auth.model';
import { AuthService } from '@services/auth.service';
import { AlertService } from '@services/alert.service';
import { CurrentPasswordService } from '@services/current-password.service';
import { FormUtils } from '@shared/validators/form-utils';
import {
  LARGO_MAXIMO_TELEFONO,
  LARGO_MINIMO_TELEFONO,
} from '@shared/utils/telefono';
import { PhotoManagerComponent } from '@shared/components/photo-manager/photo-manager.component';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { FormPageHeaderComponent } from '@admin/components/form-page-header/form-page-header.component';
import { FormActionsComponent } from '@admin/components/form-actions/form-actions.component';
import { PasswordInputComponent } from '@shared/components/inputs/password/password-input/password-input.component';
import { NumericInputDirective } from '@shared/directives/numeric-input.directive';
import { PhoneInputDirective } from '@shared/directives/phone-input.directive';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { injectInvalidateAdmins } from '@services/queries/admin-queries';

@Component({
  selector: 'app-admin-profile-page',
  imports: [
    ReactiveFormsModule,
    PhotoManagerComponent,
    FieldErrorComponent,
    FormPageHeaderComponent,
    FormActionsComponent,
    PasswordInputComponent,
    NumericInputDirective,
    PhoneInputDirective,
    TrimInputDirective,
  ],
  templateUrl: './profile-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiAdminService);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);
  private currentPasswordService = inject(CurrentPasswordService);
  private http = inject(HttpClient);
  private invalidateAdmins = injectInvalidateAdmins();

  photoManager = viewChild.required(PhotoManagerComponent);

  // Id del administrador que tiene la sesión (el dueño del perfil)
  private adminId = 0;
  // Foto que ya tiene guardada el perfil
  currentPhoto = signal<IApiUserPhoto | null>(null);
  // Valor inicial del formulario, para detectar cambios
  initialFormValue = signal<string>('');
  // Email con el que se cargó el formulario (para saber si se lo cambió)
  private initialEmail = signal('');
  // Hay un guardado en curso: evita el doble envío
  saving = signal(false);

  formEditProfile = this.fb.nonNullable.group(
    {
      name: [
        '',
        [
          Validators.required,
          FormUtils.minLength(2),
          FormUtils.maxLength(100),
          FormUtils.notOnlyWhiteSpace,
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          FormUtils.minLength(2),
          FormUtils.maxLength(100),
          FormUtils.notOnlyWhiteSpace,
        ],
      ],
      phone: [
        '',
        [
          Validators.required,
          FormUtils.minLength(LARGO_MINIMO_TELEFONO),
          FormUtils.maxLength(LARGO_MAXIMO_TELEFONO),
          Validators.pattern(FormUtils.phonePattern),
        ],
      ],
      dni: [
        '',
        [
          Validators.required,
          FormUtils.minLength(7),
          FormUtils.maxLength(15),
          Validators.pattern(FormUtils.numberPattern),
        ],
      ],
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
    },
    {
      validators: [
        FormUtils.isFieldOneEqualFieldTwo('password', 'confirmPassword'),
      ],
    },
  );

  // Valor actual del formulario como signal (para los computed)
  private formValue = toSignal(this.formEditProfile.valueChanges, {
    initialValue: this.formEditProfile.getRawValue(),
  });

  // Nombre completo para las iniciales de la foto
  fullName = computed(
    () => `${this.formValue().name ?? ''} ${this.formValue().lastName ?? ''}`,
  );

  // Indica si hay algo para guardar: si cambió el formulario o la foto
  hasRealChanges = computed(() => {
    // Todavía no llegaron los datos del perfil: no hay nada que guardar ni descartar
    if (!this.initialFormValue()) return false;
    const formHasChanges =
      JSON.stringify(this.formValue()) !== this.initialFormValue();
    return formHasChanges || this.photoManager().hasChanges();
  });

  ngOnInit(): void {
    this.adminId = this.authService.currentUser()!.id;
    this.fetchAdmin(this.adminId);
  }

  // Carga los datos del perfil y agrega los validadores de campos únicos
  private fetchAdmin(id: number): void {
    this.apiService
      .getAdminById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: IApiAdmin) => {
          this.currentPhoto.set(data.photo);
          this.initialEmail.set(data.email);
          this.formEditProfile.patchValue({
            name: data.name ?? '',
            lastName: data.lastName ?? '',
            phone: data.phone ?? '',
            dni: data.dni ?? '',
            username: data.username,
            email: data.email,
          });

          this.formEditProfile.controls.dni.setAsyncValidators(
            FormUtils.uniqueFieldValidator('Admin', 'dni', this.http, id),
          );
          this.formEditProfile.controls.username.setAsyncValidators(
            FormUtils.uniqueFieldValidator('Admin', 'username', this.http, id),
          );
          this.formEditProfile.controls.email.setAsyncValidators(
            FormUtils.uniqueFieldValidator('Admin', 'email', this.http, id),
          );

          this.snapshotInitial();
        },
        error: () => {
          this.router.navigate(['/admin/analytics']);
        },
      });
  }

  // Guarda el valor actual como valor inicial (ya no hay cambios pendientes)
  private snapshotInitial(): void {
    this.initialFormValue.set(
      JSON.stringify(this.formEditProfile.getRawValue()),
    );
  }

  // Vuelve el formulario y la foto a como estaban al cargar o al último guardado
  discardChanges(): void {
    this.formEditProfile.reset(JSON.parse(this.initialFormValue()));
    this.photoManager().reset();
  }

  async onSubmit(): Promise<void> {
    if (this.saving()) return;
    if (!this.formEditProfile.valid) {
      this.formEditProfile.markAllAsTouched();
      return;
    }
    this.saving.set(true);

    const formValue = this.formEditProfile.getRawValue();

    /*
    Es la propia cuenta: cambiar el email o la contraseña exige confirmar con la contraseña
    actual.
    */
    let currentPassword: string | null | undefined = null;
    try {
      currentPassword = await this.currentPasswordService.requestIfNeeded({
        editingOwnAccount: true,
        changesEmail:
          formValue.email.trim().toLowerCase() !==
          this.initialEmail().trim().toLowerCase(),
        changesPassword: !!formValue.password,
        username: formValue.username,
      });
    } catch {
      // Si el diálogo falla se trata como una cancelación
    }
    // La persona canceló: no se guarda nada
    if (currentPassword === null) {
      this.saving.set(false);
      return;
    }

    const baseData = {
      name: formValue.name,
      lastName: formValue.lastName,
      dni: formValue.dni,
      phone: formValue.phone,
      username: formValue.username,
      email: formValue.email,
      role: UserRole.Admin,
    };

    const adminData: Partial<ICreateAdmin> = {
      ...(formValue.password
        ? {
            ...baseData,
            password: formValue.password,
            confirmPassword: formValue.confirmPassword,
          }
        : baseData),
      ...(currentPassword ? { currentPassword } : {}),
    };

    // Si falla la foto se muestra solo el aviso: sweetalert2 muestra un toast por vez
    let photoFailed = false;

    this.apiService
      .updateAdmin(this.adminId, adminData)
      .pipe(
        /*
        Cambiar la contraseña cierra todas las sesiones de la cuenta, también esta (Supabase Auth,
        por seguridad). Se vuelve a iniciar sesión antes de cualquier otro pedido (la foto, la
        vista del perfil): si no, recibirían un 401 y mostrarían "Tu sesión ya no es válida" tras
        un cambio que salió bien.
        */
        switchMap(() =>
          formValue.password
            ? this.authService.renewSessionAfterPasswordChange(
                formValue.username,
                formValue.password,
              )
            : of(true),
        ),
        switchMap((sesionVigente) => {
          if (sesionVigente) {
            return this.savePhotoOrWarn(
              this.adminId,
              () => (photoFailed = true),
            );
          }
          // No se pudo renovar: el servicio ya cerró la sesión y llevó al login
          this.alertService.toast(
            'Cambiaste tu contraseña',
            'info',
            'Por seguridad, ingresá de nuevo con la contraseña nueva.',
          );
          return EMPTY;
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (photoResponse) => {
          this.invalidateAdmins();
          if (!photoFailed) {
            this.alertService.toast('Perfil actualizado con éxito', 'success');
          }

          // Nombre, apellido y foto se actualizan en la sesión para que el encabezado los muestre
          const sessionUpdates: Partial<UserSession> = {
            name: formValue.name,
            lastName: formValue.lastName,
          };

          if (photoResponse?.id) {
            sessionUpdates.photo = photoResponse;
          } else if (this.photoManager().deletePending()) {
            sessionUpdates.photo = null;
          }

          this.authService.updateCurrentUser(sessionUpdates);

          if ('photo' in sessionUpdates) {
            this.currentPhoto.set(sessionUpdates.photo ?? null);
          }
          this.photoManager().markSaved();
          this.formEditProfile.reset({
            ...formValue,
            password: '',
            confirmPassword: '',
          });
          this.snapshotInitial();
        },
        // El aviso del error lo muestra el interceptor
        error: () => undefined,
      });
  }

  /*
  Guarda la foto. Si falla, el perfil ya quedó guardado: se avisa, se reinicia el gestor de fotos,
  se llama a onFail y se sigue igual.
  */
  private savePhotoOrWarn(userId: number, onFail: () => void) {
    return this.photoManager()
      .saveChanges(userId)
      .pipe(
        catchError(() => {
          onFail();
          // Sin esto, un borrado fallido dejaría la sesión sin foto aunque siga guardada
          this.photoManager().reset();
          this.alertService.toast(
            'Se guardó, pero no se pudo actualizar la foto',
            'warning',
          );
          return of(null);
        }),
      );
  }
}
