// ============================================================================
// Portada de la tienda en una sola llamada (reglas puras)
// ============================================================================
// ID 70 de docs/requerimientos/discusiones.md (mejora 2 de rendimiento-investigacion-2026-11-09.md): la portada
// hacía 8 llamadas a la API en dos tandas (más vendidos, categorías y, recién después, los más vendidos de cada
// una de las 5 primeras categorías). GET /products/home devuelve todo junto. Estas reglas son las que ya aplicaba
// la portada en el navegador: las 5 primeras categorías raíz activas con productos, y solo se muestran las que
// tienen más vendidos.
//
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/
// ============================================================================
import assert from 'node:assert/strict';
import { groupByParent, hasActiveProductsInSubtree } from '../_shared/categorias-arbol.ts';
import {
  CANTIDAD_DE_CATEGORIAS_EN_PORTADA,
  PRODUCTOS_POR_CARRUSEL,
  armarPortada,
  categoriasDeLaPortada,
} from '../_shared/portada.ts';

type Cat = { id: number; state: 'Activo' | 'Inactivo'; parentId: number | null };
const cat = (id: number, parentId: number | null = null, state: 'Activo' | 'Inactivo' = 'Activo'): Cat => ({
  id,
  state,
  parentId,
});
const cuentas = (pares: [number, number][]) => new Map<number, number>(pares);

// ─── Árbol de categorías (categorias-arbol.ts) ──────────────────────────────────────────────────────

Deno.test('groupByParent: agrupa por padre y las raíces quedan bajo null, conservando el orden', () => {
  const grupos = groupByParent([cat(1), cat(2, 1), cat(3), cat(4, 1)]);
  assert.deepEqual(grupos.get(null)?.map((c) => c.id), [1, 3]);
  assert.deepEqual(grupos.get(1)?.map((c) => c.id), [2, 4]);
  assert.equal(grupos.get(3), undefined);
});

Deno.test('hasActiveProductsInSubtree: cuenta los productos propios', () => {
  const porPadre = groupByParent([cat(1), cat(2, 1)]);
  assert.equal(hasActiveProductsInSubtree(1, porPadre, cuentas([[1, 3]])), true);
});

Deno.test('hasActiveProductsInSubtree: cuenta los productos de cualquier descendiente', () => {
  const porPadre = groupByParent([cat(1), cat(2, 1), cat(3, 2)]);
  assert.equal(hasActiveProductsInSubtree(1, porPadre, cuentas([[3, 1]])), true);
});

Deno.test('hasActiveProductsInSubtree: sin productos en el subárbol es falso', () => {
  const porPadre = groupByParent([cat(1), cat(2, 1), cat(4)]);
  assert.equal(hasActiveProductsInSubtree(1, porPadre, cuentas([[4, 9]])), false);
  assert.equal(hasActiveProductsInSubtree(1, porPadre, cuentas([])), false);
});

// ─── Qué categorías van en la portada ──────────────────────────────────────────────────────────────────

Deno.test('portada: son las categorías raíz activas con productos, en el orden recibido', () => {
  const categorias = [cat(1), cat(2), cat(3)];
  const elegidas = categoriasDeLaPortada(categorias, cuentas([[1, 4], [2, 1], [3, 7]]));
  assert.deepEqual(elegidas.map((c) => c.id), [1, 2, 3]);
});

Deno.test('portada: una raíz sin productos (propios ni en su subárbol) queda afuera', () => {
  const elegidas = categoriasDeLaPortada([cat(1), cat(2), cat(3)], cuentas([[1, 4], [3, 2]]));
  assert.deepEqual(elegidas.map((c) => c.id), [1, 3]);
});

Deno.test('portada: una raíz inactiva queda afuera aunque tenga productos', () => {
  const elegidas = categoriasDeLaPortada([cat(1, null, 'Inactivo'), cat(2)], cuentas([[1, 9], [2, 1]]));
  assert.deepEqual(elegidas.map((c) => c.id), [2]);
});

Deno.test('portada: una raíz entra si sus productos están en una subcategoría', () => {
  const elegidas = categoriasDeLaPortada([cat(1), cat(2, 1), cat(5)], cuentas([[2, 3]]));
  assert.deepEqual(elegidas.map((c) => c.id), [1]);
});

Deno.test('portada: las subcategorías no se listan por su cuenta, solo las raíces', () => {
  const elegidas = categoriasDeLaPortada([cat(1), cat(2, 1)], cuentas([[1, 1], [2, 1]]));
  assert.deepEqual(elegidas.map((c) => c.id), [1]);
});

Deno.test('portada: no pasa del máximo (5 por defecto) y se queda con las primeras', () => {
  const siete = [1, 2, 3, 4, 5, 6, 7].map((id) => cat(id));
  const conProductos = cuentas(siete.map((c) => [c.id, 1] as [number, number]));
  assert.equal(CANTIDAD_DE_CATEGORIAS_EN_PORTADA, 5);
  assert.deepEqual(categoriasDeLaPortada(siete, conProductos).map((c) => c.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(categoriasDeLaPortada(siete, conProductos, 2).map((c) => c.id), [1, 2]);
});

Deno.test('portada: el máximo se cuenta sobre las que califican, no sobre las primeras de la lista', () => {
  const categorias = [cat(1), cat(2), cat(3), cat(4)];
  const elegidas = categoriasDeLaPortada(categorias, cuentas([[3, 1], [4, 1]]), 2);
  assert.deepEqual(elegidas.map((c) => c.id), [3, 4]);
});

// ─── Cómo se arma la respuesta ─────────────────────────────────────────────────────────────────────────

Deno.test('armarPortada: incluye los más vendidos y los carruseles con productos', () => {
  const portada = armarPortada(['a', 'b'], [{ category: cat(1), products: ['c'] }]);
  assert.deepEqual(portada.bestSellers, ['a', 'b']);
  assert.equal(portada.categories.length, 1);
  assert.deepEqual(portada.categories[0].products, ['c']);
});

Deno.test('armarPortada: descarta los carruseles vacíos y conserva el orden de los demás', () => {
  const portada = armarPortada(
    [],
    [
      { category: cat(1), products: ['x'] },
      { category: cat(2), products: [] },
      { category: cat(3), products: ['y', 'z'] },
    ],
  );
  assert.deepEqual(portada.categories.map((c) => c.category.id), [1, 3]);
});

Deno.test('armarPortada: sin nada que mostrar devuelve listas vacías, no un error', () => {
  assert.deepEqual(armarPortada([], []), { bestSellers: [], categories: [] });
});

Deno.test('cada carrusel muestra hasta 10 productos', () => {
  assert.equal(PRODUCTOS_POR_CARRUSEL, 10);
});
