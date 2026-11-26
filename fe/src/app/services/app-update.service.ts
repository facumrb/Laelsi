import { DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { AlertService } from '@services/alert.service';

// Recarga la página. Es un token para poder reemplazarlo en las pruebas, que no pueden recargar de verdad.
export const RECARGAR_PAGINA = new InjectionToken<() => void>(
  'RECARGAR_PAGINA',
  {
    providedIn: 'root',
    factory: () => () => window.location.reload(),
  },
);

/*
 Avisa cuando hay una versión nueva del sitio.

 El sitio guarda su código en el navegador (service worker): al publicar una versión nueva, el navegador la
 baja en segundo plano, pero sigue mostrando la vieja hasta que se cierra y se vuelve a abrir el sitio dos
 veces. Para quien administra el catálogo, eso se ve como "la pantalla no cambió" aunque el cambio ya esté
 publicado. Acá se le pregunta si quiere actualizar. No se recarga sola: podría estar cargando un producto.

 Si el service worker queda en un estado irrecuperable (no puede servir la versión que tiene la pestaña, por
 ejemplo porque el navegador borró parte de su caché), las partes del sitio que se cargan bajo demanda fallarían:
 en ese caso se avisa y se recarga.
*/
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private swUpdate = inject(SwUpdate);
  private alertas = inject(AlertService);
  private recargar = inject(RECARGAR_PAGINA);
  private destroyRef = inject(DestroyRef);

  // Si ya hay una pregunta abierta, no se abre otra por cada versión que llegue mientras tanto.
  private avisoAbierto = false;

  // Ya se avisó del estado irrecuperable y se va a recargar
  private recargaPendiente = false;

  // Empieza a escuchar. Con el service worker apagado (en desarrollo) no hace nada.
  iniciar(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter(
          (evento): evento is VersionReadyEvent =>
            evento.type === 'VERSION_READY',
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => void this.preguntar());

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.avisarYRecargar());
  }

  // Pregunta si actualizar ahora; si la persona acepta, activa la versión nueva y recarga
  private async preguntar(): Promise<void> {
    if (this.avisoAbierto) return;
    this.avisoAbierto = true;
    try {
      const actualizar = await this.alertas.confirmAction(
        'Hay una versión nueva',
        'Actualizá para ver los últimos cambios. Si estás cargando algo, guardalo antes de actualizar.',
        'Actualizar ahora',
      );
      if (actualizar) {
        // Si la activación falla se recarga igual: el navegador pide la versión nueva y, si no está lista, sigue con la actual
        await this.swUpdate.activateUpdate().catch(() => undefined);
        this.recargar();
      }
    } finally {
      this.avisoAbierto = false;
    }
  }

  // Estado irrecuperable: no hay nada que elegir, la pestaña solo vuelve a funcionar recargando.
  // Si el evento llega varias veces, se recarga una sola vez.
  private async avisarYRecargar(): Promise<void> {
    if (this.recargaPendiente) return;
    this.recargaPendiente = true;
    await this.alertas.modal(
      'Hay que recargar la página',
      'Esta pestaña quedó con una versión del sitio que ya no se puede usar. Al cerrar este aviso se recarga.',
      'warning',
    );
    this.recargar();
  }
}
