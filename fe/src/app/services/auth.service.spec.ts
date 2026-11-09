import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from 'src/environments/environment';
import { UserSession } from '@models/auth.model';
import { UserRole } from '@models/user.model';
import { AuthService } from './auth.service';
import { supabase } from './supabase.client';

// Acceso por contraseña (usuario o email) y por Google. El backend resuelve la cuenta
// por email O por nombre de usuario: el servicio envía lo que la persona escribió
// tal cual, y el formulario es el que decide qué valores deja pasar.
describe('AuthService: inicio de sesión', () => {
  const urlLogin = `${environment.apiUrl}/auth/login`;
  const password = 'una-contraseña-larga-123';

  const respuestaAdmin = {
    status: 'success',
    message: 'Login exitoso',
    data: {
      token: 'access-token-de-prueba',
      refreshToken: 'refresh-token-de-prueba',
      user: { id: 2, username: 'usuario.demo', role: UserRole.Admin },
    },
  };

  let servicio: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    // No se le habla al Supabase real: solo se comprueba qué sesión se le entrega
    vi.spyOn(supabase.auth, 'setSession').mockResolvedValue({ data: { session: null, user: null }, error: null } as never);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it.each([
    ['nombre de usuario', 'usuario.demo'],
    ['email', 'persona.demo@example.com'],
  ])('con %s y contraseña: lo envía al login y deja la sesión de administrador', async (_tipo, credencial) => {
    const resultado = new Promise((resolve, reject) =>
      servicio.login(credencial, password).subscribe({ next: resolve, error: reject }),
    );

    const peticion = http.expectOne(urlLogin);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ username: credencial, password });
    peticion.flush(respuestaAdmin);
    await resultado;

    expect(servicio.isLoggedIn()).toBe(true);
    expect(servicio.isAdmin()).toBe(true);
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token-de-prueba',
      refresh_token: 'refresh-token-de-prueba',
    });
  });

  it('con credenciales inválidas (401): propaga el error y no deja ninguna sesión', async () => {
    const resultado = new Promise((_resolve, reject) =>
      servicio.login('usuario.demo', 'incorrecta').subscribe({ error: reject }),
    );

    http.expectOne(urlLogin).flush({ message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    await expect(resultado).rejects.toMatchObject({ status: 401 });
    expect(servicio.isLoggedIn()).toBe(false);
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('con Google: inicia el flujo OAuth con el proveedor google y vuelve a la tienda', async () => {
    const oauth = vi
      .spyOn(supabase.auth, 'signInWithOAuth')
      .mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.google.com/' }, error: null } as never);

    await new Promise<void>((resolve, reject) => servicio.loginWithGoogle().subscribe({ next: () => resolve(), error: reject }));

    expect(oauth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
  });

  it('con Google: si Supabase devuelve un error, lo propaga para que la pantalla lo muestre', async () => {
    vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
      data: { provider: 'google', url: null },
      error: new Error('proveedor deshabilitado'),
    } as never);

    const resultado = new Promise((_resolve, reject) => servicio.loginWithGoogle().subscribe({ error: reject }));

    await expect(resultado).rejects.toThrow('proveedor deshabilitado');
  });
});

// En localStorage solo debe quedar lo que necesita la sesión. La pantalla de perfil le pasa al
// servicio el perfil completo del cliente (TypeScript lo acepta por tipado estructural): DNI,
// CUIT, domicilio y hasta el historial de órdenes terminaban guardados en el navegador.
describe('AuthService: datos de la sesión guardados en el navegador', () => {
  const perfilCompleto = {
    id: 2,
    name: 'Ana',
    lastName: 'Pérez',
    role: UserRole.Client,
    photo: null,
    dni: '30111222',
    cuit: '20301112223',
    street: 'Mitre',
    orders: [{ id: 1 }],
  };

  beforeEach(() => {
    localStorage.clear();
    // No se le habla al Supabase real: solo se comprueba qué queda guardado
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: () => undefined } },
    } as never);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updateCurrentUser guarda solo los campos de la sesión, aunque reciba un perfil completo', () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Ana', lastName: 'Pérez', role: UserRole.Client }));
    const servicio = TestBed.inject(AuthService);

    servicio.updateCurrentUser({ ...perfilCompleto, name: 'Ana María' } as Partial<UserSession>);

    const guardado = JSON.parse(localStorage.getItem('auth_user')!);
    expect(Object.keys(guardado).sort()).toEqual(['id', 'lastName', 'name', 'photo', 'role']);
    expect(guardado.name).toBe('Ana María');
    expect(servicio.currentUser()).toEqual(guardado);
  });

  it('al arrancar elimina los datos personales que dejaron las versiones anteriores', () => {
    localStorage.setItem('auth_user', JSON.stringify(perfilCompleto));

    const servicio = TestBed.inject(AuthService);

    const sesion = { id: 2, name: 'Ana', lastName: 'Pérez', role: UserRole.Client, photo: null };
    expect(servicio.currentUser()).toEqual(sesion);
    expect(JSON.parse(localStorage.getItem('auth_user')!)).toEqual(sesion);
  });

  it('una sesión que ya está limpia no se vuelve a escribir', () => {
    const sesion = JSON.stringify({ id: 2, name: 'Ana', lastName: 'Pérez', role: UserRole.Client });
    localStorage.setItem('auth_user', sesion);
    const guardar = vi.spyOn(Storage.prototype, 'setItem');

    TestBed.inject(AuthService);

    expect(guardar).not.toHaveBeenCalled();
  });
});

// Quien entra con Google no tilda ninguna casilla al registrarse: el servidor lo informa en la sesión
// (termsAccepted) y el frontend le pide aceptar. Acá se prueba la parte del servicio.
describe('AuthService: aceptación de los Términos y registro', () => {
  const urlMe = `${environment.apiUrl}/auth/me`;
  const urlAceptar = `${environment.apiUrl}/auth/accept-terms`;
  const urlRegistro = `${environment.apiUrl}/auth/register`;

  let http: HttpTestingController;

  function crearServicio(sesionGuardada?: object) {
    localStorage.clear();
    if (sesionGuardada) localStorage.setItem('auth_user', JSON.stringify(sesionGuardada));
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: () => undefined } },
    } as never);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  // El constructor completa las sesiones viejas en el próximo ciclo (setTimeout 0)
  const esperarCiclo = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const cliente = { id: 2, name: 'Ana', lastName: 'Pérez', role: UserRole.Client };

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('acceptTerms envía la aceptación con la versión de los textos y marca la sesión como aceptada', async () => {
    const servicio = crearServicio({ ...cliente, termsAccepted: false, hasPassword: false });

    const resultado = new Promise<void>((resolve, reject) =>
      servicio.acceptTerms('2026-10-22').subscribe({ next: () => resolve(), error: reject }),
    );
    const peticion = http.expectOne(urlAceptar);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ acceptTerms: true, termsVersion: '2026-10-22' });
    peticion.flush({ status: 'success', message: 'ok', data: { termsAccepted: true } });
    await resultado;

    expect(servicio.currentUser()?.termsAccepted).toBe(true);
    expect(JSON.parse(localStorage.getItem('auth_user')!).termsAccepted).toBe(true);
  });

  it('si el servidor rechaza la aceptación, la sesión NO queda marcada como aceptada', async () => {
    const servicio = crearServicio({ ...cliente, termsAccepted: false, hasPassword: false });

    const resultado = new Promise((_resolve, reject) => servicio.acceptTerms('2026-10-22').subscribe({ error: reject }));
    http.expectOne(urlAceptar).flush({ message: 'Aceptá los Términos' }, { status: 400, statusText: 'Bad Request' });

    await expect(resultado).rejects.toMatchObject({ status: 400 });
    expect(servicio.currentUser()?.termsAccepted).toBe(false);
  });

  it('una sesión guardada por una versión anterior (sin termsAccepted) se completa desde /auth/me', async () => {
    const servicio = crearServicio(cliente);
    await esperarCiclo();

    http.expectOne(urlMe).flush({
      status: 'success',
      message: 'ok',
      data: { ...cliente, photo: null, termsAccepted: false, hasPassword: true },
    });

    expect(servicio.currentUser()?.termsAccepted).toBe(false);
    expect(servicio.currentUser()?.hasPassword).toBe(true);
  });

  it('si no se puede completar la sesión vieja, NO se cierra la sesión', async () => {
    const servicio = crearServicio(cliente);
    await esperarCiclo();

    http.expectOne(urlMe).flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });

    expect(servicio.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('auth_user')).not.toBeNull();
  });

  it('una sesión que ya sabe si aceptó los Términos no vuelve a consultar /auth/me', async () => {
    crearServicio({ ...cliente, termsAccepted: true, hasPassword: true });
    await esperarCiclo();

    http.expectNone(urlMe);
  });

  it('el registro envía el token de Turnstile en el header X-Turnstile-Token', async () => {
    const servicio = crearServicio();
    const datos = {
      username: 'maria',
      email: 'm@e.com',
      password: 'clave-segura-123',
      acceptTerms: true,
      termsVersion: '2026-10-22',
    };

    const resultado = new Promise((resolve, reject) =>
      servicio.register(datos, 'token-turnstile').subscribe({ next: resolve, error: reject }),
    );
    const peticion = http.expectOne(urlRegistro);
    expect(peticion.request.headers.get('X-Turnstile-Token')).toBe('token-turnstile');
    expect(peticion.request.body).toEqual(datos);
    peticion.flush({ status: 'success', message: 'ok', data: { id: 9 } });
    await resultado;
  });

  it('el registro sin token no manda el header (desarrollo local sin clave)', async () => {
    const servicio = crearServicio();

    const resultado = new Promise((resolve, reject) =>
      servicio
        .register({ username: 'maria', email: 'm@e.com', password: 'clave-segura-123', acceptTerms: true, termsVersion: '2026-10-22' })
        .subscribe({ next: resolve, error: reject }),
    );
    const peticion = http.expectOne(urlRegistro);
    expect(peticion.request.headers.has('X-Turnstile-Token')).toBe(false);
    peticion.flush({ status: 'success', message: 'ok', data: { id: 9 } });
    await resultado;
  });
});

// Cambiar la contraseña de una cuenta cierra TODAS sus sesiones en Supabase Auth (por seguridad: el código de GoTrue lo
// hace al actualizar la contraseña con la API de administración, que es lo que usa el servidor). También cierra la de
// quien la cambió: el siguiente pedido recibe un 401, la renovación del token falla y la persona veía un error rojo
// ("Tu sesión ya no es válida") justo después de un cambio que salió bien. Por eso, después de cambiar la PROPIA
// contraseña se vuelve a iniciar sesión con la nueva.
describe('AuthService: sesión después de cambiar la propia contraseña', () => {
  const urlLogin = `${environment.apiUrl}/auth/login`;
  const respuesta = {
    status: 'success',
    message: 'Login exitoso',
    data: { token: 'token-nuevo', refreshToken: 'refresh-nuevo', user: { id: 4, username: 'ana.perez', role: UserRole.Client } },
  };

  let servicio: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(supabase.auth, 'setSession').mockResolvedValue({ data: { session: null, user: null }, error: null } as never);
    vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null } as never);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('inicia sesión de nuevo con el usuario y la contraseña NUEVA y responde que la sesión está vigente', async () => {
    const resultado = new Promise<boolean>((resolve) =>
      servicio.renewSessionAfterPasswordChange('ana.perez', 'Nueva1234').subscribe(resolve),
    );

    const peticion = http.expectOne(urlLogin);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ username: 'ana.perez', password: 'Nueva1234' });
    peticion.flush(respuesta);

    expect(await resultado).toBe(true);
    expect(servicio.isLoggedIn()).toBe(true);
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'token-nuevo', refresh_token: 'refresh-nuevo' });
  });

  it('con otro usuario y otra contraseña, envía esos (no valores fijos)', async () => {
    const resultado = new Promise<boolean>((resolve) =>
      servicio.renewSessionAfterPasswordChange('admin.demo', 'Otra5678x').subscribe(resolve),
    );

    const peticion = http.expectOne(urlLogin);
    expect(peticion.request.body).toEqual({ username: 'admin.demo', password: 'Otra5678x' });
    peticion.flush(respuesta);

    expect(await resultado).toBe(true);
  });

  it('si no se puede iniciar sesión, cierra la sesión, lleva al login y responde que ya no está vigente', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const resultado = new Promise<boolean>((resolve) =>
      servicio.renewSessionAfterPasswordChange('ana.perez', 'Nueva1234').subscribe(resolve),
    );

    http.expectOne(urlLogin).flush({ message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    expect(await resultado).toBe(false);
    expect(servicio.isLoggedIn()).toBe(false);
    expect(navegar).toHaveBeenCalledWith('/auth/login');
  });
});
