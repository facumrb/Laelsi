// ============================================================================
// Portada de la tienda en una sola llamada (reglas puras)
// ============================================================================
// ID 70 de docs/requerimientos/discusiones.md (mejora 2 de docs/requerimientos/rendimiento-investigacion-2026-11-09.md).
// La portada hacía 8 llamadas en dos tandas: más vendidos, categorías activas y, recién cuando llegaban las
// categorías, los más vendidos de cada una de las 5 primeras. GET /products/home devuelve todo junto: una
// invocación en vez de ocho (cuida el cupo gratuito de Supabase) y sin segunda tanda de espera.
//
// Son las mismas reglas que aplicaba la portada en el navegador: las 5 primeras categorías raíz activas que
// tienen productos visibles, y solo se muestran las que tienen más vendidos.
//
// Este archivo no toca la base ni la red, para poder probarlo solo (ver _tests/portada_unit_test.ts).
// ============================================================================
import { groupByParent, hasActiveProductsInSubtree } from './categorias-arbol.ts';

/** Cuántas categorías con su carrusel se muestran en la portada. */
export const CANTIDAD_DE_CATEGORIAS_EN_PORTADA = 5;

/** Cuántos productos lleva cada carrusel (el general y el de cada categoría). */
export const PRODUCTOS_POR_CARRUSEL = 10;

/**
 * Las categorías de la portada: raíces activas con productos visibles en su subárbol, en el orden recibido
 * (el del panel), hasta `maximo`. `activeCounts` cuenta los productos visibles (Activo o Pausado) que tiene
 * directamente cada categoría.
 */
export function categoriasDeLaPortada<T extends { id: number; state: string; parentId: number | null }>(
  categorias: T[],
  activeCounts: Map<number, number>,
  maximo: number = CANTIDAD_DE_CATEGORIAS_EN_PORTADA,
): T[] {
  const porPadre = groupByParent(categorias);
  return (porPadre.get(null) ?? [])
    .filter((raiz) => raiz.state === 'Activo')
    .filter((raiz) => hasActiveProductsInSubtree(raiz.id, porPadre, activeCounts))
    .slice(0, maximo);
}

/** Arma la respuesta de la portada: los carruseles sin productos no se muestran. */
export function armarPortada<C, P>(
  bestSellers: P[],
  carruseles: { category: C; products: P[] }[],
): { bestSellers: P[]; categories: { category: C; products: P[] }[] } {
  return {
    bestSellers,
    categories: carruseles.filter((carrusel) => carrusel.products.length > 0),
  };
}
