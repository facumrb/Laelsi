import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@services/auth.service';
import { environment } from 'src/environments/environment';
import { authInterceptor } from './auth.interceptor';
import { contextoPublico } from './peticion-publica';

describe('authInterceptor', () => {
  const urlSupabase = `${environment.apiUrl}/products/home`;
  let http: HttpClient;
  let controller: HttpTestingController;
  let token: string | null;
  const getToken = vi.fn(() => token);
  const getAccessToken = vi.fn(async () => token);

  beforeEach(() => {
    token = null;
    getToken.mockClear();
    getAccessToken.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken, getAccessToken } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('un pedido marcado como público sale sin apikey ni Authorization y sin pedir el token', () => {
    token = 'abc';
    http.get(urlSupabase, { context: contextoPublico() }).subscribe();

    const peticion = controller.expectOne(urlSupabase);
    expect(peticion.request.headers.has('apikey')).toBe(false);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    expect(getToken).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
    peticion.flush({});
  });

  it('un pedido sin marca lleva apikey y Authorization cuando hay token', () => {
    token = 'abc';
    http.get(urlSupabase).subscribe();

    const peticion = controller.expectOne(urlSupabase);
    expect(peticion.request.headers.get('apikey')).toBe(environment.supabaseAnonKey);
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer abc');
    peticion.flush({});
  });

  it('un pedido sin marca y sin token lleva apikey y no Authorization', async () => {
    http.get(urlSupabase).subscribe();
    await Promise.resolve();

    const peticion = controller.expectOne(urlSupabase);
    expect(peticion.request.headers.get('apikey')).toBe(environment.supabaseAnonKey);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
  });

  it('un pedido a otra URL sale intacto', () => {
    token = 'abc';
    http.get('https://ejemplo.r2.cloudflarestorage.com/foto').subscribe();

    const peticion = controller.expectOne('https://ejemplo.r2.cloudflarestorage.com/foto');
    expect(peticion.request.headers.has('apikey')).toBe(false);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
  });
});
