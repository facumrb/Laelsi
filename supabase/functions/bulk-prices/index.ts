// ============================================================================
// Edge Function: bulk-prices (Tarea 3.4)
// ============================================================================
// Reemplaza a bulkProduct.controller.ts + bulkProduct.service.ts.
// Todas las rutas son exclusivas del Admin:
//
//   POST /bulk-prices/preview             Calcula los precios nuevos sin guardar nada
//   POST /bulk-prices/apply               Aplica el cambio y registra el lote + auditoría
//   POST /bulk-prices/rollback/:batchId   Revierte un lote
//   GET  /bulk-prices/history             Historial de lotes
//
// apply y rollback corren dentro de una transacción: los precios, el lote y la
// auditoría se confirman todos juntos o no se guarda nada.
// ============================================================================
import { sql, type Db } from '../_shared/db.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { AppError, intParam, ok, serveRoutes, type RequestContext } from '../_shared/http.ts';

// ─── Constantes ──────────────────────────────────────────────────────────────
const DEFAULT_MAX_DISCOUNT = 90;

function getMaxDiscountLimit(): number {
  const envLimit = Deno.env.get('MAX_BULK_DISCOUNT_PERCENTAGE');
  const parsed = envLimit ? Number.parseInt(envLimit, 10) : NaN;
  return Number.isNaN(parsed) ? DEFAULT_MAX_DISCOUNT : parsed;
}

// ─── DTOs ────────────────────────────────────────────────────────────────────
interface BulkPriceAdjustmentDto {
  productIds: number[];
  adjustmentType: 'fixed' | 'percentage';
  adjustmentValue: number;
  roundingRule?: string;
}

/**
 * Calcula el nuevo precio para un producto dado el ajuste y la regla de redondeo.
 * No persiste nada.
 */
function computeNewPrice(
  currentPrice: number,
  adjustmentType: 'fixed' | 'percentage',
  adjustmentValue: number,
  roundingRule?: string,
): number {
  let newPrice =
    adjustmentType === 'fixed' ? currentPrice + adjustmentValue : currentPrice + (currentPrice * adjustmentValue) / 100;

  if (roundingRule === 'nearest-integer') newPrice = Math.round(newPrice);
  else if (roundingRule === 'ceil') newPrice = Math.ceil(newPrice);
  else if (roundingRule === 'floor') newPrice = Math.floor(newPrice);
  // Sin regla de redondeo se conservan 2 decimales (la precisión de la columna)
  else newPrice = Math.round(newPrice * 100) / 100;

  return newPrice;
}

/** Valida el dto de ajuste masivo. Lanza AppError si algo es inválido. */
// deno-lint-ignore no-explicit-any
function validateAdjustmentDto(body: any): BulkPriceAdjustmentDto {
  if (!Array.isArray(body.productIds) || body.productIds.length === 0) {
    throw new AppError('Debe proporcionar al menos un ID de producto', 400);
  }
  if (!body.productIds.every((id: unknown) => Number.isInteger(id))) {
    throw new AppError('Los IDs de producto deben ser números enteros', 400);
  }
  if (!['fixed', 'percentage'].includes(body.adjustmentType)) {
    throw new AppError('Tipo de ajuste inválido. Use "fixed" o "percentage"', 400);
  }
  if (typeof body.adjustmentValue !== 'number' || Number.isNaN(body.adjustmentValue)) {
    throw new AppError('El valor de ajuste debe ser un número', 400);
  }
  return {
    productIds: body.productIds,
    adjustmentType: body.adjustmentType,
    adjustmentValue: body.adjustmentValue,
    roundingRule: typeof body.roundingRule === 'string' ? body.roundingRule : undefined,
  };
}

/**
 * Valida si un nuevo precio es seguro según las reglas de negocio.
 * Devuelve el mensaje de error o null si es válido.
 */
function validateNewPrice(adjustmentType: string, adjustmentValue: number, newPrice: number): string | null {
  const maxDiscount = getMaxDiscountLimit();
  if (newPrice <= 0) return 'El precio final no puede ser cero o negativo';
  if (adjustmentType === 'percentage' && adjustmentValue < -maxDiscount) {
    return `Descuento excesivo (máximo permitido: ${maxDiscount}%)`;
  }
  return null;
}

/** Trae los productos con su precio vigente. Con `lock` los bloquea para la transacción. */
async function loadProductsWithPrice(db: Db, productIds: number[], lock = false) {
  return await db`
    select p.id, p.name, cp.id as price_id, cp.amount as current_price, cp.currency
    from product p
    left join price cp on cp.product_id = p.id and cp.is_current
    where p.id in ${db(productIds)}
    order by p.id asc
    ${lock ? db`for update of p` : db``}
  `;
}

/** Genera una vista previa de los cambios de precio sin persistir nada. */
async function preview(ctx: RequestContext) {
  await requireAdmin(ctx.req);
  const dto = validateAdjustmentDto(ctx.body);
  const products = await loadProductsWithPrice(sql, dto.productIds);

  // deno-lint-ignore no-explicit-any
  const results = products.map((product: any) => {
    const currentPrice: number = product.currentPrice ?? 0;
    const newPrice = computeNewPrice(currentPrice, dto.adjustmentType, dto.adjustmentValue, dto.roundingRule);
    const error = validateNewPrice(dto.adjustmentType, dto.adjustmentValue, newPrice);

    return {
      productId: product.id,
      name: product.name,
      currentPrice,
      newPrice,
      diff: newPrice - currentPrice,
      isValid: !error,
      error,
    };
  });

  return ok('Vista previa generada', results);
}

/** Aplica los cambios masivos de precio y registra el batch + auditoría. */
async function apply(ctx: RequestContext) {
  const admin = await requireAdmin(ctx.req);
  const dto = validateAdjustmentDto(ctx.body);

  const result = await sql.begin(async (tx: Db) => {
    const products = await loadProductsWithPrice(tx, dto.productIds, true);
    if (products.length === 0) throw new AppError('No se encontraron productos para actualizar', 404);

    const [batch] = await tx`
      insert into price_change_batch ${tx({
        userId: admin.id,
        adjustmentType: dto.adjustmentType,
        adjustmentValue: dto.adjustmentValue,
        roundingRule: dto.roundingRule ?? null,
      })}
      returning id
    `;

    let updatedCount = 0;
    let errorCount = 0;
    const errors: { productId: number; name: string; error: string }[] = [];

    for (const product of products) {
      const currentPrice: number = product.currentPrice ?? 0;
      const newPrice = computeNewPrice(currentPrice, dto.adjustmentType, dto.adjustmentValue, dto.roundingRule);

      const priceError = validateNewPrice(dto.adjustmentType, dto.adjustmentValue, newPrice);
      if (priceError) {
        errorCount++;
        errors.push({ productId: product.id, name: product.name, error: priceError });
        continue;
      }

      await tx`update price set is_current = false where product_id = ${product.id} and is_current`;
      await tx`
        insert into price ${tx({
          amount: newPrice,
          currency: product.currency ?? 'ARS',
          productId: product.id,
          isCurrent: true,
          batchId: batch.id,
        })}
      `;
      updatedCount++;
    }

    await tx`
      insert into audit_log (user_id, action, target_type, target_id, details)
      values (
        ${admin.id},
        'BULK_PRICE_UPDATE',
        'Product',
        ${batch.id},
        ${tx.json({
          batchId: batch.id,
          adjustmentType: dto.adjustmentType,
          adjustmentValue: dto.adjustmentValue,
          productIds: dto.productIds,
          updatedCount,
          errorCount,
        })}::jsonb
      )
    `;

    return { batchId: batch.id as number, updatedCount, errorCount, errors };
  });

  return ok('Cambios masivos aplicados', result);
}

/** Revierte un lote de cambios masivos, restaurando el precio anterior de cada producto. */
async function rollback(ctx: RequestContext) {
  const admin = await requireAdmin(ctx.req);
  const batchId = intParam(ctx, 'batchId', 'ID de lote inválido');

  await sql.begin(async (tx: Db) => {
    const [batch] = await tx`select id, is_reverted from price_change_batch where id = ${batchId} for update`;
    if (!batch) throw new AppError('Lote no encontrado', 404);
    if (batch.isReverted) throw new AppError('Este lote ya ha sido revertido', 400);

    const prices = await tx`
      select id, product_id, valid_from, is_current from price where batch_id = ${batchId} order by product_id asc
    `;

    for (const price of prices) {
      // Si el precio del lote ya no es el vigente, alguien lo cambió después:
      // se respeta ese cambio posterior y no se toca el producto.
      if (!price.isCurrent) continue;

      await tx`update price set is_current = false where id = ${price.id}`;

      const [previousPrice] = await tx`
        select id from price
        where product_id = ${price.productId} and id <> ${price.id} and valid_from < ${price.validFrom}
        order by valid_from desc, id desc
        limit 1
      `;

      if (previousPrice) {
        await tx`update price set is_current = true where id = ${previousPrice.id}`;
      }
    }

    await tx`update price_change_batch set is_reverted = true where id = ${batchId}`;

    await tx`
      insert into audit_log (user_id, action, target_type, target_id)
      values (${admin.id}, 'BULK_PRICE_ROLLBACK', 'PriceChangeBatch', ${batchId})
    `;
  });

  return ok('Lote revertido correctamente');
}

/** Devuelve el historial de lotes de cambios masivos. */
async function getHistory(ctx: RequestContext) {
  await requireAdmin(ctx.req);

  const batches = await sql`select * from price_change_batch order by created_at desc`;
  if (batches.length === 0) return ok('Historial de cambios masivos', []);

  const userIds = [...new Set(batches.map((b) => b.userId as number))];
  const users = await sql`
    select id, name, last_name, username, email, role from "user" where id in ${sql(userIds)}
  `;
  const usersById = new Map(users.map((u) => [u.id as number, u]));

  return ok(
    'Historial de cambios masivos',
    batches.map(({ userId, ...batch }) => ({ ...batch, user: usersById.get(userId) ?? null })),
  );
}

serveRoutes('bulk-prices', [
  ['POST', '/preview', preview],
  ['POST', '/apply', apply],
  ['POST', '/rollback/:batchId', rollback],
  ['GET', '/history', getHistory],
]);
