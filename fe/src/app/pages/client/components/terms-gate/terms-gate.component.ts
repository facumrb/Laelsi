import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { UserRole } from '@models/user.model';
import { AuthService } from '@services/auth.service';
import {
  ModalDescriptionDirective,
  ModalShellComponent,
} from '@shared/components/modals/modal-shell/modal-shell.component';
import { LEGAL_INFO } from '@client/pages/footer-pages/legal-info';

/*
Pide aceptar los Términos y Condiciones y la Política de Privacidad a las cuentas que todavía no
lo hicieron: las creadas con Google (se crean al volver de Google, sin casilla) y las anteriores a
la casilla del registro. La aceptación queda registrada en el servidor, con fecha y versión.

Es un diálogo bloqueante: hay que aceptar para seguir usando la cuenta, o cerrar la sesión.
Vive en el layout de la tienda y NO en AppComponent: AuthService depende de localStorage y AppComponent
se renderiza en el servidor al pre-renderizar las páginas legales.
*/
@Component({
  selector: 'app-terms-gate',
  imports: [RouterLink, ModalShellComponent, ModalDescriptionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms-gate.component.html',
})
export class TermsGateComponent {
  private authService = inject(AuthService);

  readonly legal = LEGAL_INFO;

  // Casilla de aceptación marcada
  accepted = signal(false);
  // Aceptación en curso: evita el doble envío
  saving = signal(false);

  /*
  Solo las cuentas de clientes aceptan los Términos. `false` = todavía no los aceptó, `undefined` es
  una copia local vieja que se está completando desde el servidor, y ahí no se molesta a nadie.
  */
  needsAcceptance = computed(() => {
    const user = this.authService.currentUser();
    return user?.role === UserRole.Client && user.termsAccepted === false;
  });

  // Registra la aceptación en el servidor
  accept(): void {
    if (!this.accepted() || this.saving()) return;

    this.saving.set(true);
    this.authService
      .acceptTerms(this.legal.version)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        // Si falla, el interceptor de errores ya le muestra el motivo: acá solo se evita que la
        // excepción se escape como "no manejada" y la persona puede reintentar
        error: () => undefined,
      });
  }

  // Cierra la sesión en lugar de aceptar
  logout(): void {
    this.authService.logout();
  }
}
