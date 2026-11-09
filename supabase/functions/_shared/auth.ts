// ============================================================================
// Autenticación y autorización (reemplaza a verifyToken / verifyRole)
// ============================================================================
// El frontend envía el access token de Supabase Auth en el header
//   Authorization: Bearer <token>
// Acá se valida contra Supabase Auth y se busca el perfil en public."user",
// que es de donde sale el rol (Admin / Client).
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sql } from './db.ts';
import { AppError } from './http.ts';
import { mensajeDeCuentaInactiva, type EstadoUsuario } from './estado-usuario.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/**
 * Cliente con privilegios de servicio. Se usa SOLO para la API de administración
 * de Supabase Auth (validar tokens, crear/editar/borrar cuentas).
 * La service role key nunca sale del servidor.
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type UserRole = 'Admin' | 'Client';

export interface AuthUser {
  /** ID del perfil en public."user" (el que usa toda la aplicación) */
  id: number;
  role: UserRole;
  email: string;
  /** Una cuenta Inactiva conserva sus datos pero no puede operar (ver estado-usuario.ts) */
  state: EstadoUsuario;
  /** ID de la cuenta en Supabase Auth (auth.users) */
  supabaseUid: string;
}

/** Devuelve el usuario autenticado, o null si no hay token o no es válido. */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const [row] = await sql`
    select id, role, email, state from "user" where supabase_uid = ${data.user.id}
  `;
  if (!row) return null;

  return { id: row.id, role: row.role, email: row.email, state: row.state, supabaseUid: data.user.id };
}

/**
 * Exige un usuario autenticado (equivale al middleware verifyToken). Una cuenta INACTIVA se rechaza
 * con 403 y un mensaje claro: el token es válido, pero la cuenta fue desactivada.
 */
export async function requireUser(req: Request): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) throw new AppError('Token inválido o expirado', 401);
  if (user.state === 'Inactivo') throw new AppError(mensajeDeCuentaInactiva(user.role), 403);
  return user;
}

/** Exige un administrador (equivale a verifyToken + verifyRole([Admin])). */
export async function requireAdmin(req: Request): Promise<AuthUser> {
  const user = await requireUser(req);
  if (user.role !== 'Admin') {
    throw new AppError('Acceso denegado: No tienes permisos suficientes', 403);
  }
  return user;
}

/**
 * Indica si la petición viene de un administrador, SIN exigir sesión: una petición anónima
 * (o con un token inválido) simplemente devuelve false. Sirve para las rutas públicas cuyo
 * contenido cambia según quién consulta (el público ve solo lo activo; el admin ve todo).
 *
 * Optimización: Primero inspecciona rápidamente el payload del JWT en memoria (0ms, sin red ni DB).
 * Si no tiene rol Admin en app_metadata, descarta de inmediato ahorrando una llamada a Auth API y otra a PostgreSQL.
 * Solo si parece un Admin, valida criptográficamente con getUser() y la DB.
 */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(payloadBase64));
      // Si el token es de un usuario común (rol Client o sin rol Admin en app_metadata),
      // retornamos false de inmediato sin pagar costo de red ni DB.
      if (payload?.app_metadata?.role !== 'Admin') {
        return false;
      }
    }
  } catch {
    return false;
  }

  // Un administrador inactivo no ve lo que ve un administrador: para las rutas públicas es un visitante más
  const user = await getAuthUser(req);
  return user?.role === 'Admin' && user.state === 'Activo';
}

/** Exige que el usuario autenticado sea el dueño del recurso o un administrador. */
export async function requireOwnerOrAdmin(req: Request, ownerId: number): Promise<AuthUser> {
  const user = await requireUser(req);
  if (user.role !== 'Admin' && user.id !== ownerId) {
    throw new AppError('Acceso denegado: No tienes permisos suficientes', 403);
  }
  return user;
}

/**
 * Como requireOwnerOrAdmin, para recursos que se buscan por ID (una orden, una foto).
 *
 * El orden importa para no revelar qué IDs existen (son secuenciales): primero se exige la sesión
 * (sin sesión SIEMPRE es 401, exista o no el recurso) y recién después se busca el recurso. Y un
 * recurso AJENO responde igual que uno inexistente (404), no con un 403 que confirmaría que existe.
 * Un administrador sí ve la diferencia: para él un recurso inexistente es un 404 real.
 *
 * @param loadOwnerId Devuelve el ID del dueño, o null si el recurso no existe
 */
export async function requireOwnerOrAdminOf(
  req: Request,
  loadOwnerId: () => Promise<number | null>,
  notFoundMessage: string,
): Promise<AuthUser> {
  const user = await requireUser(req);
  const ownerId = await loadOwnerId();
  if (ownerId === null || (user.role !== 'Admin' && user.id !== ownerId)) {
    throw new AppError(notFoundMessage, 404);
  }
  return user;
}
