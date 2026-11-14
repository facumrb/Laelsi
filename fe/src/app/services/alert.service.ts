import { Injectable } from '@angular/core';
import type { SweetAlertIcon } from 'sweetalert2';
import { validarTelefono } from '@shared/utils/telefono';

// sweetalert2 se carga bajo demanda: queda fuera del bundle inicial (~79 kB)
// y solo se descarga la primera vez que se muestra una alerta.
const cargarSwal = () => import('sweetalert2').then((m) => m.default);

@Injectable({ providedIn: 'root' })
export class AlertService {
  async toast(title: string, icon: SweetAlertIcon = 'success', text?: string) {
    const Swal = await cargarSwal();
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
      icon: icon,
      title: title,
      text: text,
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

  // Modal para mensajes como "Sesión expirada" o "Error de red crítico".
  async modal(title: string, html: string, icon: SweetAlertIcon = 'info') {
    const Swal = await cargarSwal();
    return Swal.fire({
      title,
      html,
      icon,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#16a34a',
    });
  }

  async confirmDelete(message: string = 'No podrás revertir esto'): Promise<boolean> {
    const Swal = await cargarSwal();
    return Swal.fire({
      title: '¿Estás seguro?',
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => result.isConfirmed);
  }

  async confirmAction(
    title: string,
    message: string,
    confirmButtonText: string = 'Sí, confirmar',
  ): Promise<boolean> {
    const Swal = await cargarSwal();
    return Swal.fire({
      title: title,
      text: message,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#d33',
      confirmButtonText: confirmButtonText,
      cancelButtonText: 'Cancelar',
    }).then((result) => result.isConfirmed);
  }

  /**
   * Pide un teléfono de contacto (al confirmar un pedido, si el cliente no lo tiene cargado). Devuelve el
   * teléfono sin espacios de los bordes, o null si la persona cancela. Las reglas están en shared/utils/telefono.ts.
   */
  async askPhone(text: string): Promise<string | null> {
    const Swal = await cargarSwal();
    const { value } = await Swal.fire({
      title: 'Teléfono de contacto',
      text,
      input: 'tel',
      inputPlaceholder: 'Ej.: 341 555-0000',
      showCancelButton: true,
      confirmButtonText: 'Guardar y continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3d4494',
      inputAttributes: { autocomplete: 'tel' },
      inputValidator: (valor) => validarTelefono(valor ?? ''),
    });
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  }

  /**
   * Pide la contraseña actual de la cuenta. Se usa para confirmar el cambio del email o de la
   * contraseña propios: con solo la sesión iniciada no alcanza. Devuelve null si la persona cancela.
   */
  async askCurrentPassword(text: string): Promise<string | null> {
    const Swal = await cargarSwal();
    const { value } = await Swal.fire({
      title: 'Confirmá que sos vos',
      text,
      input: 'password',
      inputPlaceholder: 'Tu contraseña actual',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3d4494',
      inputAttributes: { autocapitalize: 'off', autocorrect: 'off', autocomplete: 'current-password' },
      inputValidator: (valor) => (valor ? null : 'Tenés que ingresar tu contraseña actual'),
    });
    // La contraseña se devuelve tal cual: no se recorta (los espacios pueden ser parte de ella)
    return typeof value === 'string' && value !== '' ? value : null;
  }
}
