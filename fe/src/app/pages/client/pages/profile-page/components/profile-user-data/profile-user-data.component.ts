import {
  ChangeDetectionStrategy,
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
import { IApiClient, IUpdateClient } from '@models/user.model';
import { ApiClientService } from '@services/api-services/api-client.service';
import { AlertService } from '@services/alert.service';
import { PhotoManagerComponent } from '@shared/components/photo-manager/photo-manager.component';
import { FormUtils } from '@shared/validators/form-utils';
import { switchMap, of, EMPTY } from 'rxjs';
import { AuthService } from '@services/auth.service';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { PasswordInputComponent } from '@shared/components/inputs/password/password-input/password-input.component';
import { PasswordRuleHintComponent } from '@shared/components/inputs/password/password-rule-hint/password-rule-hint.component';
import { VerifyPasswordModalComponent } from '@shared/components/modals/verify-password-modal/verify-password-modal.component';

@Component({
  selector: 'app-profile-user-data',
  imports: [
    ReactiveFormsModule,
    NgIconComponent,
    PhotoManagerComponent,
    FieldErrorComponent,
    TrimInputDirective,
    PasswordInputComponent,
    PasswordRuleHintComponent,
    VerifyPasswordModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ bootstrapShieldLock })],
  templateUrl: './profile-user-data.component.html',
})
export class ProfileUserDataComponent {
  private fb = inject(FormBuilder);
  private apiClientService = inject(ApiClientService);
  private http = inject(HttpClient);
  private alertService = inject(AlertService);
  private authService = inject(AuthService);

  // Perfil que muestra el formulario. Lo pasa ProfilePageComponent al activar la pestaña
  profile = input<IApiClient | null>(null);

  // Avisa que se guardaron los datos, para recargar el perfil
  profileUpdated = output<void>();
  photoManager = viewChild.required(PhotoManagerComponent);

  // Guardado en curso
  saving = signal(false);
  // Los campos de contraseña nueva se muestran recién después de verificar la actual
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

  // Valores con los que se cargó el formulario: sirven para saber si hay cambios y para descartarlos
  private initialValue = signal<string | null>(null);
  private formValue = toSignal(this.formUsuario.valueChanges);
  /*
  Estado del formulario como signal: la validación asíncrona del nombre de usuario termina sin un evento
  de la plantilla y, con OnPush, el botón de guardar no se enteraría
  */
  private formStatus = toSignal(this.formUsuario.statusChanges, {
    initialValue: this.formUsuario.status,
  });

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

  // Carga el perfil en el formulario y lo toma como punto de partida para detectar cambios
  private patchForm(fullUser: IApiClient) {
    this.formUsuario.patchValue({
      username: fullUser.username || '',
    });

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

  // Descarta los cambios (también la foto) y sale del modo de cambiar contraseña
  discardChanges() {
    const initial = this.initialValue();
    if (initial !== null) this.formUsuario.reset(JSON.parse(initial));
    this.photoManager().reset();
    this.isChangePasswordMode.set(false);
    this.verifiedCurrentPassword = null;
  }

  // Pide la contraseña actual antes de dejar escribir una nueva
  startPasswordChange() {
    this.showVerifyModal.set(true);
  }

  // La contraseña actual es correcta: se habilitan los campos de la nueva
  onPasswordVerified(password: string) {
    this.verifiedCurrentPassword = password;
    this.showVerifyModal.set(false);
    this.isChangePasswordMode.set(true);
    this.alertService.toast('Contraseña verificada correctamente', 'success');
  }

  onSubmit() {
    if (this.saving()) return;
    if (!this.formUsuario.valid) {
      this.formUsuario.markAllAsTouched();
      return;
    }

    const userId = this.profile()?.id;
    if (!userId) return;

    this.saving.set(true);
    const rawValue = this.formUsuario.getRawValue();

    const clientData: IUpdateClient = {
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
                rawValue.username,
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
          // La foto ya se guardó: sin esto el archivo queda pendiente y un segundo guardado lo vuelve a subir
          this.photoManager().markSaved();
          this.alertService.toast('Datos de usuario actualizados', 'success');
          this.formUsuario.controls.password.setValue('');
          this.formUsuario.controls.confirmPassword.setValue('');
          this.profileUpdated.emit();
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }
}
