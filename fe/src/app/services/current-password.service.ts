import { inject, Injectable } from '@angular/core';
import { AlertService } from './alert.service';
import { AuthService } from './auth.service';

/*
 Pide la contraseña actual cuando alguien cambia el email o la contraseña de SU PROPIA cuenta.

 El servidor lo exige: con solo la sesión iniciada (por ejemplo, un token robado con un XSS) no
 alcanza para quedarse con la cuenta. Un administrador que edita a OTRA persona no pasa por acá.
*/
@Injectable({ providedIn: 'root' })
export class CurrentPasswordService {
  private authService = inject(AuthService);
  private alertService = inject(AlertService);

  /*
   Devuelve:
    - `undefined`: no hace falta pedirla (no se cambia nada sensible, se edita a otra persona, o la
      cuenta no tiene contraseña porque entra solo con Google). Se sigue sin enviarla.
    - `null`: la persona canceló. No hay que guardar nada.
    - `string`: la contraseña actual, para enviarla junto con el cambio.
  */
  async requestIfNeeded(change: {
    editingOwnAccount: boolean;
    changesEmail: boolean;
    changesPassword: boolean;
    // Usuario de la cuenta, para que el navegador ofrezca la contraseña guardada
    username?: string;
  }): Promise<string | null | undefined> {
    if (
      !change.editingOwnAccount ||
      !(change.changesEmail || change.changesPassword)
    ) {
      return undefined;
    }
    // false = cuenta de solo Google. Si todavía no se sabe (undefined), se pide: el servidor decide
    if (this.authService.currentUser()?.hasPassword === false) return undefined;

    const what =
      change.changesEmail && change.changesPassword
        ? 'tu email y tu contraseña'
        : change.changesPassword
          ? 'tu contraseña'
          : 'tu email';

    return this.alertService.askCurrentPassword(
      `Para cambiar ${what} necesitamos tu contraseña actual.`,
      change.username,
    );
  }
}
