// ============================================================================
// Edge Function: admins (Tarea 3.6)
// ============================================================================
// Reemplaza a admin.routes.ts + admin.controller.ts + admin.service.ts.
// Todas las rutas son exclusivas de los administradores:
//
//   GET    /admins                   Listado paginado (filtro: estado)
//   GET    /admins/search?query=     Búsqueda por nombre, apellido, email o DNI (filtro: estado)
//   GET    /admins/account/:id       Datos de la cuenta
//   GET    /admins/:id
//   POST   /admins
//   PATCH  /admins/:id
//   PATCH  /admins/:id/state         Activa o desactiva al administrador (body: { state })
//   DELETE /admins/:id               DESACTIVA al administrador: no se elimina físicamente a nadie
//
// Protecciones al desactivar: un administrador no puede desactivar su propia cuenta y no se puede
// desactivar al último administrador activo (ver estado-usuario.ts).
// ============================================================================
import { sql } from '../_shared/db.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  AppError,
  created,
  getPagination,
  intParam,
  ok,
  queryParam,
  serveRoutes,
  type RequestContext,
} from '../_shared/http.ts';
import { likePattern } from '../_shared/catalogo.ts';
import {
  createUser,
  findUser,
  listUsers,
  readStateFilter,
  sanitizeUserInput,
  setUserState,
  updateUser,
  userStateFilter,
} from '../_shared/usuarios.ts';
import { esEstadoUsuario } from '../_shared/estado-usuario.ts';

const NOT_FOUND = 'Administrador no encontrado';

async function getAccountInfo(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de administrador inválido');
  return ok('Información de cuenta obtenida', await findUser(id, 'Admin', NOT_FOUND));
}

async function findOne(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de administrador inválido');
  return ok('Administrador encontrado', await findUser(id, 'Admin', NOT_FOUND));
}

async function findAll(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const { page, limit } = getPagination(ctx);
  const state = readStateFilter(queryParam(ctx, 'state'));
  const admins = await listUsers('Admin', page, limit, () => userStateFilter(state));
  return ok('Todos los Administradores fueron encontrados', admins);
}

async function searchAdminByText(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const query = queryParam(ctx, 'query');
  if (!query) throw new AppError('El parámetro de búsqueda es requerido', 400);

  const { page, limit } = getPagination(ctx);
  const pattern = likePattern(query);
  const state = readStateFilter(queryParam(ctx, 'state'));

  const admins = await listUsers(
    'Admin',
    page,
    limit,
    () => sql`and (
      u.name ilike ${pattern} or u.last_name ilike ${pattern}
      or u.email ilike ${pattern} or u.dni ilike ${pattern}
    ) ${userStateFilter(state)}`,
  );
  return ok('Resultados de búsqueda', admins);
}

async function add(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const admin = await createUser(sanitizeUserInput(ctx.body, 'Admin'), 'Admin');
  return created('Administrador creado', admin);
}

async function update(ctx: RequestContext) {
  const requester = await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de administrador inválido');

  // Si el administrador edita SU PROPIA cuenta, confirma con la contraseña actual al cambiar el email
  // o la contraseña. Editar a otro administrador no la necesita.
  const admin = await updateUser(id, 'Admin', sanitizeUserInput(ctx.body, 'Admin'), NOT_FOUND, {
    selfEdit: requester.id === id ? { req: ctx.req, currentPassword: ctx.body.currentPassword } : undefined,
  });
  return ok('Administrador actualizado', admin);
}

/** DELETE: desactiva al administrador (las protecciones están en setUserState). Se lo puede reactivar. */
async function remove(ctx: RequestContext) {
  const requester = await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de administrador inválido');
  await setUserState(id, 'Admin', 'Inactivo', NOT_FOUND, requester.id);
  return ok('Administrador desactivado');
}

async function changeState(ctx: RequestContext) {
  const requester = await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de administrador inválido');
  const state = ctx.body?.state;
  if (!esEstadoUsuario(state)) throw new AppError('El estado debe ser Activo o Inactivo', 400);

  const admin = await setUserState(id, 'Admin', state, NOT_FOUND, requester.id);
  return ok(state === 'Inactivo' ? 'Administrador desactivado' : 'Administrador reactivado', admin);
}

serveRoutes('admins', [
  // Rutas protegidas (solo Admin puede gestionar admins)
  ['GET', '/', findAll],
  ['GET', '/search', searchAdminByText],
  ['GET', '/account/:id', getAccountInfo],
  ['GET', '/:id', findOne],
  ['POST', '/', add],
  ['DELETE', '/:id', remove],
  ['PATCH', '/:id/state', changeState],
  ['PATCH', '/:id', update],
]);
