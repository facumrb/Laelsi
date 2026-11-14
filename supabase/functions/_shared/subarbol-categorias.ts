// ============================================================================
// Subárbol de una categoría (lógica pura, sin base de datos)
// ============================================================================
// Una categoría madre muestra los productos de ella y de todas sus descendientes. El cálculo se
// hace AL LEER, a partir de las categorías que la función ya carga completas (son decenas de
// filas): no escribe nada derivado en la base, así que no deja datos por migrar.
//
// PROVISIONAL-2026-11-08 (subárbol de categorías): la regla definitiva ("categoría principal" + colecciones, etapa E5d de
// docs/hoja-de-ruta-etapas-2026-11-07.md) la decide esa etapa. Todo el sistema pasa por esta
// función, así que reemplazarla es cambiar un solo lugar.
// ============================================================================

/** Lo mínimo que se necesita de una categoría (una `CategoryRow` completa también sirve). */
export interface NodoCategoria {
  id: number;
  parentId: number | null;
  state: 'Activo' | 'Inactivo';
}

export interface OpcionesSubarbol {
  /**
   * Solo se baja por categorías activas (incluida la raíz). Es lo que ve el cliente: coincide con
   * el árbol de navegación, donde una rama cuya madre está inactiva no se alcanza. El panel del
   * administrador ve todo y no la usa.
   */
  soloActivas?: boolean;
}

/**
 * Devuelve el id de la categoría y el de todas sus descendientes (hijas, nietas...).
 *
 * El id pedido va siempre en el resultado, aunque no exista en `categorias`: así el filtro
 * `category_id in (...)` nunca queda vacío y, para un id inexistente, no encuentra productos.
 * El orden del resultado no está garantizado.
 */
export function idsDelSubarbol(
  raizId: number,
  categorias: readonly NodoCategoria[],
  { soloActivas = false }: OpcionesSubarbol = {},
): number[] {
  const hijasPorMadre = new Map<number, NodoCategoria[]>();
  for (const categoria of categorias) {
    if (categoria.parentId === null) continue;
    const hijas = hijasPorMadre.get(categoria.parentId) ?? [];
    hijas.push(categoria);
    hijasPorMadre.set(categoria.parentId, hijas);
  }

  const raiz = categorias.find((c) => c.id === raizId);
  if (soloActivas && raiz?.state !== 'Activo') return [raizId];

  // `visitadas` evita repetir ids y cortaría un ciclo si algún dato corrupto lo trajera
  const visitadas = new Set<number>([raizId]);
  const pendientes: number[] = [raizId];
  while (pendientes.length > 0) {
    const actual = pendientes.pop() as number;
    for (const hija of hijasPorMadre.get(actual) ?? []) {
      if (visitadas.has(hija.id)) continue;
      if (soloActivas && hija.state !== 'Activo') continue;
      visitadas.add(hija.id);
      pendientes.push(hija.id);
    }
  }
  return [...visitadas];
}

/** Una categoría con sus hijas anidadas, tal como la devuelven los árboles de la tienda y del panel. */
export type NodoDeArbol<T extends NodoCategoria> = T & { children: NodoDeArbol<T>[] };

/**
 * Arma el nodo de una categoría con sus hijas anidadas hasta `limite` niveles por debajo de ella.
 * Con `soloActivas` se saltea toda rama que cuelgue de una categoría inactiva.
 *
 * El límite que se le pasa a la tienda tiene que ser PROFUNDIDAD_MAXIMA (profundidad-categorias.ts): un
 * número menor corta el árbol y las categorías más profundas dejan de aparecer en el menú.
 */
export function armarNodoDeArbol<T extends NodoCategoria>(
  categoria: T,
  hijasPorMadre: Map<number | null, T[]>,
  limite: number,
  soloActivas: boolean,
): NodoDeArbol<T> {
  if (limite <= 0) return { ...categoria, children: [] };

  const children = (hijasPorMadre.get(categoria.id) ?? [])
    .filter((hija) => !soloActivas || hija.state === 'Activo')
    .map((hija) => armarNodoDeArbol(hija, hijasPorMadre, limite - 1, soloActivas));

  return { ...categoria, children };
}
