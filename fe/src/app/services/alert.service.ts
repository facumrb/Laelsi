import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  DetalleAviso,
  DialogService,
  ResultadoAviso,
  TipoAviso,
} from '@services/ui/dialog.service';
import {
  filtrarTelefono,
  LARGO_MAXIMO_TELEFONO,
  validarTelefono,
} from '@shared/utils/telefono';

export type {
  DatoAviso,
  DetalleAviso,
  ResultadoAviso,
  TipoAviso,
} from '@services/ui/dialog.service';

type SweetAlert = typeof import('sweetalert2').default;

export const CARGAR_SWEETALERT = new InjectionToken<() => Promise<SweetAlert>>(
  'CARGAR_SWEETALERT',
  {
    providedIn: 'root',
    factory: () => () => import('sweetalert2').then((m) => m.default),
  },
);

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly dialogos = inject(DialogService);
  private readonly cargarSwal = inject(CARGAR_SWEETALERT);

  /** El título y el texto se muestran como texto plano (`titleText`, `text`): nunca se interpretan como HTML. */
  async toast(title: string, icon: TipoAviso = 'success', text?: string) {
    const Swal = await this.cargarSwal();
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
      icon,
      titleText: title,
      text,
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      },
    });
  }

  error(title: string, message: string) {
    this.toast(title, 'error', message);
  }

  success(title: string, message?: string) {
    this.toast(title, 'success', message);
  }

  /**
   * Aviso con un solo botón ("Entendido"), para mensajes como "Sesión expirada" o "Error de conexión". `texto` es
   * texto plano; `detalle` agrega datos destacados (por ejemplo, el alias de pago), también como texto.
   */
  modal(
    title: string,
    texto: string,
    icon: TipoAviso = 'info',
    detalle?: DetalleAviso,
  ): Promise<ResultadoAviso> {
    return this.dialogos.avisar({
      titulo: title,
      mensaje: texto,
      icono: icon,
      textoConfirmar: 'Entendido',
      detalle,
    });
  }

  confirmDelete(message: string = 'No podrás revertir esto'): Promise<boolean> {
    return this.dialogos.confirmar({
      titulo: '¿Estás seguro?',
      mensaje: message,
      icono: 'warning',
      peligro: true,
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar',
    });
  }

  confirmAction(
    title: string,
    message: string,
    confirmButtonText: string = 'Sí, confirmar',
  ): Promise<boolean> {
    return this.dialogos.confirmar({
      titulo: title,
      mensaje: message,
      icono: 'question',
      peligro: false,
      textoConfirmar: confirmButtonText,
      textoCancelar: 'Cancelar',
    });
  }

  /**
   * Pide un teléfono de contacto (al confirmar un pedido, si el cliente no lo tiene cargado). Devuelve el
   * teléfono sin espacios de los bordes, o null si la persona cancela. Las reglas están en shared/utils/telefono.ts.
   */
  askPhone(text: string): Promise<string | null> {
    return this.dialogos.pedirDato({
      titulo: 'Teléfono de contacto',
      mensaje: text,
      tipo: 'tel',
      etiqueta: 'Teléfono',
      placeholder: 'Ej: 341 555-0000',
      autocomplete: 'tel',
      textoConfirmar: 'Guardar y continuar',
      textoCancelar: 'Cancelar',
      validar: (valor) => validarTelefono(valor),
      filtro: filtrarTelefono,
      largoMaximo: LARGO_MAXIMO_TELEFONO,
      recortar: true,
    });
  }

  /*
  Pide la contraseña actual de la cuenta, en el mismo modal que se usa para cambiar la contraseña
  (VerifyPasswordModalComponent: con el botón para verla y verificada en el servidor antes de cerrar).
  Confirma el cambio del email o de la contraseña propios: con solo la sesión iniciada no alcanza.
  Devuelve la contraseña tal cual (los espacios pueden ser parte de ella), o null si la persona cancela.
  usuario: el de la cuenta, para que el navegador ofrezca la contraseña guardada.
  */
  askCurrentPassword(text: string, usuario?: string): Promise<string | null> {
    return this.dialogos.verificarContrasena({ mensaje: text, usuario });
  }
}
