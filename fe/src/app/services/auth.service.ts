import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
import {
  IApiResponse,
  LoginData,
  IClientRegister,
  ResetTokenStatus,
  UserSession,
} from '@models/auth.model';
import { UserRole } from '@models/user.model';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { supabase } from './supabase.client';

// Lo único que se guarda del usuario en el navegador (localStorage)
const SESSION_FIELDS = ['id', 'name', 'lastName', 'role', 'photo', 'termsAccepted', 'hasPassword'] as const;

/**
 * Deja solo los campos de UserSession. Se usa antes de guardar el usuario en localStorage: otras
 * pantallas pueden entregar un perfil completo (con DNI, CUIT, domicilio...) porque TypeScript lo
 * acepta por tipado estructural, y esos datos personales no tienen por qué quedar guardados ahí.
 */
function pickSessionFields(source: Partial<UserSession>): Partial<UserSession> {
  return Object.fromEntries(
    SESSION_FIELDS.filter((field) => field in source).map((field) => [field, source[field]]),
  );
}

/**
 * Autenticación con Supabase Auth.
 *
 * Hay dos piezas que conviven:
 *  - La SESIÓN (access token + refresh token): la administra el cliente de
 *    Supabase, que la guarda en localStorage y la renueva sola.
 *  - El USUARIO de la aplicación (id, nombre, rol, foto): sale de nuestra tabla
 *    "user". Se guarda una copia en localStorage para que los guards puedan
 *    decidir de forma síncrona apenas arranca la app.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  // Opcional porque hay contextos de prueba que crean el servicio sin TanStack Query
  private queryClient = inject(QueryClient, { optional: true });
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly USER_KEY = 'auth_user';

  // Último access token conocido. Lo mantiene al día el listener de Supabase.
  private accessToken: string | null = null;

  currentUser = signal<UserSession | null>(null);
  isLoggedIn = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.currentUser()?.role === UserRole.Admin);

  constructor() {
    // Al iniciar la app, recuperamos la sesión si existe
    this.loadSession();
    this.listenAuthChanges();
  }

  /**
   * Inicia sesión con nombre de usuario (o email) y contraseña.
   * Pasa por la Edge Function "auth" porque Supabase Auth solo acepta email:
   * la función resuelve el usuario y devuelve los tokens de la sesión.
   */
  login(username: string, password: string): Observable<LoginData> {
    return this.http
      .post<IApiResponse<LoginData>>(`${this.apiUrl}/login`, {
        username,
        password,
      })
      .pipe(
        map((response) => response.data),
        switchMap((data) => {
          this.saveUser(data.user);
          this.accessToken = data.token;

          // Le entregamos los tokens al cliente de Supabase: desde acá él se
          // encarga de guardarlos y de renovarlos antes de que venzan.
          return from(
            supabase.auth.setSession({
              access_token: data.token,
              refresh_token: data.refreshToken,
            }),
          ).pipe(
            map(({ error }) => {
              if (error) {
                this.clearSession();
                throw error;
              }
              return data;
            }),
          );
        }),
      );
  }

  /**
   * Inicia sesión con Google. Redirige a Google y, al volver, el cliente de
   * Supabase completa el login solo (ver listenAuthChanges).
   */
  loginWithGoogle(): Observable<void> {
    return from(
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      }),
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
    );
  }

  /**
   * @param turnstileToken Token anti-bots del widget de Cloudflare Turnstile
   */
  register(
    userData: IClientRegister,
    turnstileToken?: string | null,
  ): Observable<{ id: number }> {
    const headers = turnstileToken
      ? new HttpHeaders({ 'X-Turnstile-Token': turnstileToken })
      : undefined;

    return this.http
      .post<IApiResponse<{ id: number }>>(`${this.apiUrl}/register`, userData, { headers })
      .pipe(map((response) => response.data));
  }

  /**
   * Registra que la cuenta con sesión iniciada acepta los Términos y la Política de Privacidad.
   * Es lo que se le pide a quien entra con Google: la cuenta se crea al volver de Google, sin
   * casilla, así que la aceptación queda registrada en el servidor (fecha y versión) recién acá.
   *
   * @param termsVersion Versión de los textos que se le mostraron (LEGAL_INFO.version)
   */
  acceptTerms(termsVersion: string): Observable<void> {
    return this.http
      .post<IApiResponse<{ termsAccepted: boolean }>>(`${this.apiUrl}/accept-terms`, {
        acceptTerms: true,
        termsVersion,
      })
      .pipe(
        tap(() => this.updateCurrentUser({ termsAccepted: true })),
        map(() => void 0),
      );
  }

  verifyPassword(password: string): Observable<IApiResponse<null>> {
    return this.http.post<IApiResponse<null>>(`${this.apiUrl}/verify-password`, {
      password,
    });
  }

  /**
   * Pide el enlace para recuperar la contraseña. El backend lo envía por email.
   * La respuesta es siempre la misma, exista o no la cuenta: no permite
   * averiguar qué emails están registrados.
   *
   * @param identifier Email, DNI o nombre de usuario
   * @param turnstileToken Token anti-bots del widget de Cloudflare Turnstile
   */
  requestPasswordReset(
    identifier: string,
    turnstileToken?: string | null,
  ): Observable<void> {
    const headers = turnstileToken
      ? new HttpHeaders({ 'X-Turnstile-Token': turnstileToken })
      : undefined;

    return this.http
      .post<IApiResponse<null>>(
        `${this.apiUrl}/forgot-password`,
        { identifier },
        { headers },
      )
      .pipe(map(() => void 0));
  }

  /** Consulta si el enlace de recuperación sigue vigente (sin gastarlo). */
  validateResetToken(token: string): Observable<ResetTokenStatus> {
    return this.http
      .post<IApiResponse<ResetTokenStatus>>(
        `${this.apiUrl}/reset-password/validate`,
        { token },
      )
      .pipe(map((response) => response.data));
  }

  /** Canjea el enlace de recuperación y define la contraseña nueva. */
  resetPassword(
    token: string,
    password: string,
    confirmPassword: string,
  ): Observable<void> {
    return this.http
      .post<IApiResponse<null>>(`${this.apiUrl}/reset-password`, {
        token,
        password,
        confirmPassword,
      })
      .pipe(map(() => void 0));
  }

  /**
   * Renueva el access token. El cliente de Supabase ya lo hace automáticamente
   * antes de que venza; esto queda para el caso en que el backend responda 401
   * (lo usa el errorInterceptor antes de reintentar la petición).
   */
  refreshToken(): Observable<boolean> {
    return from(supabase.auth.refreshSession()).pipe(
      map(({ data, error }) => {
        if (error || !data.session) {
          this.logout();
          throw error ?? new Error('La sesión expiró');
        }
        this.accessToken = data.session.access_token;
        return true;
      }),
    );
  }

  /**
   * Vuelve a iniciar sesión con la contraseña NUEVA después de que alguien cambió la suya.
   *
   * Cambiar la contraseña de una cuenta cierra todas sus sesiones en Supabase Auth (por seguridad), también la de
   * quien la cambió: el siguiente pedido recibía un 401 y la persona veía el error "Tu sesión ya no es válida" justo
   * después de un cambio que salió bien. Con esto la sesión se renueva sola, sin que se note.
   *
   * Llamarlo DESPUÉS del cambio y ANTES de cualquier otro pedido (por ejemplo, subir la foto del perfil).
   *
   * @returns true si la sesión quedó vigente; false si no se pudo (ya se cerró la sesión y se llevó al login: quien
   *          llama solo tiene que avisarle a la persona que ingrese de nuevo con la contraseña nueva)
   */
  renewSessionAfterPasswordChange(username: string, newPassword: string): Observable<boolean> {
    return this.login(username, newPassword).pipe(
      map(() => true),
      catchError(() => {
        this.logout('/auth/login');
        return of(false);
      }),
    );
  }

  // redirectUrl: a dónde llevar a la persona después de cerrar la sesión
  logout(redirectUrl: string = '/'): void {
    // No hace falta esperar la respuesta: la sesión local se borra de inmediato
    void supabase.auth.signOut();
    this.clearSession();
    // El logout navega sin recargar: sin esto, los datos en caché (clientes, administradores)
    // quedarían en memoria para la próxima persona que ingrese en la misma pestaña
    this.queryClient?.clear();
    this.router.navigateByUrl(redirectUrl);
  }

  // Método auxiliar para obtener el token (usado por el interceptor)
  getToken(): string | null {
    return this.accessToken;
  }

  /**
   * Devuelve el access token vigente esperando a que Supabase termine de leer
   * (y renovar, si hace falta) la sesión guardada. Es lo que usa el
   * authInterceptor, porque al recargar la página la sesión se recupera de
   * forma asíncrona y las primeras peticiones saldrían sin token.
   */
  async getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    this.accessToken = data.session?.access_token ?? null;
    return this.accessToken;
  }

  /**
   * Escucha los cambios de sesión que informa Supabase: inicio de sesión
   * (incluido el regreso desde Google), renovación del token y cierre.
   */
  private listenAuthChanges(): void {
    supabase.auth.onAuthStateChange((_event, session) => {
      this.accessToken = session?.access_token ?? null;

      if (!session) {
        // Sin sesión de Supabase no hay usuario: se limpia la copia local
        // (ej: el refresh token venció mientras la app estaba cerrada)
        this.clearSession();
        return;
      }

      // Hay sesión pero todavía no conocemos al usuario (ej: al volver de Google).
      // setTimeout: Supabase no permite llamar a su cliente dentro de este callback.
      if (!this.currentUser()) {
        setTimeout(() => this.loadProfile(), 0);
      }
    });
  }

  /** Pide al backend los datos del usuario de la sesión actual. */
  private loadProfile(): void {
    this.http.get<IApiResponse<UserSession>>(`${this.apiUrl}/me`).subscribe({
      next: (response) => this.saveUser(response.data),
      // Si no se puede obtener el perfil, la sesión no sirve: se cierra
      error: () => this.logout(),
    });
  }

  /**
   * Vuelve a pedir los datos del usuario para completar una copia local vieja (guardada antes de que
   * existieran termsAccepted y hasPassword). A diferencia de loadProfile, si falla NO cierra la sesión:
   * la copia local sigue sirviendo y se vuelve a intentar en la próxima carga.
   */
  private refreshProfile(): void {
    this.http.get<IApiResponse<UserSession>>(`${this.apiUrl}/me`).subscribe({
      next: (response) => this.saveUser(response.data),
      error: () => undefined,
    });
  }

  private saveUser(user: UserSession): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private clearSession(): void {
    localStorage.removeItem(this.USER_KEY);
    this.accessToken = null;
    this.currentUser.set(null);
  }

  private loadSession(): void {
    const storedUser = localStorage.getItem(this.USER_KEY);

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const sessionUser = pickSessionFields(parsedUser) as UserSession;
        this.currentUser.set(sessionUser);

        // Versiones anteriores guardaban el perfil completo (DNI, domicilio, órdenes...):
        // se reescribe solo con lo necesario para no dejar esos datos en el navegador
        if (Object.keys(parsedUser).length !== Object.keys(sessionUser).length) {
          localStorage.setItem(this.USER_KEY, JSON.stringify(sessionUser));
        }

        // Una copia guardada por una versión anterior no sabe si la cuenta aceptó los Términos:
        // se completa desde el servidor sin esperar (setTimeout: el constructor aún está inyectando)
        if (sessionUser.termsAccepted === undefined) {
          setTimeout(() => this.refreshProfile(), 0);
        }
      } catch (e) {
        // Si el JSON está corrupto, limpiamos todo
        this.clearSession();
      }
    }
  }

  updateCurrentUser(updates: Partial<UserSession>): void {
    const currentUser = this.currentUser();

    if (currentUser) {
      // 1. Creamos el nuevo objeto mezclando lo actual con los cambios (solo los campos de la sesión)
      const updatedUser: UserSession = {
        ...currentUser,
        ...pickSessionFields(updates),
      };

      // 2. Actualizamos el Signal (Reactividad en la UI)
      this.currentUser.set(updatedUser);

      // 3. Actualizamos el LocalStorage (Persistencia al recargar página)
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
    }
  }
}
