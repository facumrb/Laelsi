// ============================================================================
// Edge Function: orders (Tarea 3.7)
// ============================================================================
// Reemplaza a order.routes.ts + order.controller.ts + order.service.ts.
//
//   Cliente autenticado
//     POST  /orders                        Crear orden (verifica Turnstile)
//     GET   /orders/client/:clientId       Historial del cliente (dueño o Admin)
//     GET   /orders/:id                    Detalle (dueño o Admin)
//     PATCH /orders/:id/cancel             Cancelar (dueño o Admin)
//   Solo Admin
//     GET   /orders                        Listado con filtros
//     PATCH /orders/:id/status             Cambiar estado (máquina de estados)
//     PATCH /orders/:id/delivery-method    Cambiar método de entrega
//
// Ajuste de seguridad respecto del backend anterior: las rutas de órdenes no
// tenían NINGUNA verificación de sesión. Cualquiera podía listar, crear,
// modificar o cancelar órdenes de otros. Ahora cada ruta valida quién llama.
//
// La creación y la cancelación son atómicas: las resuelven las funciones SQL
// create_order y cancel_order (ver migrations/..._funciones_rpc.sql).
// ============================================================================
import { sql, type Db } from '../_shared/db.ts';
import { requireAdmin, requireOwnerOrAdmin, requireOwnerOrAdminOf, requireUser } from '../_shared/auth.ts';
import {
  AppError,
  created,
  getPagination,
  intParam,
  ok,
  paginated,
  queryParam,
  serveRoutes,
  type RequestContext,
} from '../_shared/http.ts';
import { likePattern } from '../_shared/catalogo.ts';
import { loadOrders } from '../_shared/pedidos.ts';
import { requireTurnstile } from '../_shared/turnstile.ts';

const VALID_ORDER_STATES = ['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado'];
const VALID_DELIVERY_METHODS = ['Envío', 'Retiro en sucursal'];
const VALID_PAYMENT_METHODS = ['Transferencia', 'Local'];

// Tope de líneas por orden. create_order bloquea (FOR UPDATE) una fila de producto por cada línea:
// una petición con miles de líneas las retendría durante mucho tiempo y frenaría las demás compras.
const MAX_ORDER_ITEMS = 100;

// Seguridad: usar Map en lugar de un objeto plano para que las búsquedas nunca recorran la
// cadena de prototipos (CWE-1321).
const TRANSITIONS_ENVIO = new Map<string, string[]>([
  ['Pendiente', ['Pagado', 'Cancelado']],
  ['Pagado', ['Enviado', 'Cancelado']],
  ['Enviado', ['Entregado', 'Cancelado']],
  ['Entregado', []],
  ['Cancelado', []],
]);

const TRANSITIONS_RETIRO = new Map<string, string[]>([
  ['Pendiente', ['Pagado', 'Cancelado']],
  ['Pagado', ['Entregado', 'Cancelado']],
  ['Enviado', []],
  ['Entregado', []],
  ['Cancelado', []],
]);

// ─── Lectura ─────────────────────────────────────────────────────────────────

async function loadOrder(id: number) {
  const [order] = await loadOrders([id]);
  if (!order) throw new AppError('Orden no encontrada', 404);
  return order;
}

/** Devuelve el ID del cliente dueño de la orden, o null si la orden no existe. */
async function getOrderOwnerId(id: number): Promise<number | null> {
  const [order] = await sql`select client_id from "order" where id = ${id}`;
  return order ? order.clientId : null;
}

/**
 * Exige sesión y que la orden sea del usuario (o que sea administrador). Sin sesión es siempre 401
 * y una orden ajena responde igual que una inexistente (404): los IDs son secuenciales y la
 * respuesta no puede servir para averiguar cuáles existen.
 */
function requireOrderAccess(req: Request, id: number) {
  return requireOwnerOrAdminOf(req, () => getOrderOwnerId(id), 'Orden no encontrada');
}

// ─── Rutas ───────────────────────────────────────────────────────────────────

async function create(ctx: RequestContext) {
  const user = await requireUser(ctx.req);
  const { items, deliveryMethod, paymentMethod } = ctx.body;

  // Un cliente solo puede comprar para sí mismo. Un Admin puede cargar una orden para un cliente.
  const clientId = user.role === 'Admin' ? Number(ctx.body.clientId) : user.id;
  if (!Number.isInteger(clientId)) {
    throw new AppError('ID de cliente inválido o no proporcionado', 400);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('La orden debe contener al menos un producto', 400);
  }

  if (items.length > MAX_ORDER_ITEMS) {
    throw new AppError(`La orden no puede tener más de ${MAX_ORDER_ITEMS} productos`, 400);
  }

  for (const item of items) {
    if (!item?.productId || Number.isNaN(Number(item.productId))) {
      throw new AppError('Cada item debe tener un productId válido', 400);
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError(`La cantidad del producto (ID: ${item.productId}) debe ser un entero positivo`, 400);
    }
  }

  if (deliveryMethod !== undefined && !VALID_DELIVERY_METHODS.includes(deliveryMethod)) {
    throw new AppError(
      `Método de entrega inválido. Los métodos válidos son: ${VALID_DELIVERY_METHODS.join(', ')}`,
      400,
    );
  }

  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new AppError(
      `Método de pago inválido o no proporcionado. Los métodos válidos son: ${VALID_PAYMENT_METHODS.join(', ')}`,
      400,
    );
  }

  const finalDeliveryMethod = deliveryMethod || 'Retiro en sucursal';

  // Anti-bots: se verifica recién cuando los datos son válidos, porque el token es de un solo uso
  await requireTurnstile(ctx.req);

  const cleanItems = items.map((item: { productId: number; quantity: number }) => ({
    productId: Number(item.productId),
    quantity: item.quantity,
  }));

  // Transacción atómica: valida stock, lo descuenta y crea la orden con sus líneas
  const [{ orderId }] = await sql`
    select create_order(
      ${clientId},
      ${finalDeliveryMethod}::delivery_method,
      ${paymentMethod}::payment_method,
      ${sql.json(cleanItems)}::jsonb
    ) as order_id
  `;

  return created('Orden creada exitosamente', await loadOrder(orderId));
}

async function findAll(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const { page, limit, offset } = getPagination(ctx);

  const status = queryParam(ctx, 'status');
  const deliveryMethod = queryParam(ctx, 'deliveryMethod');
  const paymentMethod = queryParam(ctx, 'paymentMethod');
  const query = queryParam(ctx, 'query');

  // Los filtros con valores desconocidos se ignoran
  const where = () => sql`
    true
    ${status && VALID_ORDER_STATES.includes(status) ? sql`and o.status = ${status}::order_state` : sql``}
    ${
      deliveryMethod && VALID_DELIVERY_METHODS.includes(deliveryMethod)
        ? sql`and o.delivery_method = ${deliveryMethod}::delivery_method`
        : sql``
    }
    ${
      paymentMethod && VALID_PAYMENT_METHODS.includes(paymentMethod)
        ? sql`and o.payment_method = ${paymentMethod}::payment_method`
        : sql``
    }
    ${
      !query
        ? sql``
        : /^\d+$/.test(query)
          ? // Si es un número, buscar por ID de orden
            sql`and o.id = ${Number(query)}`
          : // Buscar por nombre o apellido del cliente
            sql`and (u.name ilike ${likePattern(query)} or u.last_name ilike ${likePattern(query)})`
    }
  `;

  const rows = await sql`
    select o.id
    from "order" o
    join "user" u on u.id = o.client_id
    where ${where()}
    order by o.id desc
    limit ${limit} offset ${offset}
  `;
  const [{ total }] = await sql`
    select count(*)::int as total
    from "order" o
    join "user" u on u.id = o.client_id
    where ${where()}
  `;

  const orders = await loadOrders(rows.map((r) => r.id));
  return ok('Todas las órdenes encontradas', paginated(orders, total, page, limit));
}

async function findOne(ctx: RequestContext) {
  const id = intParam(ctx, 'id', 'ID de orden inválido');
  await requireOrderAccess(ctx.req, id);
  return ok('Orden encontrada', await loadOrder(id));
}

async function findByClient(ctx: RequestContext) {
  const clientId = intParam(ctx, 'clientId', 'ID de cliente inválido');
  await requireOwnerOrAdmin(ctx.req, clientId);

  const { page, limit, offset } = getPagination(ctx);

  const rows = await sql`
    select id from "order" where client_id = ${clientId}
    order by id desc
    limit ${limit} offset ${offset}
  `;
  const [{ total }] = await sql`select count(*)::int as total from "order" where client_id = ${clientId}`;

  const orders = await loadOrders(rows.map((r) => r.id));
  return ok('Órdenes del cliente encontradas', paginated(orders, total, page, limit));
}

function validateStatusTransition(order: { status: string; deliveryMethod: string }, newState: string) {
  const map = order.deliveryMethod === 'Envío' ? TRANSITIONS_ENVIO : TRANSITIONS_RETIRO;
  const allowedTransitions = map.get(order.status) || [];

  if (!allowedTransitions.includes(newState)) {
    const transitionsStr = allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'ninguna (estado final)';
    throw new AppError(
      `No se puede cambiar el estado de "${order.status}" a "${newState}" para una orden de tipo "${order.deliveryMethod}". Transiciones válidas: ${transitionsStr}`,
      400,
    );
  }
}

async function updateStatus(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de orden inválido');
  const status = ctx.body.status;

  if (!status || !VALID_ORDER_STATES.includes(status)) {
    throw new AppError(`Estado inválido. Los estados válidos son: ${VALID_ORDER_STATES.join(', ')}`, 400);
  }

  if (status === 'Cancelado') {
    // Cancelar siempre pasa por cancel_order, que además de cambiar el estado
    // restaura el stock.
    await sql`select cancel_order(${id})`;
  } else {
    await sql.begin(async (tx: Db) => {
      const [order] = await tx`select status, delivery_method from "order" where id = ${id} for update`;
      if (!order) throw new AppError('Orden no encontrada', 404);

      validateStatusTransition(order, status);
      await tx`update "order" set status = ${status}::order_state where id = ${id}`;
    });
  }

  return ok('Estado de la orden actualizado', await loadOrder(id));
}

async function updateDeliveryMethod(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const id = intParam(ctx, 'id', 'ID de orden inválido');
  const deliveryMethod = ctx.body.deliveryMethod;

  if (!deliveryMethod || !VALID_DELIVERY_METHODS.includes(deliveryMethod)) {
    throw new AppError(
      `Método de entrega inválido. Los métodos válidos son: ${VALID_DELIVERY_METHODS.join(', ')}`,
      400,
    );
  }

  await sql.begin(async (tx: Db) => {
    const [order] = await tx`select status from "order" where id = ${id} for update`;
    if (!order) throw new AppError('Orden no encontrada', 404);

    if (['Enviado', 'Entregado', 'Cancelado'].includes(order.status)) {
      throw new AppError(
        `No se puede cambiar el método de entrega de una orden en estado "${order.status}"`,
        400,
      );
    }

    await tx`update "order" set delivery_method = ${deliveryMethod}::delivery_method where id = ${id}`;
  });

  return ok('Método de entrega actualizado', await loadOrder(id));
}

async function cancel(ctx: RequestContext) {
  const id = intParam(ctx, 'id', 'ID de orden inválido');
  await requireOrderAccess(ctx.req, id);

  // Transacción atómica: restaura el stock y marca la orden como cancelada
  await sql`select cancel_order(${id})`;

  return ok('Orden cancelada correctamente', await loadOrder(id));
}

serveRoutes('orders', [
  ['POST', '/', create],

  ['GET', '/', findAll],

  ['GET', '/client/:clientId', findByClient],

  ['GET', '/:id', findOne],

  ['PATCH', '/:id/status', updateStatus],

  ['PATCH', '/:id/delivery-method', updateDeliveryMethod],

  ['PATCH', '/:id/cancel', cancel],
]);
