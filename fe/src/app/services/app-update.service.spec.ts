import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AlertService } from '@services/alert.service';
import { AppUpdateService, RECARGAR_PAGINA } from './app-update.service';

// El sitio guarda su código en el navegador (service worker). Cuando se publica una versión nueva, el navegador
// la baja, pero sigue mostrando la vieja hasta que se cierra y se vuelve a abrir el sitio dos veces. Para quien
// administra el catálogo eso se ve como "la pantalla no cambió" aunque el cambio ya esté publicado. Por eso, cuando
// hay una versión lista, se le pregunta a la persona si quiere actualizar. No se recarga sola: podría estar
// cargando un producto.

const versionLista: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'vieja' },
  latestVersion: { hash: 'nueva' },
};

/** Deja correr las promesas pendientes (el aviso y la activación son asíncronos). */
const esperar = () => new Promise((resolver) => setTimeout(resolver, 0));

function armar(opciones: { habilitado?: boolean; acepta?: boolean; avisoSinResponder?: boolean } = {}) {
  const { habilitado = true, acepta = true, avisoSinResponder = false } = opciones;
  const eventos = new Subject<VersionEvent>();
  const swUpdate = { isEnabled: habilitado, versionUpdates: eventos.asObservable(), activateUpdate: vi.fn().mockResolvedValue(true) };
  const alertas = {
    confirmAction: avisoSinResponder
      ? vi.fn().mockReturnValue(new Promise<boolean>(() => undefined))
      : vi.fn().mockResolvedValue(acepta),
  };
  const recargar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SwUpdate, useValue: swUpdate },
      { provide: AlertService, useValue: alertas },
      { provide: RECARGAR_PAGINA, useValue: recargar },
    ],
  });
  TestBed.inject(AppUpdateService).iniciar();
  return { eventos, swUpdate, alertas, recargar };
}

describe('AppUpdateService', () => {
  it('cuando hay una versión lista, le pregunta a la persona si quiere actualizar', async () => {
    const { eventos, alertas } = armar();

    eventos.next(versionLista);
    await esperar();

    expect(alertas.confirmAction).toHaveBeenCalledTimes(1);
    expect(alertas.confirmAction.mock.calls[0][0]).toBe('Hay una versión nueva');
    expect(alertas.confirmAction.mock.calls[0][2]).toBe('Actualizar ahora');
  });

  it('si acepta, activa la versión nueva y recién entonces recarga la página', async () => {
    const { eventos, swUpdate, recargar } = armar({ acepta: true });

    eventos.next(versionLista);
    await esperar();

    expect(swUpdate.activateUpdate).toHaveBeenCalledTimes(1);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(swUpdate.activateUpdate.mock.invocationCallOrder[0]).toBeLessThan(recargar.mock.invocationCallOrder[0]);
  });

  it('si no acepta, no activa nada ni recarga', async () => {
    const { eventos, alertas, swUpdate, recargar } = armar({ acepta: false });

    eventos.next(versionLista);
    await esperar();

    expect(alertas.confirmAction).toHaveBeenCalledTimes(1);
    expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
    expect(recargar).not.toHaveBeenCalled();
  });

  it('ignora los eventos que no son una versión lista', async () => {
    const { eventos, alertas } = armar();

    eventos.next({ type: 'VERSION_DETECTED', version: { hash: 'nueva' } });
    eventos.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'vieja' } });
    await esperar();

    expect(alertas.confirmAction).not.toHaveBeenCalled();
  });

  it('con el service worker apagado (en desarrollo) no pregunta nada', async () => {
    const { eventos, alertas } = armar({ habilitado: false });

    eventos.next(versionLista);
    await esperar();

    expect(alertas.confirmAction).not.toHaveBeenCalled();
  });

  it('si llegan dos versiones mientras el aviso sigue abierto, pregunta una sola vez', async () => {
    const { eventos, alertas } = armar({ avisoSinResponder: true });

    eventos.next(versionLista);
    eventos.next(versionLista);
    await esperar();

    expect(alertas.confirmAction).toHaveBeenCalledTimes(1);
  });
});
