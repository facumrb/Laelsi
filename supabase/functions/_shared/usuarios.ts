// ============================================================================
// Helpers de usuarios compartidos por las funciones auth, clients y admins
// ============================================================================
// Cada usuario vive en dos lugares:
//   - auth.users (Supabase Auth): credenciales. La contraseña NUNCA se guarda
//     en nuestras tablas.
//   - public."user": perfil de la aplicación (rol, datos personales y fiscales).
// El trigger handle_new_auth_user crea el perfil base al dar de alta la cuenta;
// acá se completa con el resto de los datos.
// ============================================================================
import { sql, type Db } from './db.ts';
import { supabaseAdmin, type UserRole } from './auth.ts';
import { AppError, paginated, pickFields } from './http.ts';
import { accountHasPassword, assertCurrentPassword } from './contrasenas.ts';
import {
  leerFiltroDeEstado,
  mensajeDeCuentaInactiva,
  validarCambioDeEstado,
  type EstadoUsuario,
} from './estado-usuario.ts';
import {
  CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO,
  camposFaltantes,
  mensajeDeCamposFaltantes,
  textosVaciosANulos,
} from './campos-usuario.ts';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mismas reglas que valida el formulario del frontend (FormUtils.usernamePattern y passwordPattern):
// el servidor no puede confiar en que la petición salió de ese formulario.
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_USERNAME_LENGTH = 50; // VARCHAR(50)
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const MAX_PASSWORD_LENGTH = 100;

const VALID_FISCAL_CONDITIONS = ['Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'Exento'];

/** Campos de perfil comunes a administradores y clientes. */
const BASE_PROFILE_FIELDS = ['name', 'lastName', 'phone', 'username', 'dni', 'email'];
/** Campos fiscales y de envío, exclusivos de los clientes. */
const CLIENT_PROFILE_FIELDS = [
  'cuit',
  'fiscalCondition',
  'street',
  'streetNumber',
  'city',
  'province',
  'postalCode',
  'floor',
  'apartment',
];
const PASSWORD_FIELDS = ['password', 'confirmPassword'];

const UNIQUE_ERROR = 'Ya existe un registro con los mismos datos únicos (email, DNI o nombre de usuario)';

/** Lanza AppError si las contraseñas no coinciden. */
export function validatePasswords(password?: string, confirmPassword?: string): void {
  if (password && confirmPassword && password !== confirmPassword) {
    throw new AppError('Las contraseñas no coinciden', 400);
  }
}

/** Lanza AppError si la contraseña incumple la política: 8 a 100 caracteres, con al menos una letra y un número. */
export function assertValidPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH || !PASSWORD_PATTERN.test(password)) {
    throw new AppError('La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número.', 400);
  }
}

/**
 * Lanza AppError si el nombre de usuario tiene caracteres no permitidos.
 * Importa también para el login: se puede iniciar sesión con el usuario O con el email, y un
 * usuario con forma de email (con "@") competiría con la cuenta de esa dirección.
 */
export function assertValidUsername(username: unknown): asserts username is string {
  if (typeof username !== 'string' || username.length > MAX_USERNAME_LENGTH || !USERNAME_PATTERN.test(username)) {
    throw new AppError(
      `El nombre de usuario solo admite letras, números, puntos, guiones y guiones bajos (máximo ${MAX_USERNAME_LENGTH} caracteres)`,
      400,
    );
  }
}

/** Versión de los textos legales: la fecha AAAA-MM-DD que muestran /terminos y /privacidad. */
const TERMS_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Exige que el registro traiga la casilla de aceptación tildada y devuelve la versión de los
 * Términos y la Política de Privacidad que la persona tenía delante. Se valida acá y no solo en
 * el formulario: quien llame a la API directo tampoco puede saltearse la aceptación.
 */
// deno-lint-ignore no-explicit-any
export function assertTermsAccepted(body: any): string {
  const { acceptTerms, termsVersion } = body ?? {};
  if (acceptTerms !== true || typeof termsVersion !== 'string' || !TERMS_VERSION_PATTERN.test(termsVersion)) {
    throw new AppError(
      'Para crear tu cuenta tenés que aceptar los Términos y Condiciones y la Política de Privacidad. Si ya los aceptaste, recargá la página e intentá de nuevo.',
      400,
    );
  }
  return termsVersion;
}

/**
 * Columnas del perfil que viajan al frontend: todas menos supabase_uid, que es interna.
 * Se listan a propósito en vez de usar `select *`, así una columna nueva de la tabla no se
 * expone por accidente en cada listado.
 */
const userColumns = () => sql`
  id, role, name, last_name, dni, phone, username, email, cuit, fiscal_condition,
  street, street_number, city, province, postal_code, floor, apartment,
  state, created_at, updated_at, deleted_at
`;

/** Lee el filtro `state` de un listado; un valor inválido es un 400 y no se ignora en silencio. */
export function readStateFilter(value: string | undefined): EstadoUsuario | undefined {
  try {
    return leerFiltroDeEstado(value);
  } catch (err) {
    if (err instanceof RangeError) throw new AppError(err.message, 400);
    throw err;
  }
}

/** Fragmento SQL para el WHERE de un listado (alias `u`): vacío si no se filtra por estado. */
// deno-lint-ignore no-explicit-any
export function userStateFilter(state: EstadoUsuario | undefined): any {
  return state ? sql`and u.state = ${state}` : sql``;
}

/**
 * Deja solo los campos permitidos según el rol (reemplaza a sanitizeAdminInput y
 * sanitizeClientInput). El CUIT vacío se descarta para no pisar el valor con ''.
 */
// deno-lint-ignore no-explicit-any
export function sanitizeUserInput(body: any, role: UserRole): Record<string, any> {
  const allowed =
    role === 'Client'
      ? [...BASE_PROFILE_FIELDS, ...CLIENT_PROFILE_FIELDS, ...PASSWORD_FIELDS]
      : [...BASE_PROFILE_FIELDS, ...PASSWORD_FIELDS];

  const input = pickFields(body, allowed);
  if (input.cuit === '') delete input.cuit;

  // Nombre, apellido, teléfono y DNI de un cliente son opcionales (ID 71): un texto vacío se guarda como
  // NULL. Un DNI '' chocaría con el de otro cliente en el índice único; NULL se puede repetir.
  return role === 'Client' ? textosVaciosANulos(input, CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO) : input;
}

/** Convierte los datos recibidos en las columnas del perfil (sin credenciales). */
// deno-lint-ignore no-explicit-any
function toProfileColumns(input: Record<string, any>, role: UserRole): Record<string, any> {
  const fields = role === 'Client' ? [...BASE_PROFILE_FIELDS, ...CLIENT_PROFILE_FIELDS] : BASE_PROFILE_FIELDS;
  const columns = pickFields(input, fields);

  if (columns.fiscalCondition !== undefined && !VALID_FISCAL_CONDITIONS.includes(columns.fiscalCondition)) {
    throw new AppError(`Condición fiscal inválida. Las válidas son: ${VALID_FISCAL_CONDITIONS.join(', ')}`, 400);
  }

  if (columns.streetNumber !== undefined && columns.streetNumber !== null && columns.streetNumber !== '') {
    const streetNumber = Number(columns.streetNumber);
    if (!Number.isInteger(streetNumber)) throw new AppError('El número de calle debe ser un número entero', 400);
    columns.streetNumber = streetNumber;
  } else if (columns.streetNumber === '') {
    columns.streetNumber = null;
  }

  // El email se guarda en minúsculas, igual que en Supabase Auth
  if (typeof columns.email === 'string') columns.email = columns.email.toLowerCase();

  return columns;
}

// deno-lint-ignore no-explicit-any
function rethrowUnique(err: any): never {
  if (err?.code === '23505') throw new AppError(UNIQUE_ERROR, 409);
  throw err;
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

/** Agrega a cada usuario su foto de perfil (o null) y quita los campos internos. */
// deno-lint-ignore no-explicit-any
async function attachPhotos(users: any[], db: Db = sql): Promise<any[]> {
  if (users.length === 0) return [];

  const ids = users.map((u) => u.id as number);
  const photos = await db`select id, file_name, user_id from photo where user_id in ${db(ids)}`;
  // deno-lint-ignore no-explicit-any
  const photoByUser = new Map<number, any>(photos.map((p: any) => [p.userId, { id: p.id, fileName: p.fileName }]));

  return users.map(({ supabaseUid: _supabaseUid, ...user }) => ({
    ...user,
    photo: photoByUser.get(user.id) ?? null,
  }));
}

/** Busca un usuario por ID y rol, con su foto. Lanza 404 con el mensaje indicado si no existe. */
export async function findUser(id: number, role: UserRole, notFoundMessage: string) {
  const [row] = await sql`select ${userColumns()} from "user" where id = ${id} and role = ${role}`;
  if (!row) throw new AppError(notFoundMessage, 404);

  const [user] = await attachPhotos([row]);
  return user;
}

/**
 * Lista usuarios de un rol, paginados.
 * `filter` devuelve un fragmento SQL adicional para el WHERE (se usa en dos consultas).
 */
// deno-lint-ignore no-explicit-any
export async function listUsers(role: UserRole, page: number, limit: number, filter: () => any = () => sql``) {
  const offset = (page - 1) * limit;

  const rows = await sql`
    select ${userColumns()} from "user" u
    where u.role = ${role} ${filter()}
    order by u.id asc
    limit ${limit} offset ${offset}
  `;
  const [{ total }] = await sql`
    select count(*)::int as total from "user" u where u.role = ${role} ${filter()}
  `;

  return paginated(await attachPhotos(rows), total, page, limit);
}

/** Datos de sesión que guarda el frontend después de iniciar sesión. */
export async function getSessionUser(supabaseUid: string) {
  const [row] = await sql`
    select id, name, last_name, role, state, terms_accepted_at from "user" where supabase_uid = ${supabaseUid}
  `;
  if (!row) return null;

  // Una cuenta inactiva no inicia sesión en la aplicación (ver estado-usuario.ts)
  if (row.state === 'Inactivo') throw new AppError(mensajeDeCuentaInactiva(row.role), 403);

  const [photo] = await sql`select id, file_name from photo where user_id = ${row.id}`;
  return {
    id: row.id,
    name: row.name,
    lastName: row.lastName,
    role: row.role,
    photo: photo ? { id: photo.id, fileName: photo.fileName } : null,
    // El frontend pide aceptar los Términos si es false (cuentas de Google y cuentas anteriores a la casilla)
    termsAccepted: row.termsAcceptedAt !== null,
    // Si es false (cuentas de solo Google) no hay contraseña actual que pedir al cambiar el email
    hasPassword: await accountHasPassword(supabaseUid),
  };
}

/**
 * Registra que una cuenta YA EXISTENTE aceptó los Términos y la Política de Privacidad (por ejemplo,
 * una cuenta creada con Google, donde no hay casilla al registrarse). Si ya aceptó esa misma versión
 * no se toca nada: la fecha que vale es la de la primera aceptación.
 */
export async function recordTermsAcceptance(userId: number, termsVersion: string): Promise<void> {
  await sql`
    update "user" set terms_accepted_at = now(), terms_version = ${termsVersion}
    where id = ${userId} and terms_version is distinct from ${termsVersion}
  `;
}

// ─── Escritura ───────────────────────────────────────────────────────────────

/**
 * Crea un usuario: la cuenta en Supabase Auth y su perfil completo.
 * Si falla el guardado del perfil, se deshace la cuenta para no dejar datos a medias.
 */
export async function createUser(
  // deno-lint-ignore no-explicit-any
  input: Record<string, any>,
  role: UserRole,
  // requireFullProfile: los administradores se dan de alta con el perfil completo. Los clientes (en el
  // registro propio y, desde el ID 71, también en el panel) solo con las credenciales: nombre de usuario,
  // correo y contraseña. Ver campos-usuario.ts.
  // termsVersion: solo el registro público lo informa; se guarda junto con la fecha de aceptación.
  options: { requireFullProfile: boolean; termsVersion?: string } = { requireFullProfile: true },
) {
  const { email, password, confirmPassword, name, lastName, username, dni } = input;

  validatePasswords(password, confirmPassword);

  const perfil = options.requireFullProfile ? 'completo' : 'minimo';
  if (camposFaltantes(input, perfil).length > 0) {
    throw new AppError(mensajeDeCamposFaltantes(perfil), 400);
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new AppError('El formato del correo electrónico es inválido', 400);
  }

  assertValidPassword(password);
  assertValidUsername(username);

  const columns = toProfileColumns(input, role);

  // Se valida la unicidad ANTES de crear la cuenta para devolver un error claro
  const [duplicate] = await sql`
    select id from "user"
    where lower(email) = lower(${email})
       or lower(username) = lower(${username})
       ${dni ? sql`or dni = ${dni}` : sql``}
       ${columns.cuit ? sql`or cuit = ${columns.cuit}` : sql``}
    limit 1
  `;
  if (duplicate) throw new AppError(UNIQUE_ERROR, 409);

  // 1. Cuenta en Supabase Auth. El rol viaja en app_metadata, que el usuario no puede modificar.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? '', last_name: lastName ?? '', username },
    app_metadata: { role },
  });

  if (error || !data.user) {
    if (error?.status === 422 || /already/i.test(error?.message ?? '')) {
      throw new AppError(UNIQUE_ERROR, 409);
    }
    console.error('Error creando la cuenta en Supabase Auth', error);
    throw new AppError('No se pudo crear la cuenta', 500);
  }

  // 2. Perfil: el trigger ya creó la fila base, acá se completa con todos los datos
  try {
    const accepted = options.termsVersion
      ? { termsAcceptedAt: new Date(), termsVersion: options.termsVersion }
      : {};
    const [user] = await sql`
      update "user" set ${sql({ ...columns, role, ...accepted })}
      where supabase_uid = ${data.user.id}
      returning ${userColumns()}
    `;
    if (!user) throw new Error('El trigger de sincronización no creó el perfil del usuario');

    const [withPhoto] = await attachPhotos([user]);
    return withPhoto;
  } catch (err) {
    // Deshacer: se borra el perfil a medio crear y la cuenta de Auth
    await sql`delete from "user" where supabase_uid = ${data.user.id}`.catch(() => undefined);
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    rethrowUnique(err);
  }
}

/**
 * Actualiza un usuario. Los datos de perfil se guardan en public."user"; el email
 * y la contraseña además se sincronizan con Supabase Auth.
 */
export async function updateUser(
  id: number,
  role: UserRole,
  // deno-lint-ignore no-explicit-any
  input: Record<string, any>,
  notFoundMessage: string,
  // selfEdit: lo informa quien edita SU PROPIA cuenta. Si cambia el email o la contraseña tiene que
  // confirmar con la contraseña actual (un administrador que edita a otra persona no la necesita)
  options: { selfEdit?: { req: Request; currentPassword: unknown } } = {},
) {
  const [current] = await sql`select ${userColumns()}, supabase_uid from "user" where id = ${id} and role = ${role}`;
  if (!current) throw new AppError(notFoundMessage, 404);

  if (input.email !== undefined && !EMAIL_REGEX.test(input.email)) {
    throw new AppError('El formato del correo electrónico es inválido', 400);
  }

  validatePasswords(input.password, input.confirmPassword);
  if (input.password) assertValidPassword(input.password);

  // Solo se valida si el usuario cambia: una cuenta heredada con un usuario fuera de la regla
  // tiene que poder seguir editando el resto de su perfil
  if (input.username !== undefined && input.username !== current.username) assertValidUsername(input.username);

  const columns = toProfileColumns(input, role);
  const emailChanged = columns.email !== undefined && columns.email !== String(current.email).toLowerCase();

  // Antes de escribir NADA: con solo el token de sesión (por ejemplo, robado con un XSS) no alcanza
  // para quedarse con la cuenta cambiando su email o su contraseña. Las cuentas que entran solo con
  // Google no tienen contraseña, así que no hay nada que pedirles.
  if (
    options.selfEdit &&
    (emailChanged || input.password) &&
    current.supabaseUid &&
    (await accountHasPassword(current.supabaseUid))
  ) {
    await assertCurrentPassword(options.selfEdit.req, current.email, options.selfEdit.currentPassword);
  }

  // 1. Perfil
  // deno-lint-ignore no-explicit-any
  let updated: any = current;
  if (Object.keys(columns).length > 0) {
    try {
      [updated] = await sql`update "user" set ${sql(columns)} where id = ${id} returning ${userColumns()}`;
    } catch (err) {
      rethrowUnique(err);
    }
  }

  // 2. Credenciales en Supabase Auth
  if ((emailChanged || input.password) && current.supabaseUid) {
    // deno-lint-ignore no-explicit-any
    const authChanges: Record<string, any> = {};
    if (emailChanged) {
      authChanges.email = columns.email;
      authChanges.email_confirm = true;
    }
    if (input.password) authChanges.password = input.password;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(current.supabaseUid, authChanges);
    if (error) {
      // Si Auth rechaza el cambio, el email del perfil vuelve a su valor anterior
      if (emailChanged) await sql`update "user" set email = ${current.email} where id = ${id}`;
      console.error('Error actualizando la cuenta en Supabase Auth', error);
      throw new AppError(
        emailChanged ? 'No se pudo actualizar el email: ya está en uso o no es válido' : 'No se pudo actualizar la contraseña',
        400,
      );
    }
  }

  const [withPhoto] = await attachPhotos([updated]);
  return withPhoto;
}

/**
 * Activa o desactiva a un cliente o administrador. Por ahora NO se elimina físicamente a nadie
 * (discusión del ID 65): el borrado físico destruía el historial, porque la base borra en cascada
 * los Pedidos del cliente. Un usuario inactivo conserva todo y no puede operar (requireUser).
 *
 * Las reglas de quién puede desactivar a quién están en estado-usuario.ts. Mientras se cuentan los
 * administradores activos se los bloquea, para que dos desactivaciones simultáneas no dejen al panel
 * sin ningún administrador activo.
 */
export async function setUserState(
  id: number,
  role: UserRole,
  state: EstadoUsuario,
  notFoundMessage: string,
  requesterId: number,
) {
  await sql.begin(async (tx: Db) => {
    const [user] = await tx`select id, state from "user" where id = ${id} and role = ${role} for update`;
    if (!user) throw new AppError(notFoundMessage, 404);

    const activeAdmins = await tx`select id from "user" where role = 'Admin' and state = 'Activo' for update`;

    const reason = validarCambioDeEstado({
      solicitanteId: requesterId,
      objetivoId: id,
      objetivoRol: role,
      objetivoEstadoActual: user.state,
      nuevoEstado: state,
      administradoresActivos: activeAdmins.length,
    });
    if (reason) throw new AppError(reason, 409);

    // deleted_at guarda la fecha del último cambio de estado (igual que en productos y categorías)
    await tx`
      update "user"
      set state = ${state}, deleted_at = ${state === 'Inactivo' ? new Date() : null}
      where id = ${id}
    `;
  });

  return findUser(id, role, notFoundMessage);
}
