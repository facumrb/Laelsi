import { GoTrueClient } from '@supabase/auth-js';
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from 'src/environments/environment';
import { supabase } from './supabase.client';

// ID 70 (rendimiento): la aplicación solo usa Supabase para la autenticación. Cargar supabase-js completo sumaba
// 225 kB (50 kB transferidos) con realtime, postgrest y storage que nunca se usan. Ahora se carga solo el cliente de
// autenticación (@supabase/auth-js, el mismo código que supabase-js usa por dentro).
//
// Lo que NO puede cambiar es cómo se guarda y se pide la sesión: si la clave del localStorage o las cabeceras fueran
// otras, todas las personas con sesión iniciada quedarían deslogueadas, o el servidor rechazaría los pedidos. Por eso
// estas pruebas comparan contra el cliente que armaría supabase-js con las mismas opciones.
describe('cliente de Supabase (solo autenticación)', () => {
  beforeEach(() => {
    // Crear el cliente de referencia con la misma clave avisa "Multiple GoTrueClient instances": es esperable acá
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  // Campos internos del cliente: no son API pública, pero son justo lo que hay que conservar
  const interno = (cliente: unknown) => cliente as Record<string, unknown>;

  // Lo que armaría supabase-js, con el refresco automático apagado para no dejar temporizadores en la prueba
  const deReferencia = () =>
    createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: { flowType: 'pkce', autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }).auth;

  it('es el cliente de autenticación de auth-js y expone las operaciones que usa la aplicación', () => {
    expect(supabase.auth).toBeInstanceOf(GoTrueClient);
    for (const operacion of [
      'getSession',
      'onAuthStateChange',
      'signInWithPassword',
      'signUp',
      'signOut',
      'signInWithOAuth',
      'resetPasswordForEmail',
      'updateUser',
      'exchangeCodeForSession',
    ]) {
      expect(typeof (supabase.auth as unknown as Record<string, unknown>)[operacion], operacion).toBe('function');
    }
  });

  it('guarda la sesión en la misma clave del localStorage que supabase-js: nadie queda deslogueado', () => {
    expect(interno(supabase.auth)['storageKey']).toBe(interno(deReferencia())['storageKey']);
    expect(interno(supabase.auth)['storageKey']).toBe('sb-vwtqkglkenogylkranzz-auth-token');
  });

  it('pide a la misma dirección de autenticación y con las mismas cabeceras de clave', () => {
    const esperado = interno(deReferencia());
    const actual = interno(supabase.auth);

    expect(actual['url']).toBe(esperado['url']);
    expect(actual['url']).toBe(`${environment.supabaseUrl}/auth/v1`);
    const cabeceras = actual['headers'] as Record<string, string>;
    const cabecerasEsperadas = esperado['headers'] as Record<string, string>;
    expect(cabeceras['apikey']).toBe(cabecerasEsperadas['apikey']);
    expect(cabeceras['Authorization']).toBe(cabecerasEsperadas['Authorization']);
    expect(cabeceras['apikey']).toBe(environment.supabaseAnonKey);
  });

  it('conserva el flujo PKCE, la sesión persistente, la renovación automática y la lectura del código al volver de Google', () => {
    const actual = interno(supabase.auth);

    expect(actual['flowType']).toBe('pkce');
    expect(actual['persistSession']).toBe(true);
    expect(actual['autoRefreshToken']).toBe(true);
    expect(actual['detectSessionInUrl']).toBe(true);
  });
});
