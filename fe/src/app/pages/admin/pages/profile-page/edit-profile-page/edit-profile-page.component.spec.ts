import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IApiAdmin, UserRole } from '@models/user.model';
import { AlertService } from '@services/alert.service';
import { ApiAdminService } from '@services/api-services/api-admin.service';
import { AuthService } from '@services/auth.service';
import { CurrentPasswordService } from '@services/current-password.service';
import { EditProfilePageComponent } from './edit-profile-page.component';

// Cambiar la contraseña cierra todas las sesiones de la cuenta (Supabase Auth, por seguridad), también la de quien la
// cambió. Antes, tras guardar el perfil, se pedía la vista del perfil con el token ya revocado y aparecía el error
// "Tu sesión ya no es válida". Ahora la sesión se renueva con la contraseña nueva, antes de subir la foto y de navegar.
describe('EditProfilePageComponent: guardar con contraseña nueva', () => {
  const orden: string[] = [];
  const admin = {
    id: 2, name: 'Ana', lastName: 'Pérez', phone: '3415550000', dni: '23333390', username: 'ana.admin',
    email: 'ana@example.com', role: UserRole.Admin, photo: null,
  } as unknown as IApiAdmin;
  const api = { getAdminById: vi.fn(), updateAdmin: vi.fn() };
  const alerta = { toast: vi.fn() };
  const auth = { currentUser: () => ({ id: 2 }), renewSessionAfterPasswordChange: vi.fn(), updateCurrentUser: vi.fn() };
  const contrasenaActual = { requestIfNeeded: vi.fn() };

  async function crear(sesionVigente = true) {
    orden.length = 0;
    api.getAdminById.mockReturnValue(of(admin));
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
        { provide: ApiAdminService, useValue: api },
        { provide: AlertService, useValue: alerta },
        { provide: AuthService, useValue: auth },
        { provide: CurrentPasswordService, useValue: contrasenaActual },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(async () => {
      orden.push('navegar');
      return true;
    });
    const fixture = TestBed.createComponent(EditProfilePageComponent);
    fixture.detectChanges(); // ngOnInit carga al administrador
    const c = fixture.componentInstance;
    // La unicidad de dni, usuario y email consulta al servidor: acá no hace falta y dejaría el formulario "pendiente"
    for (const campo of ['dni', 'username', 'email'] as const) c.formEditProfile.controls[campo].clearAsyncValidators();
    c.formEditProfile.updateValueAndValidity();
    vi.spyOn(c.photoManager(), 'saveChanges').mockImplementation(() => {
      orden.push('subir foto');
      return of(null) as never;
    });
    return c;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('con contraseña nueva: guarda, renueva la sesión con el usuario y la contraseña nueva, y recién ahí sube la foto y navega', async () => {
    const c = await crear();
    c.formEditProfile.patchValue({ password: 'Nueva1234', confirmPassword: 'Nueva1234' });

    await c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).toHaveBeenCalledWith('ana.admin', 'Nueva1234');
    expect(orden).toEqual(['guardar', 'renovar sesión', 'subir foto', 'navegar']);
  });

  it('usa el usuario con el que quedó la cuenta si cambió en el mismo guardado', async () => {
    const c = await crear();
    c.formEditProfile.patchValue({ username: 'ana.nueva', password: 'Otra5678x', confirmPassword: 'Otra5678x' });

    await c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).toHaveBeenCalledWith('ana.nueva', 'Otra5678x');
  });

  it('si la sesión no se pudo renovar: no sube la foto ni navega al perfil, y avisa que ingrese de nuevo', async () => {
    const c = await crear(false);
    c.formEditProfile.patchValue({ password: 'Nueva1234', confirmPassword: 'Nueva1234' });

    await c.onSubmit();

    expect(orden).toEqual(['guardar', 'renovar sesión']);
    expect(alerta.toast).toHaveBeenCalledWith('Cambiaste tu contraseña', 'info', 'Por seguridad, ingresá de nuevo con la contraseña nueva.');
  });

  it('sin contraseña nueva: no toca la sesión', async () => {
    const c = await crear();

    await c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).not.toHaveBeenCalled();
    expect(orden).toEqual(['guardar', 'subir foto', 'navegar']);
  });
});
