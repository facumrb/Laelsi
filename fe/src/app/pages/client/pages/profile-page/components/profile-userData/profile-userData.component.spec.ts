import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IApiClient } from '@models/user.model';
import { AlertService } from '@services/alert.service';
import { ApiClientService } from '@services/api-services/api-client.service';
import { AuthService } from '@services/auth.service';
import { ProfileUserComponent } from './profile-userData.component';

// Cambiar la contraseña cierra todas las sesiones de la cuenta (Supabase Auth, por seguridad), también la de quien
// la cambió. Antes, después de guardar, se recargaba el perfil con el token ya revocado y aparecía el error rojo
// "Tu sesión ya no es válida" tras un cambio que había salido bien. Ahora la sesión se renueva con la contraseña nueva,
// justo después del cambio y ANTES de subir la foto (que también usaría el token revocado).
describe('ProfileUserComponent: guardar con contraseña nueva', () => {
  const orden: string[] = [];
  const api = { updateClient: vi.fn() };
  const alerta = { toast: vi.fn() };
  const auth = { renewSessionAfterPasswordChange: vi.fn(), verifyPassword: vi.fn() };

  function crear(sesionVigente = true) {
    orden.length = 0;
    api.updateClient.mockImplementation(() => {
      orden.push('guardar');
      return of({});
    });
    auth.renewSessionAfterPasswordChange.mockImplementation(() => {
      orden.push('renovar sesión');
      return of(sesionVigente);
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApiClientService, useValue: api },
        { provide: AlertService, useValue: alerta },
        { provide: AuthService, useValue: auth },
      ],
    });
    const fixture = TestBed.createComponent(ProfileUserComponent);
    fixture.componentRef.setInput('profile', { id: 7, username: 'ana.perez' } as IApiClient);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    // La unicidad del usuario consulta al servidor: acá no hace falta y dejaría el formulario "pendiente"
    c.formUsuario.controls.username.clearAsyncValidators();
    c.formUsuario.updateValueAndValidity();
    vi.spyOn(c.photoManager(), 'saveChanges').mockImplementation(() => {
      orden.push('subir foto');
      return of(null) as never;
    });
    c.profileUpdated.subscribe(() => orden.push('avisar actualización'));
    return c;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('con contraseña nueva: guarda, renueva la sesión con el usuario y la contraseña nueva, y recién ahí sube la foto y avisa', () => {
    const c = crear();
    c.formUsuario.patchValue({ username: 'ana.perez', password: 'Nueva1234', confirmPassword: 'Nueva1234' });

    c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).toHaveBeenCalledWith('ana.perez', 'Nueva1234');
    expect(orden).toEqual(['guardar', 'renovar sesión', 'subir foto', 'avisar actualización']);
    expect(alerta.toast).toHaveBeenCalledWith('Datos de usuario actualizados', 'success');
  });

  it('usa el usuario NUEVO si cambió en el mismo guardado (el login es con el que quedó)', () => {
    const c = crear();
    c.formUsuario.patchValue({ username: 'ana.nueva', password: 'Otra5678x', confirmPassword: 'Otra5678x' });

    c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).toHaveBeenCalledWith('ana.nueva', 'Otra5678x');
  });

  it('si la sesión no se pudo renovar: no sube la foto ni recarga el perfil, y avisa que ingrese de nuevo', () => {
    const c = crear(false);
    c.formUsuario.patchValue({ username: 'ana.perez', password: 'Nueva1234', confirmPassword: 'Nueva1234' });

    c.onSubmit();

    expect(orden).toEqual(['guardar', 'renovar sesión']);
    expect(alerta.toast).toHaveBeenCalledWith('Cambiaste tu contraseña', 'info', 'Por seguridad, ingresá de nuevo con la contraseña nueva.');
    expect(alerta.toast).not.toHaveBeenCalledWith('Datos de usuario actualizados', 'success');
  });

  it('sin contraseña nueva: no toca la sesión', () => {
    const c = crear();
    c.formUsuario.patchValue({ username: 'ana.perez', password: '', confirmPassword: '' });

    c.onSubmit();

    expect(auth.renewSessionAfterPasswordChange).not.toHaveBeenCalled();
    expect(orden).toEqual(['guardar', 'subir foto', 'avisar actualización']);
  });
});
