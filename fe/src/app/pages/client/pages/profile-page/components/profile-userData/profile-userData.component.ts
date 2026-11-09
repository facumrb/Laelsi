import {
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapShieldLock } from '@ng-icons/bootstrap-icons';
import { IApiClient } from '@models/user.model';
import { ApiClientService } from '@services/api-services/api-client.service';
import { AlertService } from '@services/alert.service';
import { PhotoManagerComponent } from '@shared/components/photo-manager/photo-manager.component';
import { FormUtils } from '@shared/validators/form-utils';
import { switchMap, of, catchError, EMPTY } from 'rxjs';
import { AuthService } from '@services/auth.service';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';

@Component({
  selector: 'app-profile-user',
  imports: [
    ReactiveFormsModule,
    NgIconComponent,
    PhotoManagerComponent,
    FieldErrorComponent,
    TrimInputDirective,
  ],
  viewProviders: [provideIcons({ bootstrapShieldLock })],
  templateUrl: './profile-userData.component.html',
})
export class ProfileUserComponent {
  private fb = inject(FormBuilder);
  private apiClientService = inject(ApiClientService);
  private http = inject(HttpClient);
  private alertService = inject(AlertService);
  private authService = inject(AuthService);

  profile = input<IApiClient | null>(null);

  profileUpdated = output<void>();
  photoManager = viewChild.required(PhotoManagerComponent);

  saving = signal(false);
  isChangePasswordMode = signal(false);

  // La contraseña actual que la persona escribió y el servidor verificó. Se envía junto con la nueva:
  // el servidor la vuelve a exigir, porque con solo la sesión iniciada no alcanza para cambiarla.
  private verifiedCurrentPassword: string | null = null;

  formUsuario = this.fb.nonNullable.group({
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
    password: [
      '',
      [FormUtils.maxLength(100), Validators.pattern(FormUtils.passwordPattern)],
    ],
    confirmPassword: [
      '',
      [FormUtils.maxLength(100), Validators.pattern(FormUtils.passwordPattern)],
    ],
  }, {
    validators: [FormUtils.isFieldOneEqualFieldTwo('password', 'confirmPassword')]
  });

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (profile) {
        this.patchForm(profile);
      }
    });
  }

  private patchForm(fullUser: IApiClient) {
    this.formUsuario.patchValue({
      username: fullUser.username || '',
    });

    // Validación async para edición
    this.formUsuario.controls.username.setAsyncValidators(
      FormUtils.uniqueFieldValidator(
        'Client',
        'username',
        this.http,
        fullUser.id,
      ),
    );
  }

  async startPasswordChange() {
    // Se carga bajo demanda para mantener sweetalert2 fuera del bundle inicial
    const { default: Swal } = await import('sweetalert2');
    const { value: password } = await Swal.fire({
      title: 'Verificar identidad',
      text: 'Por favor, ingresa tu contraseña actual para continuar.',
      input: 'password',
      inputPlaceholder: 'Tu contraseña actual',
      showCancelButton: true,
      confirmButtonText: 'Verificar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3d4494',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
      },
      inputValidator: (value) => {
        if (!value) {
          return 'Debes ingresar una contraseña';
        }
        return null;
      },
    });

    if (password) {
      this.authService.verifyPassword(password).subscribe({
        next: () => {
          this.verifiedCurrentPassword = password;
          this.isChangePasswordMode.set(true);
          this.alertService.toast('Contraseña verificada correctamente', 'success');
        },
        error: (err) => {
          this.alertService.error('Error de verificación', err.error?.message || 'Contraseña incorrecta');
        },
      });
    }
  }

  onSubmit() {
    if (!this.formUsuario.valid) {
      this.formUsuario.markAllAsTouched();
      return;
    }

    const userId = this.profile()?.id;
    if (!userId) return;

    this.saving.set(true);
    const rawValue = this.formUsuario.getRawValue();

    const clientData: any = {
      username: rawValue.username,
    };
    if (rawValue.password && rawValue.password.trim() !== '') {
      clientData.password = rawValue.password;
      if (this.verifiedCurrentPassword) {
        clientData.currentPassword = this.verifiedCurrentPassword;
      }
    }
    const nuevaContrasena: string | undefined = clientData.password;
    this.apiClientService
      .updateClient(userId, clientData)
      .pipe(
        // Cambiar la contraseña cierra todas las sesiones de la cuenta, también esta (Supabase Auth, por seguridad):
        // se vuelve a iniciar sesión ANTES de cualquier otro pedido (la foto, la recarga del perfil), que si no
        // recibirían un 401 y mostrarían "Tu sesión ya no es válida" tras un cambio que salió bien.
        switchMap(() =>
          nuevaContrasena
            ? this.authService.renewSessionAfterPasswordChange(clientData.username, nuevaContrasena)
            : of(true),
        ),
        switchMap((sesionVigente) => {
          if (sesionVigente) return this.photoManager().saveChanges(userId);
          // No se pudo renovar: el servicio ya cerró la sesión y llevó al login
          this.saving.set(false);
          this.alertService.toast(
            'Cambiaste tu contraseña',
            'info',
            'Por seguridad, ingresá de nuevo con la contraseña nueva.',
          );
          return EMPTY;
        }),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.isChangePasswordMode.set(false);
          // Ya se usó: no se guarda más tiempo del necesario (si el guardado falla se conserva para reintentar)
          this.verifiedCurrentPassword = null;
          this.alertService.toast('Datos de usuario actualizados', 'success');
          this.formUsuario.get('password')?.setValue('');
          this.formUsuario.get('confirmPassword')?.setValue('');
          this.profileUpdated.emit();
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }
}
