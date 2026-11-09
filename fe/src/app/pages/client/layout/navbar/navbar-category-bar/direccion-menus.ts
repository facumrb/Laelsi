import { IApiCategory } from '@models/category.model';

export type DireccionMenus = 'derecha' | 'izquierda';

// Medidas de los menús, las mismas de fe/src/styles.css: el desplegable (.navbar-dropdown) mide 200 px y cada menú
// lateral (.navbar-subdropdown) mide 176 px más 8 px de separación. Si se cambian allá, hay que cambiarlas acá.
const ANCHO_DESPLEGABLE = 200;
const ANCHO_MENU_LATERAL = 176;
const SEPARACION_MENU_LATERAL = 8;
const MARGEN_DE_PANTALLA = 8;

/**
 * Cuántos menús laterales necesita abrir una categoría, contando por su rama más profunda. El primer nivel de
 * hijas va en el desplegable de la categoría; cada nivel más abajo necesita un menú lateral.
 */
export function menusLateralesDeLaRama(categoria: IApiCategory): number {
  const niveles = (c: IApiCategory): number => 1 + Math.max(0, ...(c.children ?? []).map(niveles));
  return Math.max(0, niveles(categoria) - 2);
}

/**
 * Hacia qué lado abrir los menús laterales de una categoría. Van a la derecha, salvo que a la derecha no entren
 * todos y a la izquierda sí: ahí van a la izquierda, porque lo que queda fuera de la pantalla no se puede alcanzar.
 * Si no entran de ningún lado, se usa el lado con más lugar (se corta lo menos posible).
 */
export function direccionDeLosMenus(medidas: {
  /** Distancia en px desde el borde izquierdo de la pantalla hasta el desplegable de la categoría. */
  izquierdaDelDesplegable: number;
  anchoDePantalla: number;
  menusLaterales: number;
}): DireccionMenus {
  const { izquierdaDelDesplegable, anchoDePantalla, menusLaterales } = medidas;
  if (menusLaterales === 0) return 'derecha';

  const necesario = menusLaterales * (ANCHO_MENU_LATERAL + SEPARACION_MENU_LATERAL);
  const lugarDerecha = anchoDePantalla - MARGEN_DE_PANTALLA - (izquierdaDelDesplegable + ANCHO_DESPLEGABLE);
  const lugarIzquierda = izquierdaDelDesplegable - MARGEN_DE_PANTALLA;

  if (necesario <= lugarDerecha) return 'derecha';
  if (necesario <= lugarIzquierda) return 'izquierda';
  return lugarIzquierda > lugarDerecha ? 'izquierda' : 'derecha';
}
