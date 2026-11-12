import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { EMPTY, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { ApiAdminService } from '@services/api-services/api-admin.service';
import { IApiAdmin, ICreateAdmin, UserRole } from '@models/user.model';
import { IApiUserPhoto } from '@models/photo.model';
import { AuthService } from '@services/auth.service';
import { AlertService } from '@services/alert.service';
import { CurrentPasswordService } from '@services/current-password.service';
import { FormUtils } from '@shared/validators/form-utils';
import { PhotoManagerComponent } from '@shared/components/photo-manager/photo-manager.component';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { PasswordToggleButtonComponent } from '@shared/components/buttons/password-toggle-button/password-toggle-button.component';
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
    GoBackButtonComponent,
    PasswordToggleButtonComponent,
    NumericInputDirective,
    PhoneInputDirective,
    TrimInputDirective,
  ],
  templateUrl: './profile-page.component.html',
})
export class ProfilePageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private apiService = inject(ApiAdminService);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);
  private currentPasswordService = inject(CurrentPasswordService);
  private http = inject(HttpClient);
  private invalidateAdmins = injectInvalidateAdmins();

  photoManager = viewChild.required(PhotoManagerComponent);

  formUtils = FormUtils;
  currentPhoto = signal<IApiUserPhoto | null>(null);
  initialFormValue = signal<string>('');

  formEditProfile = this.fb.group(
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
          FormUtils.minLength(7),
          FormUtils.maxLength(20),
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

  passwordVisible = signal(false);
  confirmPasswordVisible = signal(false);

  private passwordValue = toSignal(
    this.formEditProfile.controls.password.valueChanges,
  );
  private confirmPasswordValue = toSignal(
    this.formEditProfile.controls.confirmPassword.valueChanges,
  );

  showEyeIcon = computed(() => !!this.passwordValue());
  showConfirmEyeIcon = computed(() => !!this.confirmPasswordValue());

  ngOnInit(): void {
    this.fetchAdmin(this.authService.currentUser()!.id);
  }

  private fetchAdmin(id: number): void {
    this.apiService.getAdminById(id).subscribe({
      next: (data: IApiAdmin) => {
        this.currentPhoto.set(data.photo);
        this.formEditProfile.patchValue({
          name: data.name,
          lastName: data.lastName,
          phone: data.phone,
          dni: data.dni,
          username: data.username,
          email: data.email,
        });

        // Configurar validadores asíncronos para edición
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

  private snapshotInitial(): void {
    this.initialFormValue.set(
      JSON.stringify(this.formEditProfile.getRawValue()),
    );
  }

  discardChanges(): void {
    this.formEditProfile.reset(JSON.parse(this.initialFormValue()));
    this.photoManager().reset();
  }

  get hasRealChanges(): boolean {
    const currentJson = JSON.stringify(this.formEditProfile.getRawValue());
    const formHasChanges = currentJson !== this.initialFormValue();
    const photoHasChanges = this.photoManager().hasChanges();
    return formHasChanges || photoHasChanges;
  }

  /** Email con el que se cargó el formulario (para saber si la persona lo cambió). */
  private get originalEmail(): string {
    try {
      return (
        (JSON.parse(this.initialFormValue()) as { email?: string }).email ?? ''
      );
    } catch {
      return '';
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.formEditProfile.valid) {
      this.formEditProfile.markAllAsTouched();
      return;
    }

    const userId = this.authService.currentUser()?.id;
    const formValue = this.formEditProfile.getRawValue();

    // Es la propia cuenta: cambiar el email o la contraseña exige confirmar con la contraseña actual
    const currentPassword = await this.currentPasswordService.requestIfNeeded({
      editingOwnAccount: true,
      changesEmail:
        (formValue.email ?? '').trim().toLowerCase() !==
        this.originalEmail.trim().toLowerCase(),
      changesPassword: !!formValue.password,
    });
    if (currentPassword === null) return; // la persona canceló: no se guarda nada

    const baseData = {
      name: formValue.name!,
      lastName: formValue.lastName!,
      dni: formValue.dni!,
      phone: formValue.phone!,
      username: formValue.username!,
      email: formValue.email!,
      role: UserRole.Admin,
    };

    const adminData = {
      ...(formValue.password
        ? {
            ...baseData,
            password: formValue.password,
            confirmPassword: formValue.confirmPassword,
          }
        : baseData),
      ...(currentPassword ? { currentPassword } : {}),
    };

    this.apiService
      .updateAdmin(userId!, adminData as Partial<ICreateAdmin>)
      .pipe(
        // Cambiar la contraseña cierra todas las sesiones de la cuenta, también esta (Supabase Auth, por seguridad):
        // se vuelve a iniciar sesión ANTES de cualquier otro pedido (la foto, la vista del perfil), que si no
        // recibirían un 401 y mostrarían "Tu sesión ya no es válida" tras un cambio que salió bien.
        switchMap(() =>
          formValue.password
            ? this.authService.renewSessionAfterPasswordChange(
                formValue.username!,
                formValue.password,
              )
            : of(true),
        ),
        switchMap((sesionVigente) => {
          if (sesionVigente) return this.photoManager().saveChanges(userId!);
          // No se pudo renovar: el servicio ya cerró la sesión y llevó al login
          this.alertService.toast(
            'Cambiaste tu contraseña',
            'info',
            'Por seguridad, ingresá de nuevo con la contraseña nueva.',
          );
          return EMPTY;
        }),
      )
      .subscribe({
        next: (photoResponse: any) => {
          this.invalidateAdmins();
          this.alertService.toast('Perfil actualizado con éxito', 'success');

          const sessionUpdates: any = {
            name: formValue.name,
            lastName: formValue.lastName,
          };

          if (photoResponse && photoResponse.id) {
            sessionUpdates.photo = photoResponse;
          } else if (this.photoManager().deletePending()) {
            sessionUpdates.photo = null;
          }

          this.authService.updateCurrentUser(sessionUpdates);

          if ('photo' in sessionUpdates) {
            this.currentPhoto.set(sessionUpdates.photo);
          }
          this.photoManager().reset();
          this.formEditProfile.reset({
            ...formValue,
            password: '',
            confirmPassword: '',
          });
          this.snapshotInitial();
        },
      });
  }
}
