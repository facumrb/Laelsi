// ============================================================================
// Edge Function: products (Tarea 3.3)
// ============================================================================
// Reemplaza a product.routes.ts + product.controller.ts + product.service.ts.
// Mantiene las mismas rutas y respuestas que consumía el frontend:
//
//   Públicas
//     GET    /products/active                       Activos con categoría activa
//     GET    /products/page                         Ídem (paginado para el cliente final)
//     GET    /products/search?query=                Búsqueda por texto
//     GET    /products/best-sellers                 Más vendidos
//     GET    /products/best-sellers/category/:categoryId
//     GET    /products/active/category/:categoryId  Activos de una categoría
//     GET    /products/active/:id                   Detalle (solo si está activo)
//     GET    /products/:id                          Detalle (también de un producto inactivo: la página
//                                                   de producto muestra el aviso de "no disponible")
//   Solo Admin
//     GET    /products                              Todos, con filtros (panel admin)
//     GET    /products/category/:categoryId         Todos los de una categoría, activos o no
//     POST   /products
//     PATCH  /products/:id
//     DELETE /products/:id
//
// Los listados "Todos" eran públicos y exponían a cualquiera los productos inactivos, el stock y las
// ventas de todo el catálogo. Ninguna pantalla de la tienda los usa: solo el panel admin.
//
// Los cambios masivos de precio (antes /products/bulk/*) viven en la función bulk-prices.
// ============================================================================
import { sql, type Db } from '../_shared/db.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  AppError,
  created,
  getPagination,
  intParam,
  ok,
  pickFields,
  queryParam,
  serveRoutes,
  type RequestContext,
} from '../_shared/http.ts';
import {
  checkAndDeactivateCategory,
  idsDeCategoria,
  likePattern,
  loadProducts,
  paginateProducts,
} from '../_shared/catalogo.ts';
import { deleteObject } from '../_shared/r2.ts';

const VALID_CURRENCIES = ['ARS', 'USD', 'EUR'];
const VALID_PRODUCT_STATES = ['Activo', 'Inactivo'];
const PRODUCT_FIELDS = ['name', 'description', 'brand', 'totalSold', 'state', 'stock', 'price', 'currency', 'category'];

// ─── Filtros reutilizables ───────────────────────────────────────────────────

/** Solo productos activos cuya categoría también está activa (lo que ve el cliente final). */
const activeOnly = () => sql`p.state = 'Activo' and c.state = 'Activo'`;

/** Coincidencia parcial en nombre, descripción o marca (sin distinguir mayúsculas). */
const matchesText = (text: string) => sql`(
  p.name ilike ${likePattern(text)}
  or p.description ilike ${likePattern(text)}
  or p.brand ilike ${likePattern(text)}
)`;

interface ClientFilters {
  brand?: string;
  priceOrder?: string;
  popularityOrder?: string;
}

function readClientFilters(ctx: RequestContext): ClientFilters {
  return {
    brand: queryParam(ctx, 'brand'),
    priceOrder: queryParam(ctx, 'priceOrder'),
    popularityOrder: queryParam(ctx, 'popularityOrder'),
  };
}

// Construye el orderBy para filtros de cliente (precio y popularidad)
function clientOrderBy(filters: ClientFilters) {
  if (filters.priceOrder === 'Menor') return sql`cp.amount asc nulls last, p.id asc`;
  if (filters.priceOrder === 'Mayor') return sql`cp.amount desc nulls last, p.id asc`;
  if (filters.popularityOrder === 'MasVentas') return sql`p.total_sold desc, p.id asc`;
  if (filters.popularityOrder === 'MenosVentas') return sql`p.total_sold asc, p.id asc`;
  return sql`p.id asc`;
}

/**
 * Marcas para el filtro de la tienda. Salen de TODOS los productos del resultado, no solo de la
 * página que se muestra (con 16 por página, el filtro ofrecía únicamente las marcas de esos 16), y
 * sin aplicar la marca ya elegida, para que la persona pueda cambiar de marca.
 */
// deno-lint-ignore no-explicit-any
async function loadBrands(where: () => any): Promise<string[]> {
  const rows = await sql`
    select distinct p.brand
    from product p
    join category c on c.id = p.category_id
    where ${where()}
    order by p.brand asc
  `;
  return rows.map((row) => row.brand as string);
}

// ─── Búsquedas y categorías ──────────────────────────────────────────────────

async function searchProductsByText(ctx: RequestContext) {
  const query = queryParam(ctx, 'query');
  if (!query) throw new AppError('El parámetro de búsqueda es requerido', 400);

  const { page, limit } = getPagination(ctx);
  const filters = readClientFilters(ctx);

  const matching = () => sql`${activeOnly()} and ${matchesText(query)}`;
  const [products, brands] = await Promise.all([
    paginateProducts({
      where: () => sql`${matching()} ${filters.brand ? sql`and p.brand = ${filters.brand}` : sql``}`,
      orderBy: () => clientOrderBy(filters),
      page,
      limit,
    }),
    loadBrands(matching),
  ]);
  return ok('Productos encontrados', { ...products, brands });
}

async function findProductsByCategory(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const categoryId = intParam(ctx, 'categoryId', 'ID de categoría inválido');
  const { page, limit } = getPagination(ctx);
  // PROVISIONAL-2026-11-08 (subárbol de categorías): el administrador ve todo el subárbol, activo o no
  const categoryIds = await idsDeCategoria(categoryId);

  const products = await paginateProducts({
    where: () => sql`p.category_id in ${sql(categoryIds)}`,
    orderBy: () => sql`p.id asc`,
    page,
    limit,
  });
  return ok('Productos encontrados en la categoría', products);
}

async function findActiveProductsByCategory(ctx: RequestContext) {
  const categoryId = intParam(ctx, 'categoryId', 'ID de categoría inválido');
  const { page, limit } = getPagination(ctx);
  const filters = readClientFilters(ctx);
  // PROVISIONAL-2026-11-08 (subárbol de categorías): el cliente ve el subárbol, bajando solo por activas
  const categoryIds = await idsDeCategoria(categoryId, { soloActivas: true });

  const inCategory = () => sql`${activeOnly()} and p.category_id in ${sql(categoryIds)}`;
  const [products, brands] = await Promise.all([
    paginateProducts({
      where: () => sql`${inCategory()} ${filters.brand ? sql`and p.brand = ${filters.brand}` : sql``}`,
      orderBy: () => clientOrderBy(filters),
      page,
      limit,
    }),
    loadBrands(inCategory),
  ]);
  return ok('Productos activos encontrados en la categoría', { ...products, brands });
}

// ─── Consultas generales ─────────────────────────────────────────────────────

async function findAll(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const { page, limit } = getPagination(ctx);
  const query = queryParam(ctx, 'query');
  const state = queryParam(ctx, 'state');
  const categoryId = Number(queryParam(ctx, 'categoryId')) || undefined;
  // PROVISIONAL-2026-11-08 (subárbol de categorías): filtrar por una madre incluye a sus descendientes
  const categoryIds = categoryId ? await idsDeCategoria(categoryId) : undefined;
  const stockFilter = queryParam(ctx, 'stockFilter');

  if (state !== undefined && !VALID_PRODUCT_STATES.includes(state)) {
    throw new AppError(`Estado de producto inválido. Los estados válidos son: ${VALID_PRODUCT_STATES.join(', ')}`, 400);
  }

  // Filtros de stock (WHERE) y ordenamiento
  const stockWhere = () => {
    if (stockFilter === 'AltoStock') return sql`and p.stock > 10`;
    if (stockFilter === 'BajoStock') return sql`and p.stock <= 10 and p.stock > 0`;
    if (stockFilter === 'SinStock') return sql`and p.stock = 0`;
    return sql``;
  };

  const orderBy = () => {
    if (stockFilter === 'AltoStock' || stockFilter === 'BajoStock' || stockFilter === 'MasProductos') {
      return sql`p.stock desc, p.id asc`;
    }
    if (stockFilter === 'MenosProductos') return sql`p.stock asc, p.id asc`;
    return sql`p.id asc`;
  };

  const products = await paginateProducts({
    where: () => sql`
      true
      ${query ? sql`and ${matchesText(query)}` : sql``}
      ${state ? sql`and p.state = ${state}` : sql``}
      ${categoryIds ? sql`and p.category_id in ${sql(categoryIds)}` : sql``}
      ${stockWhere()}
    `,
    orderBy,
    page,
    limit,
  });
  return ok('Todos los Productos fueron encontrados', products);
}

async function findOne(ctx: RequestContext) {
  const id = intParam(ctx, 'id', 'ID de producto inválido');
  const [product] = await loadProducts([id]);
  if (!product) throw new AppError('Producto no encontrado', 404);
  return ok('Producto encontrado', product);
}

async function findOneActive(ctx: RequestContext) {
  const id = intParam(ctx, 'id', 'ID de producto inválido');
  const [row] = await sql`
    select p.id
    from product p
    join category c on c.id = p.category_id
    where p.id = ${id} and ${activeOnly()}
  `;
  if (!row) throw new AppError('Producto no encontrado', 404);

  const [product] = await loadProducts([id]);
  return ok('Producto encontrado', product);
}

// ─── Datos paginados y estados activos (cliente final) ───────────────────────

async function findAllActive(ctx: RequestContext) {
  const { page, limit } = getPagination(ctx);
  // 🚨 Para el cliente final, SÓLO se devuelven los activos con categoría activa
  const products = await paginateProducts({
    where: activeOnly,
    orderBy: () => sql`p.id asc`,
    page,
    limit,
  });
  return products;
}

// ─── Productos destacados (best sellers) ─────────────────────────────────────

async function bestSellers(limit: number, categoryId?: number) {
  // PROVISIONAL-2026-11-08 (subárbol de categorías): los más vendidos de una madre salen de todo su subárbol
  const categoryIds = categoryId ? await idsDeCategoria(categoryId, { soloActivas: true }) : undefined;
  const rows = await sql`
    select p.id
    from product p
    join category c on c.id = p.category_id
    where ${activeOnly()}
    ${categoryIds ? sql`and p.category_id in ${sql(categoryIds)}` : sql``}
    order by p.total_sold desc, p.id asc
    limit ${limit}
  `;
  return await loadProducts(rows.map((r) => r.id));
}

function bestSellersLimit(ctx: RequestContext): number {
  const limit = Number.parseInt(ctx.query.get('limit') ?? '', 10) || 10;
  return Math.min(Math.max(1, limit), 100);
}

async function findBestSellers(ctx: RequestContext) {
  return ok('Productos más vendidos encontrados', await bestSellers(bestSellersLimit(ctx)));
}

async function findBestSellersByCategory(ctx: RequestContext) {
  const categoryId = intParam(ctx, 'categoryId', 'ID de categoría inválido');
  return ok(
    'Productos más vendidos de la categoría encontrados',
    await bestSellers(bestSellersLimit(ctx), categoryId),
  );
}

// ─── Validación ──────────────────────────────────────────────────────────────

const isNonNegativeInteger = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Valida el formato de los campos del producto que vinieron en la petición; los ausentes se ignoran.
 * Lo comparten el alta y la edición, que antes tenían cada una su copia de las mismas reglas.
 * Qué campos son obligatorios lo decide cada una por su cuenta.
 */
// deno-lint-ignore no-explicit-any
function validateProductFields(fields: Record<string, any>): void {
  const { price, stock, totalSold, currency, state } = fields;

  if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price <= 0)) {
    throw new AppError('El precio debe ser un número positivo', 400);
  }

  if (stock !== undefined && !isNonNegativeInteger(stock)) {
    throw new AppError('El stock debe ser un número entero mayor o igual a 0', 400);
  }

  if (totalSold !== undefined && !isNonNegativeInteger(totalSold)) {
    throw new AppError('El total vendido debe ser un número entero mayor o igual a 0', 400);
  }

  if (currency !== undefined && !VALID_CURRENCIES.includes(currency)) {
    throw new AppError(`Moneda inválida. Las monedas válidas son: ${VALID_CURRENCIES.join(', ')}`, 400);
  }

  if (state !== undefined && !VALID_PRODUCT_STATES.includes(state)) {
    throw new AppError(`Estado de producto inválido. Los estados válidos son: ${VALID_PRODUCT_STATES.join(', ')}`, 400);
  }
}

// ─── Creación ────────────────────────────────────────────────────────────────

/** Traduce el error de nombre duplicado al mensaje que mostraba el backend anterior. */
function rethrowDuplicateName(err: unknown): never {
  // deno-lint-ignore no-explicit-any
  if ((err as any)?.code === '23505') throw new AppError('Ya existe un producto con el mismo nombre', 409);
  throw err;
}

async function addProduct(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const { price, currency, ...productData } = pickFields(ctx.body, PRODUCT_FIELDS);

  if (
    !productData.name ||
    !productData.description ||
    !productData.brand ||
    productData.stock === undefined ||
    price === undefined
  ) {
    throw new AppError('Los campos nombre, descripción, marca, stock y precio son obligatorios', 400);
  }

  validateProductFields({ price, currency, ...productData });

  if (!productData.category) {
    throw new AppError('La categoría es obligatoria', 400);
  }

  const categoryId = Number(productData.category);
  const [category] = await sql`select id from category where id = ${categoryId}`;
  if (!category) throw new AppError('La categoría especificada no existe', 404);

  try {
    // El producto y su primer precio se crean juntos: o se guardan los dos o ninguno
    const productId = await sql.begin(async (tx: Db) => {
      const state = productData.state || 'Activo';
      const [row] = await tx`
        insert into product ${tx({
          name: productData.name,
          description: productData.description,
          brand: productData.brand,
          totalSold: productData.totalSold ?? 0,
          state,
          stock: productData.stock,
          categoryId,
          deletedAt: state === 'Inactivo' ? new Date() : null,
        })}
        returning id
      `;

      await tx`
        insert into price ${tx({
          amount: price,
          currency: currency || 'ARS',
          productId: row.id,
          isCurrent: true,
        })}
      `;
      return row.id as number;
    });

    const [product] = await loadProducts([productId]);
    return created('Producto creado', product);
  } catch (err) {
    rethrowDuplicateName(err);
  }
}

// ─── Actualización ───────────────────────────────────────────────────────────

async function updateProduct(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de producto inválido');
  const { price, currency, ...updateData } = pickFields(ctx.body, PRODUCT_FIELDS);

  validateProductFields({ price, currency, ...updateData });

  const newCategoryId = updateData.category !== undefined ? Number(updateData.category) : undefined;
  if (newCategoryId !== undefined) {
    const [category] = await sql`select id from category where id = ${newCategoryId}`;
    if (!category) throw new AppError('La categoría especificada no existe', 404);
  }

  let oldState = '';
  let oldCategoryId = 0;
  let newState = '';

  try {
    await sql.begin(async (tx: Db) => {
      const [product] = await tx`select * from product where id = ${id} for update`;
      if (!product) throw new AppError('Producto no encontrado', 404);

      oldState = product.state;
      oldCategoryId = product.categoryId;
      newState = updateData.state ?? oldState;

      const [currentPrice] = await tx`select id, amount from price where product_id = ${id} and is_current`;
      if (price !== undefined && price !== currentPrice?.amount) {
        // El precio anterior queda en el historial y el nuevo pasa a ser el vigente
        await tx`update price set is_current = false where product_id = ${id} and is_current`;
        await tx`
          insert into price ${tx({
            amount: price,
            currency: currency || 'ARS',
            productId: id,
            isCurrent: true,
          })}
        `;
      }

      // deno-lint-ignore no-explicit-any
      const changes: Record<string, any> = {};
      for (const field of ['name', 'description', 'brand', 'totalSold', 'state', 'stock']) {
        const value = Reflect.get(updateData, field);
        if (value !== undefined) changes[field] = value;
      }
      if (newCategoryId !== undefined) changes.categoryId = newCategoryId;
      // deleted_at registra la fecha del último cambio de estado (la usa la auditoría del panel)
      if (newState !== oldState) changes.deletedAt = new Date();

      if (Object.keys(changes).length > 0) {
        await tx`update product set ${tx(changes)} where id = ${id}`;
      } else {
        // Aunque solo haya cambiado el precio, el producto se marca como modificado
        await tx`update product set updated_at = now() where id = ${id}`;
      }
    });
  } catch (err) {
    rethrowDuplicateName(err);
  }

  // 1. Si el producto pasó a Inactivo, verificar si su categoría actual debe desactivarse
  if (newState === 'Inactivo' && oldState === 'Activo') {
    await checkAndDeactivateCategory(newCategoryId ?? oldCategoryId);
  }

  // 2. Si el producto CAMBIÓ de categoría y está activo, la categoría anterior podría quedar vacía
  if (newCategoryId !== undefined && oldState === 'Activo' && newState === 'Activo') {
    if (oldCategoryId !== newCategoryId) {
      await checkAndDeactivateCategory(oldCategoryId);
    }
  }

  const [product] = await loadProducts([id]);
  return ok('Producto actualizado', product);
}

// ─── Borrado ─────────────────────────────────────────────────────────────────

async function removeProduct(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de producto inválido');

  const [product] = await sql`select id, category_id from product where id = ${id}`;
  if (!product) throw new AppError('El producto no existe', 404);

  const photos = await sql`select file_name from photo where product_id = ${id}`;

  try {
    // Las fotos y los precios se borran en cascada (ON DELETE CASCADE)
    await sql`delete from product where id = ${id}`;
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    if ((err as any)?.code === '23503') {
      throw new AppError(
        'No se puede eliminar el producto porque tiene pedidos asociados.\n\nConsejo: cambiá el estado a "Inactivo" en lugar de borrarlo.',
        409,
      );
    }
    throw err;
  }

  // Recién cuando el producto se borró de la base se eliminan sus archivos de R2
  await Promise.all(photos.map((photo) => deleteObject('product', photo.fileName)));

  // Verificar si la categoría debe desactivarse tras eliminar el producto
  await checkAndDeactivateCategory(product.categoryId);

  return ok('Producto eliminado');
}

serveRoutes('products', [
  // Rutas públicas (cualquier usuario puede ver productos)
  ['GET', '/', findAll],
  ['GET', '/active', async (ctx) => ok('Productos activos encontrados', await findAllActive(ctx))],
  ['GET', '/page', async (ctx) => ok('Página de productos encontrada', await findAllActive(ctx))],
  ['GET', '/search', searchProductsByText],
  ['GET', '/best-sellers', findBestSellers],
  ['GET', '/best-sellers/category/:categoryId', findBestSellersByCategory],
  ['GET', '/category/:categoryId', findProductsByCategory],
  ['GET', '/active/category/:categoryId', findActiveProductsByCategory],
  ['GET', '/active/:id', findOneActive],
  ['GET', '/:id', findOne],

  // Rutas protegidas (solo Admin puede crear/editar/eliminar)
  ['POST', '/', addProduct],
  ['PATCH', '/:id', updateProduct],
  ['DELETE', '/:id', removeProduct],
]);
