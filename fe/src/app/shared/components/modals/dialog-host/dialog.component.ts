import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  bootstrapCheckCircle,
  bootstrapExclamationTriangle,
  bootstrapInfoCircle,
  bootstrapQuestionCircle,
  bootstrapTelephone,
  bootstrapXCircle,
} from '@ng-icons/bootstrap-icons';
import {
  ModalDescriptionDirective,
  ModalShellComponent,
  ModalTone,
} from '@shared/components/modals/modal-shell/modal-shell.component';
import { VerifyPasswordModalComponent } from '@shared/components/modals/verify-password-modal/verify-password-modal.component';
import type {
  Dialogo,
  SalidaDialogo,
  TipoAviso,
} from '@services/ui/dialog.service';

const TONOS: Record<TipoAviso, ModalTone> = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
  question: 'info',
};

const ICONOS: Record<TipoAviso, string> = {
  success: 'bootstrapCheckCircle',
  error: 'bootstrapXCircle',
  warning: 'bootstrapExclamationTriangle',
  info: 'bootstrapInfoCircle',
  question: 'bootstrapQuestionCircle',
};

let siguienteId = 0;

/*
Un diálogo de DialogService pintado sobre app-modal-shell: aviso, confirmación o pedido de un dato. Lo usa solo
`<app-dialog-host>`, que lo carga de forma diferida.

Foco inicial: el campo, si pide un dato. Si no, el botón de confirmar.
*/
@Component({
  selector: 'app-dialog',
  imports: [
    ModalShellComponent,
    ModalDescriptionDirective,
    VerifyPasswordModalComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapCheckCircle,
      bootstrapExclamationTriangle,
      bootstrapInfoCircle,
      bootstrapQuestionCircle,
      bootstrapTelephone,
      bootstrapXCircle,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
})
export class DialogComponent {
  readonly dialogo = input.required<Dialogo>();
  readonly cerrar = output<SalidaDialogo>();

  private readonly n = ++siguienteId;
  protected readonly campoId = `dialogo-${this.n}-campo`;
  protected readonly errorId = `dialogo-${this.n}-error`;

  protected readonly valor = signal('');
  protected readonly error = signal<string | null>(null);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  protected readonly aviso = computed(() => {
    const d = this.dialogo();
    return d.clase === 'aviso' ? d : null;
  });
  protected readonly confirmacion = computed(() => {
    const d = this.dialogo();
    return d.clase === 'confirmacion' ? d : null;
  });
  protected readonly entrada = computed(() => {
    const d = this.dialogo();
    return d.clase === 'entrada' ? d : null;
  });
  protected readonly contrasena = computed(() => {
    const d = this.dialogo();
    return d.clase === 'contrasena' ? d : null;
  });

  protected readonly tono = computed<ModalTone>(() => {
    const d = this.dialogo();
    if (d.clase === 'entrada' || d.clase === 'contrasena') return 'info';
    if (d.clase === 'confirmacion' && d.peligro) return 'danger';
    return TONOS[d.icono];
  });
  protected readonly icono = computed(() => {
    const d = this.dialogo();
    if (d.clase === 'entrada') return 'bootstrapTelephone';
    if (d.clase === 'contrasena') return '';
    return ICONOS[d.icono];
  });

  protected confirmar(): void {
    this.cerrar.emit({ confirmado: true });
  }

  // La contraseña ya se verificó en el servidor: se devuelve para enviarla con el cambio
  protected contrasenaVerificada(valor: string): void {
    this.cerrar.emit({ confirmado: true, valor });
  }

  protected descartar(): void {
    this.cerrar.emit({ confirmado: false });
  }

  protected alEscribir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const { filtro, largoMaximo } = this.entrada() ?? {};
    const original = campo.value;
    let valor = filtro ? filtro(original) : original;
    if (largoMaximo != null) valor = valor.slice(0, largoMaximo);
    if (valor !== original) {
      const antesDelCursor = original.slice(
        0,
        campo.selectionStart ?? original.length,
      );
      const cursor = Math.min(
        filtro ? filtro(antesDelCursor).length : antesDelCursor.length,
        valor.length,
      );
      campo.value = valor;
      campo.setSelectionRange(cursor, cursor);
    }
    this.valor.set(valor);
    this.error.set(null);
  }

  protected enviar(): void {
    const d = this.entrada();
    if (!d) return;
    const error = d.validar(this.valor());
    if (error) {
      this.error.set(error);
      this.campo()?.nativeElement.focus();
      return;
    }
    this.cerrar.emit({ confirmado: true, valor: this.valor() });
  }
}
