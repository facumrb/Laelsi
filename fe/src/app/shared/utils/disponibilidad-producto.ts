import { ProductState } from '@models/product.model';

/**
 * Qué muestra la tienda y el carrito de un producto según su estado de publicación (ID 54 de
 * docs/requerimientos/discusiones.md). Son las mismas reglas que aplica el servidor en
 * supabase/functions/_shared/publicacion.ts: si se cambian acá, hay que cambiarlas allá.
 *
 * Es lógica pura (no toca la red ni la pantalla) para poder probarla sola.
 */

export const AVISO_PAUSADO = 'La publicación está en pausa hasta nuevo aviso.';
export const AVISO_INACTIVO = 'El negocio no está trabajando actualmente con este producto.';

export interface DisponibilidadEnCarrito {
  disponible: boolean;
  motivo: 'pausado' | 'inactivo' | null;
  mensaje: string | null;
}

/**
 * Qué muestra el carrito de un producto. Si todavía no se conoce su estado actual (el carrito guarda
 * una copia y la consulta al servidor está en camino) no se avisa nada.
 */
export function disponibilidadEnCarrito(estado: ProductState | null | undefined): DisponibilidadEnCarrito {
  if (estado === ProductState.Pausado) {
    return { disponible: false, motivo: 'pausado', mensaje: AVISO_PAUSADO };
  }
  if (estado === ProductState.Inactivo) {
    return { disponible: false, motivo: 'inactivo', mensaje: AVISO_INACTIVO };
  }
  return { disponible: true, motivo: null, mensaje: null };
}

/** Solo un producto Activo se puede comprar. */
export function esComprable(estado: ProductState): boolean {
  return estado === ProductState.Activo;
}

/** Los que se muestran en la tienda: la pausa mantiene visible la ficha. */
export function esVisibleEnTienda(estado: ProductState): boolean {
  return estado === ProductState.Activo || estado === ProductState.Pausado;
}

/** Texto prearmado para consultar por WhatsApp cuándo vuelve un producto pausado. */
export function mensajeDeConsultaPorWhatsApp(nombre: string): string {
  return `Hola, quería consultar cuándo vuelve «${nombre}».`;
}
