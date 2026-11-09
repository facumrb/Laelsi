import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IApiAdmin } from '@models/user.model';
import { AlertService } from '@services/alert.service';
import { ApiAdminService } from '@services/api-services/api-admin.service';
import { AuthService } from '@services/auth.service';
import { AdminsPageComponent } from './admins-page.component';

// ID 65 de docs/requerimientos/discusiones.md: a un administrador no se lo elimina, se lo desactiva y se lo puede
// reactivar; no se puede desactivar la propia cuenta.
describe('AdminsPageComponent: desactivar y reactivar administradores', () => {
  const admin = (id: number, state: 'Activo' | 'Inactivo'): IApiAdmin =>
    ({ id, name: 'Luz', lastName: 'Gómez', dni: '30111222', phone: '3415551111', username: `luz${id}`, email: `luz${id}@ejemplo.test`, role: 'Admin', photo: null, state }) as unknown as IApiAdmin;

  const api = { getAllAdmins: vi.fn(), searchAdmins: vi.fn(), setAdminState: vi.fn() };
  const alerta = { toast: vi.fn() };
  const MI_ID = 1;

  function abrir(admins: IApiAdmin[]) {
    api.getAllAdmins.mockReturnValue(of({ data: admins, totalPages: 1, total: admins.length, page: 1, limit: 16 }));
    api.setAdminState.mockReturnValue(of(void 0));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ApiAdminService, useValue: api },
        { provide: AlertService, useValue: alerta },
        { provide: AuthService, useValue: { currentUser: () => ({ id: MI_ID }) } },
      ],
    });
    const fixture = TestBed.createComponent(AdminsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  const boton = (raiz: HTMLElement, selector: string, texto?: string) =>
    Array.from(raiz.querySelectorAll<HTMLButtonElement>(selector)).find((b) => !texto || b.textContent?.trim() === texto);

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('al abrir la página pide la lista una sola vez (no dos)', () => {
    abrir([admin(2, 'Activo')]);

    expect(api.getAllAdmins).toHaveBeenCalledTimes(1);
  });

  it('el botón de un administrador activo dice Desactivar y desactivarlo manda el estado Inactivo', () => {
    const fixture = abrir([admin(2, 'Activo')]);
    const raiz = fixture.nativeElement as HTMLElement;

    boton(raiz, 'button[aria-label="Desactivar"]')!.click();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Desactivar administrador');
    expect(boton(raiz, 'button', 'Eliminar permanentemente')).toBeUndefined();

    boton(raiz, 'button', 'Desactivar')!.click();
    fixture.detectChanges();

    expect(api.setAdminState).toHaveBeenCalledWith(2, 'Inactivo');
    expect(alerta.toast).toHaveBeenCalledWith('Administrador desactivado', 'success');
  });

  it('un administrador no puede desactivar su propia cuenta: ve el aviso y no se manda nada', () => {
    const fixture = abrir([admin(MI_ID, 'Activo')]);
    const raiz = fixture.nativeElement as HTMLElement;

    boton(raiz, 'button[aria-label="Desactivar"]')!.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('No es posible eliminar tu propia cuenta');
    expect(api.setAdminState).not.toHaveBeenCalled();
  });

  it('un administrador inactivo muestra Reactivar; reactivar manda el estado Activo', () => {
    const fixture = abrir([admin(3, 'Inactivo')]);
    const raiz = fixture.nativeElement as HTMLElement;

    expect(boton(raiz, 'button[aria-label="Desactivar"]')).toBeUndefined();
    boton(raiz, 'button[aria-label="Reactivar"]')!.click();
    fixture.detectChanges();

    expect(api.setAdminState).toHaveBeenCalledWith(3, 'Activo');
    expect(alerta.toast).toHaveBeenCalledWith('Administrador reactivado', 'success');
  });
});
