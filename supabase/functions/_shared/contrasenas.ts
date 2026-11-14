// ============================================================================
// Verificación de contraseñas y límite de intentos fallidos
// ============================================================================
// Lo usan el login, "verificar contraseña" y la edición de email/contraseña de la
// propia cuenta. Los tres comparten el mismo límite: 5 intentos fallidos por IP cada
// 15 minutos. Así quien robe un token de sesión tampoco puede probar contraseñas sin
// freno desde ninguna de esas rutas.
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sql } from './db.ts';
import { AppError } from './http.ts';
import { getClientIp } from './turnstile.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MINUTES = 15;

/**
 * Cómo se guardaban las contraseñas ANTES de que dejaran de recortarse: sin los espacios de los
 * extremos y con los espacios repetidos colapsados. Las cuentas de esa época tienen guardada esta
 * versión, así que el login la prueba como segunda opción.
 */
export function legacyPassword(raw: string): string {
  return raw.trim().replace(/\s{2,}/g, ' ');
}

/** Las contraseñas a probar: lo que la persona escribió y, si es distinto, su versión normalizada. */
export function passwordCandidates(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw === '') return [];
  const normalized = legacyPassword(raw);
  return normalized === raw || normalized === '' ? [raw] : [raw, normalized];
}

/**
 * Valida email + contraseña contra Supabase Auth y devuelve la sesión.
 * Se usa un cliente descartable con la clave pública: así cada intento es
 * independiente y no se mezclan sesiones entre peticiones.
 */
export async function signInWithPassword(email: string, password: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return data.session;
}

/** Como signInWithPassword, pero probando también la versión normalizada de la contraseña. */
export async function signInWithAnyCandidate(email: string, raw: unknown) {
  for (const candidate of passwordCandidates(raw)) {
    const session = await signInWithPassword(email, candidate);
    if (session) return session;
  }
  return null;
}

/** Corta con 429 si esta IP ya acumuló demasiados intentos fallidos. */
export async function assertNotLocked(ip: string): Promise<void> {
  const [{ total }] = await sql`
    select count(*)::int as total from login_attempt
    where ip = ${ip} and created_at > now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES})
  `;
  if (total >= MAX_FAILED_ATTEMPTS) {
    throw new AppError(
      `Demasiados intentos de inicio de sesión. Por favor, intente de nuevo en ${ATTEMPT_WINDOW_MINUTES} minutos.`,
      429,
    );
  }
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  await sql`insert into login_attempt (ip) values (${ip})`;
}

/**
 * Indica si la cuenta tiene una contraseña propia. Las cuentas que entran solo con Google no la
 * tienen (hasta que usan "Olvidé mi contraseña"), así que no hay nada que pedirles confirmar.
 */
export async function accountHasPassword(supabaseUid: string): Promise<boolean> {
  const [row] = await sql`
    select coalesce(encrypted_password, '') <> '' as has_password from auth.users where id = ${supabaseUid}::uuid
  `;
  return row?.hasPassword === true;
}

/**
 * Exige la contraseña ACTUAL para cambiar el email o la contraseña de la propia cuenta.
 *
 * Con solo el token de sesión (por ejemplo, robado con un XSS) no alcanza para quedarse con la
 * cuenta. Los intentos fallidos cuentan para el límite por IP, como en el login.
 */
export async function assertCurrentPassword(req: Request, email: string, currentPassword: unknown): Promise<void> {
  const ip = getClientIp(req);
  await assertNotLocked(ip);

  if (typeof currentPassword !== 'string' || currentPassword === '') {
    throw new AppError('Para cambiar tu email o tu contraseña ingresá tu contraseña actual', 400);
  }

  if (!(await signInWithAnyCandidate(email, currentPassword))) {
    await recordFailedAttempt(ip);
    // 400 y no 401: el frontend interpreta un 401 como sesión vencida y cierra la sesión
    throw new AppError('Contraseña actual incorrecta', 400);
  }
}
