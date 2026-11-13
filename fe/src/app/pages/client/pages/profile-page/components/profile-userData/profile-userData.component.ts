import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapShieldLock } from '@ng-icons/bootstrap-icons';
import { IApiClient } from '@models/user.model';
import { ApiClientService } from '@services/api-services/api-client.service';
import { AlertService } from '@services/alert.service';
import { PhotoManagerComponent } from '@shared/components/photo-manager/photo-manager.component';
import { FormUtils } from '@shared/validators/form-utils';
import { switchMap, of, EMPTY } from 'rxjs';
import { AuthService } from '@services/auth.service';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { PasswordToggleButtonComponent } from '@shared/components/buttons/password-toggle-button/password-toggle-button.component';
import { VerifyPasswordModalComponent } from './verify-password-modal/verify-password-modal.component';

@Component({
  selector: 'app-profile-user',
  imports: [
    ReactiveFormsModule,
    NgIconComponent,
    PhotoManagerComponent,
    FieldErrorComponent,
    TrimInputDirective,
    PasswordToggleButtonComponent,
    VerifyPasswordModalComponent,
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
  showVerifyModal = signal(false);

  // La contraseña actual que la persona escribió y el servidor verificó. Se envía junto con la nueva:
  // el servidor la vuelve a exigir, porque con solo la sesión iniciada no alcanza para cambiarla.
  private verifiedCurrentPassword: string | null = null;

  formUsuario = this.fb.nonNullable.group(
    {
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
    this.formUsuario.controls.password.valueChanges,
  );
  private confirmPasswordValue = toSignal(
    this.formUsuario.controls.confirmPassword.valueChanges,
  );

  private passwordControl = this.formUsuario.controls.password;
  private passwordEvents = toSignal(this.passwordControl.events);

  // La regla de la contraseña se muestra siempre (reserva su espacio) y pasa a rojo cuando no se cumple
  passwordHintError = computed(() => {
    this.passwordEvents();
    return this.passwordControl.touched && this.passwordControl.invalid;
  });

  showEyeIcon = computed(() => !!this.passwordValue());
  showConfirmEyeIcon = computed(() => !!this.confirmPasswordValue());

  // Valores con los que se cargó el formulario: sirven para saber si hay cambios y para descartarlos
  private initialValue = signal<string | null>(null);
  private formValue = toSignal(this.formUsuario.valueChanges);

  hasChanges = computed(() => {
    this.formValue();
    const initial = this.initialValue();
    const formChanged =
      initial !== null &&
      JSON.stringify(this.formUsuario.getRawValue()) !== initial;
    return formChanged || this.photoManager().hasChanges();
  });

  // En modo contraseña también se puede cancelar sin haber escrito nada, para salir de ese modo
  canDiscard = computed(() => this.hasChanges() || this.isChangePasswordMode());

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

    this.initialValue.set(JSON.stringify(this.formUsuario.getRawValue()));
  }

  discardChanges() {
    const initial = this.initialValue();
    if (initial !== null) this.formUsuario.reset(JSON.parse(initial));
    this.photoManager().reset();
    this.isChangePasswordMode.set(false);
    this.verifiedCurrentPassword = null;
    this.passwordVisible.set(false);
    this.confirmPasswordVisible.set(false);
  }

  startPasswordChange() {
    this.showVerifyModal.set(true);
  }

  onPasswordVerified(password: string) {
    this.verifiedCurrentPassword = password;
    this.showVerifyModal.set(false);
    this.isChangePasswordMode.set(true);
    this.alertService.toast('Contraseña verificada correctamente', 'success');
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
            ? this.authService.renewSessionAfterPasswordChange(
                clientData.username,
                nuevaContrasena,
              )
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
