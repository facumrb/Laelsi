// ============================================================================
// Estados de publicación de un producto: Activo, Pausado e Inactivo (reglas puras)
// ============================================================================
// Discusión del ID 54 (docs/requerimientos/discusiones.md). El stock es la disponibilidad FÍSICA; el
// estado es la disponibilidad COMERCIAL, y son independientes:
//
//   Activo    se ve en la tienda y se puede comprar.
//   Pausado   SE VE en la tienda como "no disponible por ahora" y no se puede comprar (el cliente
//             sabe que el negocio lo vende y puede consultar por WhatsApp). El stock no cambia.
//   Inactivo  NO aparece en la tienda.
//
// En el carrito, un producto pausado o inactivo se muestra con su aviso y no deja sumar unidades.
// El servidor ya rechaza al confirmar todo producto que no esté Activo (create_order).
//
// Este archivo no toca la base ni la red, para poder probarlo solo (ver _tests/publicacion_unit_test.ts).
// ============================================================================

export type EstadoProducto = 'Activo' | 'Inactivo' | 'Pausado';

export const ESTADOS_PRODUCTO: readonly EstadoProducto[] = ['Activo', 'Inactivo', 'Pausado'];

/** Los que se muestran en la tienda (la pausa mantiene la ficha visible). */
export const ESTADOS_VISIBLES_EN_TIENDA: readonly EstadoProducto[] = ['Activo', 'Pausado'];

export function esEstadoProducto(valor: unknown): valor is EstadoProducto {
  return typeof valor === 'string' && (ESTADOS_PRODUCTO as readonly string[]).includes(valor);
}

export function esVisibleEnTienda(estado: EstadoProducto): boolean {
  return (ESTADOS_VISIBLES_EN_TIENDA as readonly string[]).includes(estado);
}

/** Solo un producto Activo se puede comprar. */
export function esComprable(estado: EstadoProducto): boolean {
  return estado === 'Activo';
}

/**
 * Una categoría se desactiva sola cuando deja de tener productos VISIBLES (un producto pausado la
 * mantiene visible). Esto dice si un cambio de estado le quitó un producto visible.
 */
export function dejoDeSerVisible(antes: EstadoProducto, despues: EstadoProducto): boolean {
  return esVisibleEnTienda(antes) && !esVisibleEnTienda(despues);
}

/** Visible antes y después del cambio (por ejemplo, al mover un producto de categoría). */
export function siguioVisible(antes: EstadoProducto, despues: EstadoProducto): boolean {
  return esVisibleEnTienda(antes) && esVisibleEnTienda(despues);
}

export interface DisponibilidadEnCarrito {
  disponible: boolean;
  motivo: 'pausado' | 'inactivo' | null;
  mensaje: string | null;
}

/** Qué muestra el carrito de un producto según su estado. */
export function disponibilidadEnCarrito(estado: EstadoProducto): DisponibilidadEnCarrito {
  if (estado === 'Activo') return { disponible: true, motivo: null, mensaje: null };
  if (estado === 'Pausado') {
    return { disponible: false, motivo: 'pausado', mensaje: 'La publicación está en pausa hasta nuevo aviso.' };
  }
  return {
    disponible: false,
    motivo: 'inactivo',
    mensaje: 'El negocio no está trabajando actualmente con este producto.',
  };
}

// ─── Disponibilidad de varios productos a la vez ─────────────────────────────

/** Tope de ids por pedido a GET /products/availability (un carrito no llega a tantos). */
export const MAX_IDS_DISPONIBILIDAD = 50;

/**
 * Lee la lista de ids del parámetro `ids` ("1,2,3"). Sin ids devuelve una lista vacía. No repite ids
 * y conserva el orden. Un valor que no sea un entero positivo, o más ids que el tope, lanza un
 * RangeError: se rechaza en vez de ignorarse, para no devolver una respuesta que parezca completa.
 */
export function leerIdsDeProductos(
  valor: string | null | undefined,
  maximo: number = MAX_IDS_DISPONIBILIDAD,
): number[] {
  if (valor === null || valor === undefined || valor.trim() === '') return [];

  const ids: number[] = [];
  for (const parte of valor.split(',')) {
    const texto = parte.trim();
    if (!/^[1-9]\d*$/.test(texto)) {
      throw new RangeError(`El id de producto "${texto}" no es válido.`);
    }
    const id = Number(texto);
    if (!Number.isSafeInteger(id)) throw new RangeError(`El id de producto "${texto}" no es válido.`);
    if (!ids.includes(id)) ids.push(id);
  }

  if (ids.length > maximo) throw new RangeError(`Se pueden consultar hasta ${maximo} productos a la vez.`);
  return ids;
}

/**
 * Estado de cada id pedido. Un producto que ya no existe se informa como Inactivo: para el carrito
 * es lo mismo ("el negocio no trabaja con este producto") y no se revela cuál es cuál.
 */
export function estadosPorId(
  ids: number[],
  filas: { id: number; state: EstadoProducto }[],
): Record<number, EstadoProducto> {
  const porId = new Map(filas.map((fila) => [fila.id, fila.state]));
  const resultado: Record<number, EstadoProducto> = {};
  for (const id of ids) resultado[id] = porId.get(id) ?? 'Inactivo';
  return resultado;
}
