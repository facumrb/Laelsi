import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IApiClient } from '@models/user.model';
import { AlertService } from '@services/alert.service';
import { ApiClientService } from '@services/api-services/api-client.service';
import { ClientsPageComponent } from './clients-page.component';

// ID 65 de docs/requerimientos/discusiones.md: a un cliente no se lo elimina, se lo desactiva y se lo puede reactivar.
// Recorre la página de punta a punta: lista, tacho, modal y botón.
describe('ClientsPageComponent: desactivar y reactivar clientes', () => {
  const cliente = (id: number, state: 'Activo' | 'Inactivo'): IApiClient =>
    ({
      id,
      name: 'Ana',
      lastName: 'Pérez',
      dni: '30123456',
      phone: '3415550000',
      username: `ana${id}`,
      email: `ana${id}@ejemplo.test`,
      role: 'Client',
      photo: null,
      state,
      fiscalCondition: 'Consumidor Final',
    }) as unknown as IApiClient;

  const api = { getAllClients: vi.fn(), searchClients: vi.fn(), setClientState: vi.fn() };
  const alerta = { toast: vi.fn() };

  function abrir(clientes: IApiClient[]) {
    api.getAllClients.mockReturnValue(of({ data: clientes, totalPages: 1, total: clientes.length, page: 1, limit: 16 }));
    api.setClientState.mockReturnValue(of(void 0));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ApiClientService, useValue: api },
        { provide: AlertService, useValue: alerta },
      ],
    });
    const fixture = TestBed.createComponent(ClientsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  const boton = (raiz: HTMLElement, selector: string, texto?: string) =>
    Array.from(raiz.querySelectorAll<HTMLButtonElement>(selector)).find((b) => !texto || b.textContent?.trim() === texto);

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('el botón de un cliente activo dice Desactivar (no Eliminar) y abre el modal, sin opción de eliminar', () => {
    const fixture = abrir([cliente(5, 'Activo')]);
    const raiz = fixture.nativeElement as HTMLElement;

    boton(raiz, 'button[aria-label="Desactivar"]')!.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Desactivar cliente');
    expect(boton(raiz, 'button', 'Desactivar')).toBeTruthy();
    expect(boton(raiz, 'button', 'Eliminar permanentemente')).toBeUndefined();
  });

  it('al abrir la página pide la lista una sola vez (no dos)', () => {
    abrir([cliente(5, 'Activo')]);

    expect(api.getAllClients).toHaveBeenCalledTimes(1);
  });

  it('confirmar en el modal desactiva al cliente con PATCH al estado Inactivo y recarga la lista', () => {
    const fixture = abrir([cliente(5, 'Activo')]);
    const raiz = fixture.nativeElement as HTMLElement;
    boton(raiz, 'button[aria-label="Desactivar"]')!.click();
    fixture.detectChanges();

    boton(raiz, 'button', 'Desactivar')!.click();
    fixture.detectChanges();

    expect(api.setClientState).toHaveBeenCalledWith(5, 'Inactivo');
    expect(alerta.toast).toHaveBeenCalledWith('Cliente desactivado', 'success');
    expect(raiz.textContent).not.toContain('Desactivar cliente'); // el modal se cierra
    expect(api.getAllClients).toHaveBeenCalledTimes(2); // carga inicial y recarga
  });

  it('un cliente inactivo muestra Reactivar y no Desactivar; reactivar manda el estado Activo', () => {
    const fixture = abrir([cliente(6, 'Inactivo')]);
    const raiz = fixture.nativeElement as HTMLElement;

    expect(boton(raiz, 'button[aria-label="Desactivar"]')).toBeUndefined();
    boton(raiz, 'button[aria-label="Reactivar"]')!.click();
    fixture.detectChanges();

    expect(api.setClientState).toHaveBeenCalledWith(6, 'Activo');
    expect(alerta.toast).toHaveBeenCalledWith('Cliente reactivado', 'success');
  });
});
