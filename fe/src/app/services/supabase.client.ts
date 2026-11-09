import { GoTrueClient } from '@supabase/auth-js';
import { environment } from 'src/environments/environment';

/**
 * Cliente único de Supabase para toda la aplicación.
 *
 * Solo se usa para la AUTENTICACIÓN (sesión, Google OAuth, renovación de tokens).
 * Los datos de negocio no se consultan con este cliente: pasan por las Edge
 * Functions a través de HttpClient, igual que antes pasaban por el backend Express.
 *
 * Por eso se carga únicamente el cliente de autenticación (@supabase/auth-js, el mismo código que
 * supabase-js usa por dentro) y no supabase-js completo: sumaba 225 kB (50 kB transferidos) de
 * realtime, postgrest y storage que la aplicación nunca usa (ID 70 de discusiones.md).
 *
 * Si algún día hiciera falta consultar tablas, subir archivos o usar realtime desde el navegador,
 * se vuelve a `createClient` de @supabase/supabase-js con estas mismas opciones de `auth`.
 *
 * Tiene que armarse igual que lo haría supabase-js (supabase.client.spec.ts lo comprueba): con otra
 * clave de almacenamiento o cabeceras distintas, quienes ya tienen la sesión iniciada quedarían
 * deslogueados o el servidor rechazaría sus pedidos.
 *
 * Usa la anon key, que es pública: lo que cada usuario puede hacer lo definen
 * las políticas RLS y las validaciones de las Edge Functions.
 */
const urlBase = environment.supabaseUrl.replace(/\/+$/, '');
const anonKey = environment.supabaseAnonKey;

export const supabase = {
  auth: new GoTrueClient({
    url: `${urlBase}/auth/v1`,
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    // Misma clave que deriva supabase-js: sb-<proyecto>-auth-token
    storageKey: `sb-${new URL(urlBase).hostname.split('.')[0]}-auth-token`,
    // PKCE es el flujo recomendado para una SPA: el token nunca viaja en la URL
    flowType: 'pkce',
    // La sesión se guarda en localStorage y sobrevive a recargar la página
    persistSession: true,
    // Renueva el access token automáticamente antes de que venza
    autoRefreshToken: true,
    // Al volver de Google, toma el código de la URL y completa el inicio de sesión
    detectSessionInUrl: true,
  }),
};
