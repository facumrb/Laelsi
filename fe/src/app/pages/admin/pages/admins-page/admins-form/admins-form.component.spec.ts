import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IApiAdmin, UserRole } from '@models/user.model';
import { AlertService } from '@services/alert.service';
import { ApiAdminService } from '@services/api-services/api-admin.service';
import { AuthService } from '@services/auth.service';
import { CurrentPasswordService } from '@services/current-password.service';
import { AdminsFormComponent } from './admins-form.component';

// Cambiar la contraseña cierra todas las sesiones de ESA cuenta (Supabase Auth, por seguridad). Si un administrador se
// edita a sí mismo desde la lista de administradores, se queda sin sesión: la sesión se renueva con la contraseña nueva,
// antes de subir la foto y de volver a la lista. Si edita a OTRO administrador, su propia sesión no se toca.
describe('AdminsFormComponent: cambiar la contraseña de un administrador', () => {
  const orden: string[] = [];
  const admin = {
    id: 2, name: 'Ana', lastName: 'Pérez', phone: '3415550000', dni: '23333390', username: 'ana.admin',
    email: 'ana@example.com', role: UserRole.Admin, photo: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
  } as unknown as IApiAdmin;
  const api = { getAdminById: vi.fn(), updateAdmin: vi.fn(), addAdmin: vi.fn() };
  const alerta = { toast: vi.fn() };
  const auth = { currentUser: () => ({ id: 2 }), renewSessionAfterPasswordChange: vi.fn(), updateCurrentUser: vi.fn() };
  const contrasenaActual = { requestIfNeeded: vi.fn() };

  async function crear(idEditado: number, sesionVigente = true) {
    orden.length = 0;
    api.getAdminById.mockReturnValue(of({ ...admin, id: idEditado }));
    api.updateAdmin.mockImplementation(() => {
      orden.push('guardar');
      return of({});
    });
    auth.renewSessionAfterPasswordChange.mockImplementation(() => {
      orden.push('renovar sesión');
      return of(sesionVigente);
    });
    contrasenaActual.requestIfNeeded.mockResolvedValue('ActualX1234');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: String(idEditado) }) } } },
        { provide: ApiAdminService, useValue: api },
        { provide: AlertService, useValue: alerta },
        { provide: AuthService, useValue: auth },
        { provide: CurrentPasswordService, useValue: contrasenaActual },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(async () => {
      orden.push('volver a la lista');
      return true;
    });
    const fixture = TestBed.createComponent(AdminsFormComponent);
    fixture.detectChanges(); // ngOnInit carga al administrador
    const c = fixture.componentInstance;
    // La unicidad de dni, usuario y email consulta al servidor: acá no hace falta y dejaría el formulario "pendiente"
    for (const campo of ['dni', 'username', 'email'] as const) c.formAdmin.controls[campo].clearAsyncValidators();
    c.formAdmin.updateValueAndValidity();
    vi.spyOn(c.photoManager(), 'hasChanges').mockReturnValue(true);
    vi.spyOn(c.photoManager(), 'saveChanges').mockImplementation(() => {
      orden.push('subir foto');
      return of(null) as never;
    });
    return c;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('editándose a sí mismo: guarda, renueva la sesión con la contraseña nueva, y recién ahí sube la foto y vuelve a la lista', async () => {
    const c = await crear(2);
    c.formAdmin.patchValue({ password: 'Nueva1234', confirmPassword: 'Nueva1234' });

    await c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).toHaveBeenCalledWith('ana.admin', 'Nueva1234');
    expect(orden).toEqual(['guardar', 'renovar sesión', 'subir foto', 'volver a la lista']);
  });

  it('editándose a sí mismo, si la sesión no se pudo renovar: no sube la foto ni vuelve a la lista, y avisa', async () => {
    const c = await crear(2, false);
    c.formAdmin.patchValue({ password: 'Nueva1234', confirmPassword: 'Nueva1234' });

    await c.onSubmit();

    expect(orden).toEqual(['guardar', 'renovar sesión']);
    expect(alerta.toast).toHaveBeenCalledWith('Cambiaste tu contraseña', 'info', 'Por seguridad, ingresá de nuevo con la contraseña nueva.');
  });

  it('editando a OTRO administrador: su sesión no se toca', async () => {
    const c = await crear(5);
    c.formAdmin.patchValue({ password: 'Nueva1234', confirmPassword: 'Nueva1234' });

    await c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).not.toHaveBeenCalled();
    expect(orden).toEqual(['guardar', 'subir foto', 'volver a la lista']);
  });

  it('editándose a sí mismo pero sin cambiar la contraseña: su sesión no se toca', async () => {
    const c = await crear(2);
    c.formAdmin.patchValue({ name: 'Ana María' });

    await c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).not.toHaveBeenCalled();
    expect(orden).toEqual(['guardar', 'subir foto', 'volver a la lista']);
  });
});
