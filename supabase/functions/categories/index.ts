// ============================================================================
// Edge Function: categories (Tarea 3.2)
// ============================================================================
// Reemplaza a category.routes.ts + category.controller.ts + category.service.ts.
// Mantiene las mismas rutas y respuestas que consumía el frontend:
//
//   Públicas
//     GET    /categories/search?query=   Categorías activas por nombre o descripción
//     GET    /categories/active          Categorías raíz activas (home)
//     GET    /categories/tree?state=     Árbol jerárquico (navbar y reordenamiento)
//     GET    /categories/:id/children    Subcategorías directas
//     GET    /categories/:id             Detalle con la cadena de padres (breadcrumbs)
//   Solo Admin
//     GET    /categories                 Listado plano completo, con el resumen de sus productos
//     POST   /categories
//     PATCH  /categories/reorder         Orden y padre en lote
//     PATCH  /categories/:id
//     DELETE /categories/:id
//
// Qué ve cada quien: sin sesión de administrador, /tree y /:id/children muestran solo las
// categorías activas (las inactivas son material de trabajo del panel admin).
//
// Ninguna ruta pública devuelve los productos de una categoría con todos sus datos: la tienda los
// pide paginados a /products. Antes /active y /:id los cargaban TODOS (con fotos y precios) para
// que la home y la página de categoría leyeran apenas el nombre.
// ============================================================================
import { sql, type Db } from '../_shared/db.ts';
import { isAdminRequest, requireAdmin } from '../_shared/auth.ts';
import {
  AppError,
  created,
  intParam,
  ok,
  pickFields,
  queryParam,
  serveRoutes,
  type RequestContext,
} from '../_shared/http.ts';
import {
  groupByParent,
  hasActiveProductsInSubtree,
  indexById,
  likePattern,
  loadActiveProductCounts,
  loadCategories,
  loadFirstPhotos,
  withParents,
  type CategoryRow,
} from '../_shared/catalogo.ts';

const VALID_STATES = ['Activo', 'Inactivo'];
const MAX_DEPTH = 2; // 3 niveles: 0, 1 y 2

// ─── Lectura ─────────────────────────────────────────────────────────────────

/**
 * Resumen de los productos agrupados por categoría: ID, nombre y primera foto. Es lo que necesita
 * el panel admin para contarlos y listarlos en el modal de cada categoría. No trae descripción,
 * stock, precios ni el resto de las fotos: antes se cargaba el producto completo de TODO el catálogo.
 */
// deno-lint-ignore no-explicit-any
async function loadProductSummariesByCategory(onlyActive: boolean): Promise<Map<number, any[]>> {
  const products = await sql`
    select id, name, category_id
    from product
    ${onlyActive ? sql`where state = 'Activo'` : sql``}
    order by id asc
  `;
  // Una sola foto por producto: la primera de su galería
  const firstPhotos = await loadFirstPhotos(products.map((product) => product.id as number));

  // deno-lint-ignore no-explicit-any
  const groups = new Map<number, any[]>();
  for (const { categoryId, ...product } of products) {
    const list = groups.get(categoryId) ?? [];
    const photo = firstPhotos.get(product.id);
    list.push({ ...product, photos: photo ? [photo] : [] });
    groups.set(categoryId, list);
  }
  return groups;
}

/** Arma el nodo de una categoría con sus hijas anidadas hasta `depthLimit` niveles. */
function buildTreeNode(
  category: CategoryRow,
  byParent: Map<number | null, CategoryRow[]>,
  depthLimit: number,
  onlyActive: boolean,
  // deno-lint-ignore no-explicit-any
): any {
  if (depthLimit <= 0) return { ...category, children: [] };

  const children = (byParent.get(category.id) ?? [])
    .filter((child) => !onlyActive || child.state === 'Activo')
    .map((child) => buildTreeNode(child, byParent, depthLimit - 1, onlyActive));

  return { ...category, children };
}

async function searchCategories(ctx: RequestContext) {
  const query = queryParam(ctx, 'query') ?? '';
  const [categories, activeCounts, productsByCategory] = await Promise.all([
    loadCategories(),
    loadActiveProductCounts(),
    // Es una ruta pública: solo los productos activos (antes devolvía también los inactivos)
    loadProductSummariesByCategory(true),
  ]);
  const byParent = groupByParent(categories);
  const text = query.toLowerCase();

  const result = categories
    .filter((c) => c.state === 'Activo')
    .filter((c) => c.name.toLowerCase().includes(text) || (c.description ?? '').toLowerCase().includes(text))
    // Filtrar categorías que no tienen productos activos en su subárbol
    .filter((c) => hasActiveProductsInSubtree(c.id, byParent, activeCounts))
    .map((c) => ({ ...c, products: productsByCategory.get(c.id) ?? [] }));

  return ok('Categorías encontradas', result);
}

async function findAll(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const [categories, productsByCategory] = await Promise.all([
    loadCategories(),
    loadProductSummariesByCategory(false),
  ]);
  const byId = indexById(categories);
  const byParent = groupByParent(categories);

  // Listado plano: cada categoría con su padre, sus hijas directas y el resumen de sus productos
  const result = categories.map((c) => ({
    ...withParents(c, byId),
    children: byParent.get(c.id) ?? [],
    products: productsByCategory.get(c.id) ?? [],
  }));

  return ok('Todas las Categorías fueron encontradas', result);
}

async function findOne(ctx: RequestContext) {
  const id = intParam(ctx, 'id', 'ID de categoría inválido');
  const categories = await loadCategories();
  const byId = indexById(categories);
  const category = byId.get(id);
  if (!category) throw new AppError('Categoría no encontrada', 404);

  // Es público a propósito: la página de categoría muestra el aviso de "categoría inactiva"
  return ok('Categoría encontrada', withParents(category, byId));
}

async function getTree(ctx: RequestContext) {
  const depthLimit = Number.parseInt(ctx.query.get('depth') ?? '', 10) || 5;
  let state = queryParam(ctx, 'state');
  // Sin sesión de administrador solo se ven las activas, se pida el filtro o no. Cuando ya se pide
  // "Activo" (la llamada de la tienda) no hace falta averiguar quién consulta.
  if (state !== 'Activo' && !(await isAdminRequest(ctx.req))) state = 'Activo';
  const onlyActive = state === 'Activo';

  const categories = await loadCategories();
  const byParent = groupByParent(categories);
  let roots = (byParent.get(null) ?? []).filter((c) => !state || c.state === state);

  // Filtrar categorías que no tienen productos activos en su subárbol
  if (onlyActive) {
    const activeCounts = await loadActiveProductCounts();
    roots = roots.filter((c) => hasActiveProductsInSubtree(c.id, byParent, activeCounts));
  }

  return ok(
    'Árbol de categorías obtenido',
    roots.map((c) => buildTreeNode(c, byParent, depthLimit, onlyActive)),
  );
}

async function getChildren(ctx: RequestContext) {
  const id = intParam(ctx, 'id', 'ID de categoría inválido');
  const byParent = groupByParent(await loadCategories());

  // Sin sesión de administrador las subcategorías inactivas no se ven
  const isAdmin = await isAdminRequest(ctx.req);
  const isVisible = (category: CategoryRow) => isAdmin || category.state === 'Activo';
  const children = (byParent.get(id) ?? [])
    .filter(isVisible)
    .map((c) => ({ ...c, children: (byParent.get(c.id) ?? []).filter(isVisible) }));
  return ok('Subcategorías encontradas', children);
}

async function findAllActive() {
  const [categories, activeCounts] = await Promise.all([loadCategories(), loadActiveProductCounts()]);
  const byParent = groupByParent(categories);

  const result = (byParent.get(null) ?? [])
    .filter((c) => c.state === 'Activo')
    // Filtrar categorías que no tienen productos activos en su subárbol
    .filter((c) => hasActiveProductsInSubtree(c.id, byParent, activeCounts))
    // Las subcategorías inactivas se excluyen en todos los niveles
    .map((c) => buildTreeNode(c, byParent, 2, true));

  return ok('Categorías activas encontradas', result);
}

// ─── Escritura (helpers de orden y jerarquía) ────────────────────────────────

/** Desplaza el orden de las categorías de un nivel a partir de una posición inicial. */
async function shiftPeers(tx: Db, parentId: number | null, fromOrder: number, delta: number) {
  await tx`
    update category set "order" = "order" + ${delta}
    where parent_id is not distinct from ${parentId}::int and "order" >= ${fromOrder}
  `;
}

/** Desplaza el orden de las categorías en un rango específico. */
async function shiftPeersBetween(tx: Db, parentId: number | null, from: number, to: number, delta: number) {
  await tx`
    update category set "order" = "order" + ${delta}
    where parent_id is not distinct from ${parentId}::int and "order" >= ${from} and "order" <= ${to}
  `;
}

/** Orden que le corresponde a una categoría nueva al final de su nivel. */
function nextOrder(byParent: Map<number | null, CategoryRow[]>, parentId: number | null, excludeId?: number): number {
  const peers = (byParent.get(parentId) ?? []).filter((c) => c.id !== excludeId);
  return peers.length > 0 ? Math.max(...peers.map((c) => c.order)) + 1 : 1;
}

/**
 * Recorre los ancestros de `potentialParentId` para verificar si `categoryId` es uno de ellos.
 * Útil para detectar ciclos circulares.
 */
function isAncestor(potentialParentId: number, categoryId: number, byId: Map<number, CategoryRow>): boolean {
  let currentId = byId.get(potentialParentId)?.parentId ?? null;
  while (currentId !== null) {
    if (currentId === categoryId) return true;
    currentId = byId.get(currentId)?.parentId ?? null;
  }
  return false;
}

/** Devuelve todos los descendientes de una categoría (hijas, nietas, ...). */
function collectDescendants(categoryId: number, categories: CategoryRow[]): CategoryRow[] {
  const direct = categories.filter((c) => c.parentId === categoryId);
  return direct.flatMap((child) => [child, ...collectDescendants(child.id, categories)]);
}

/** Bloquea y trae todas las categorías: serializa las modificaciones concurrentes del árbol. */
async function lockCategories(tx: Db): Promise<CategoryRow[]> {
  return await tx`select * from category order by "order" asc, name asc for update`;
}

function assertValidOrder(order: unknown): void {
  if (order !== undefined && (typeof order !== 'number' || !Number.isInteger(order) || order < 0)) {
    throw new AppError('El orden debe ser un número entero mayor o igual a 0', 400);
  }
}

// ─── Escritura ───────────────────────────────────────────────────────────────

const CATEGORY_FIELDS = ['name', 'description', 'order', 'state', 'parentId'];

async function addCategory(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const data = pickFields(ctx.body, CATEGORY_FIELDS);

  if (!data.name) throw new AppError('El Nombre de la categoría es requerido', 400);
  if (data.state !== undefined && !VALID_STATES.includes(data.state)) {
    throw new AppError(`Estado inválido. Los estados válidos son: ${VALID_STATES.join(', ')}`, 400);
  }
  assertValidOrder(data.order);

  try {
    const category = await sql.begin(async (tx: Db) => {
      const categories = await lockCategories(tx);
      const byId = indexById(categories);
      const byParent = groupByParent(categories);

      let depth = 0;
      let parentId: number | null = null;

      if (data.parentId) {
        const parent = byId.get(Number(data.parentId));
        if (!parent) throw new AppError('La categoría padre especificada no existe', 404);
        depth = parent.depth + 1;
        parentId = parent.id;
        if (depth > MAX_DEPTH) {
          throw new AppError('Se ha excedido el límite máximo de profundidad (3 niveles)', 400);
        }
      }

      let order: number = data.order;
      if (order === undefined) {
        order = nextOrder(byParent, parentId);
      } else {
        // Abrir hueco en el nivel correspondiente
        await shiftPeers(tx, parentId, order, 1);
      }

      const state = data.state || 'Activo';
      const [row] = await tx`
        insert into category ${tx({
          name: data.name,
          description: data.description ?? null,
          order,
          state,
          depth,
          parentId,
          deletedAt: state === 'Inactivo' ? new Date() : null,
        })}
        returning *
      `;
      return row;
    });

    return created('Categoría creada', category);
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    if ((err as any)?.code === '23505') throw new AppError('Ya existe una categoría con este nombre', 409);
    throw err;
  }
}

async function updateCategory(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de categoría inválido');
  const data = pickFields(ctx.body, CATEGORY_FIELDS);

  if (data.state !== undefined && !VALID_STATES.includes(data.state)) {
    throw new AppError(`Estado inválido. Los estados válidos son: ${VALID_STATES.join(', ')}`, 400);
  }
  assertValidOrder(data.order);

  try {
    const category = await sql.begin(async (tx: Db) => {
      const categories = await lockCategories(tx);
      const byId = indexById(categories);
      const byParent = groupByParent(categories);

      const category = byId.get(id);
      if (!category) throw new AppError('Categoría no encontrada', 404);

      const oldParentId = category.parentId;
      const newParentId: number | null =
        data.parentId !== undefined ? Number(data.parentId) || null : oldParentId;
      const oldOrder = category.order;

      let newDepth = category.depth;
      let newOrder = category.order;

      // 1. Manejo de cambio de nivel / padre
      if (newParentId !== oldParentId) {
        if (newParentId === category.id) {
          throw new AppError('Una categoría no puede ser su propio padre', 400);
        }

        newDepth = 0;
        if (newParentId) {
          if (isAncestor(newParentId, category.id, byId)) {
            throw new AppError('Asignación de padre inválida: crearía un ciclo circular', 400);
          }

          const newParent = byId.get(newParentId);
          if (!newParent) throw new AppError('La categoría padre especificada no existe', 404);

          newDepth = newParent.depth + 1;
          if (newDepth > MAX_DEPTH) {
            throw new AppError('Se ha excedido el límite máximo de profundidad (3 niveles)', 400);
          }
        }

        // Cerrar hueco en el padre anterior (mover los de orden > oldOrder, un lugar hacia arriba)
        await shiftPeers(tx, oldParentId, oldOrder + 1, -1);

        if (data.order === undefined) {
          newOrder = nextOrder(byParent, newParentId, category.id);
        } else {
          newOrder = data.order;
          // Abrir hueco en el nuevo padre
          await shiftPeers(tx, newParentId, newOrder, 1);
        }

        // Si cambió la profundidad, se arrastra a todos sus descendientes
        const depthDiff = newDepth - category.depth;
        if (depthDiff !== 0) {
          for (const descendant of collectDescendants(category.id, categories)) {
            if (descendant.depth + depthDiff > MAX_DEPTH) {
              throw new AppError(
                'La operación resultaría en una profundidad mayor a 3 niveles para algunas subcategorías',
                400,
              );
            }
            await tx`update category set depth = depth + ${depthDiff} where id = ${descendant.id}`;
          }
        }
      }
      // 2. Cambio de orden en el MISMO nivel
      else if (data.order !== undefined && data.order !== oldOrder) {
        newOrder = data.order;
        if (newOrder < oldOrder) {
          // Mover hacia arriba: desplazar intermedios hacia abajo
          await shiftPeersBetween(tx, newParentId, newOrder, oldOrder - 1, 1);
        } else {
          // Mover hacia abajo: desplazar intermedios hacia arriba
          await shiftPeersBetween(tx, newParentId, oldOrder + 1, newOrder, -1);
        }
      }

      const oldState = category.state;
      const newState: string = data.state ?? oldState;

      if (newState !== oldState && newState === 'Activo') {
        const activeCounts = await loadActiveProductCounts(tx);
        if (!hasActiveProductsInSubtree(category.id, byParent, activeCounts)) {
          throw new AppError(
            'No se puede activar una categoría que no tiene productos activos ni subcategorías con productos.',
            400,
          );
        }
      }

      // deno-lint-ignore no-explicit-any
      const changes: Record<string, any> = {
        parentId: newParentId,
        depth: newDepth,
        order: newOrder,
        state: newState,
      };
      if (data.name !== undefined) changes.name = data.name;
      if (data.description !== undefined) changes.description = data.description;
      if (newState !== oldState) changes.deletedAt = newState === 'Inactivo' ? new Date() : null;

      const [row] = await tx`update category set ${tx(changes)} where id = ${id} returning *`;
      return row;
    });

    return ok('Categoría actualizada', category);
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    if ((err as any)?.code === '23505') throw new AppError('Ya existe una categoría con este nombre', 409);
    throw err;
  }
}

async function bulkUpdateOrder(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const updates = ctx.body.updates;

  if (!Array.isArray(updates)) throw new AppError('Formato inválido', 400);
  for (const update of updates) {
    if (!Number.isInteger(update?.id) || !Number.isInteger(update?.order)) {
      throw new AppError('Cada elemento debe tener un "id" y un "order" numéricos', 400);
    }
  }

  await sql.begin(async (tx: Db) => {
    // Se trabaja sobre una copia en memoria: cada cambio ve el resultado de los anteriores
    const categories = (await lockCategories(tx)).map((c) => ({ ...c }));
    const byId = indexById(categories);
    const changedIds = new Set<number>();

    for (const update of updates) {
      const category = byId.get(update.id);
      if (!category) throw new AppError(`Categoría no encontrada (ID: ${update.id})`, 404);

      const parentId: number | null = update.parentId ? Number(update.parentId) : null;
      let newDepth = 0;

      if (parentId !== null) {
        if (parentId === category.id) {
          throw new AppError(`Una categoría no puede ser su propio padre (ID: ${category.id})`, 400);
        }

        const newParent = byId.get(parentId);
        if (!newParent) {
          throw new AppError(`La categoría padre especificada no existe (ID: ${parentId})`, 404);
        }

        if (isAncestor(parentId, category.id, byId)) {
          throw new AppError('Asignación inválida: se detectó un ciclo circular', 400);
        }

        newDepth = newParent.depth + 1;
        if (newDepth > MAX_DEPTH) {
          throw new AppError('Se ha excedido el límite máximo de profundidad (3 niveles)', 400);
        }
      }

      const depthDiff = newDepth - category.depth;
      category.depth = newDepth;
      category.parentId = parentId;
      category.order = update.order;
      changedIds.add(category.id);

      if (depthDiff !== 0) {
        for (const descendant of collectDescendants(category.id, categories)) {
          descendant.depth += depthDiff;
          if (descendant.depth > MAX_DEPTH) {
            throw new AppError(
              'La operación resultaría en una profundidad mayor a 3 niveles para algunas subcategorías',
              400,
            );
          }
          changedIds.add(descendant.id);
        }
      }
    }

    for (const id of changedIds) {
      const category = byId.get(id) as CategoryRow;
      await tx`
        update category
        set parent_id = ${category.parentId}, depth = ${category.depth}, "order" = ${category.order}
        where id = ${id}
      `;
    }
  });

  return ok('Orden de categorías actualizado');
}

async function removeCategory(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de categoría inválido');

  await sql.begin(async (tx: Db) => {
    const categories = await lockCategories(tx);
    const category = indexById(categories).get(id);
    if (!category) throw new AppError('La categoría no existe', 404);

    if (categories.some((c) => c.parentId === id)) {
      throw new AppError(
        'Esta categoría tiene subcategorías asociadas. Debes reasignarlas o eliminarlas primero.',
        400,
      );
    }

    const [{ total }] = await tx`select count(*)::int as total from product where category_id = ${id}`;
    if (total > 0) {
      throw new AppError(
        'Esta categoría tiene productos asociados.\n\nConsejo: cambiá el estado a "Inactivo" en lugar de borrarla.',
        400,
      );
    }

    await tx`delete from category where id = ${id}`;

    // Cerrar hueco tras la eliminación
    await shiftPeers(tx, category.parentId, category.order + 1, -1);
  });

  return ok('Categoría eliminada');
}

serveRoutes('categories', [
  // Rutas públicas (cualquier usuario puede ver categorías)
  ['GET', '/search', searchCategories],
  ['GET', '/active', findAllActive],
  ['GET', '/tree', getTree],
  ['GET', '/:id/children', getChildren],
  ['GET', '/', findAll],
  ['GET', '/:id', findOne],

  // Rutas protegidas (solo Admin puede crear/editar/eliminar)
  ['POST', '/', addCategory],
  ['PATCH', '/reorder', bulkUpdateOrder],
  ['PATCH', '/:id', updateCategory],
  ['DELETE', '/:id', removeCategory],
]);
