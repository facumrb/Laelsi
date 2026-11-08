// ============================================================================
// Pruebas del cálculo del subárbol de una categoría
// ============================================================================
// Contexto: los productos se cargan en categorías hoja, pero al abrir una categoría madre el
// listado filtraba por igualdad exacta y salía vacío. La regla nueva (PROVISIONAL hasta que
// se ejecute la etapa E5d, "categoría principal"): una categoría muestra los productos de
// ella y de todos sus descendientes. Se calcula AL LEER, sin escribir nada derivado en la base,
// así que no queda ningún dato por migrar cuando llegue la solución definitiva.
//
// Cada comportamiento tiene un caso feliz y otros que ejercitan un camino distinto
// (triangulación): un cálculo que siempre devuelve lo mismo no protege nada.
//
// Se ejecuta con: deno test supabase/functions/_tests/subarbol_categorias_unit_test.ts
// ============================================================================
import assert from 'node:assert/strict';
import { idsDelSubarbol, type NodoCategoria } from '../_shared/subarbol-categorias.ts';

// Árbol de ejemplo (id · nombre · estado):
//
//   1 Librería ···················· Activo
//   ├─ 2 Cuadernos ················ Activo
//   │  ├─ 4 Tapa dura ············· Activo
//   │  └─ 5 Tapa blanda ··········· Inactivo
//   └─ 3 Escritura ················ Activo
//   6 Juguetería ·················· Activo
//   └─ 7 Bloques ·················· Inactivo
//      └─ 8 Madera ················ Activo   (activa, pero cuelga de una inactiva)
//   9 Computación ················· Inactivo
//   └─ 10 Mouses ·················· Activo
const ARBOL: readonly NodoCategoria[] = [
  { id: 1, parentId: null, state: 'Activo' },
  { id: 2, parentId: 1, state: 'Activo' },
  { id: 3, parentId: 1, state: 'Activo' },
  { id: 4, parentId: 2, state: 'Activo' },
  { id: 5, parentId: 2, state: 'Inactivo' },
  { id: 6, parentId: null, state: 'Activo' },
  { id: 7, parentId: 6, state: 'Inactivo' },
  { id: 8, parentId: 7, state: 'Activo' },
  { id: 9, parentId: null, state: 'Inactivo' },
  { id: 10, parentId: 9, state: 'Activo' },
];

/** El orden del resultado no importa: se compara ordenado. */
const ordenados = (ids: number[]) => [...ids].sort((a, b) => a - b);

// ─── Qué categorías entran (todas, sin mirar el estado: lo usa el panel del administrador) ───

Deno.test('una hoja devuelve solo su propio id', () => {
  assert.deepEqual(idsDelSubarbol(4, ARBOL), [4]);
});

Deno.test('una madre de un nivel devuelve su id y el de sus hijas', () => {
  assert.deepEqual(ordenados(idsDelSubarbol(2, ARBOL)), [2, 4, 5]);
});

Deno.test('una raíz recorre todos los niveles hacia abajo', () => {
  assert.deepEqual(ordenados(idsDelSubarbol(1, ARBOL)), [1, 2, 3, 4, 5]);
});

Deno.test('no arrastra categorías de otras ramas', () => {
  const ids = idsDelSubarbol(6, ARBOL);
  assert.deepEqual(ordenados(ids), [6, 7, 8]);
  assert.equal(ids.includes(1), false);
});

Deno.test('un id que no existe devuelve solo ese id: la consulta no encuentra nada, igual que hoy', () => {
  assert.deepEqual(idsDelSubarbol(999, ARBOL), [999]);
});

// ─── Lo que ve el cliente (soloActivas): solo se baja por categorías activas ─────

Deno.test('soloActivas deja afuera una hija inactiva', () => {
  assert.deepEqual(ordenados(idsDelSubarbol(1, ARBOL, { soloActivas: true })), [1, 2, 3, 4]);
});

Deno.test('soloActivas no baja por una inactiva: sus descendientes activos quedan afuera', () => {
  // La 8 está activa, pero la 7 (su madre) está inactiva: el cliente no llega a ella por la navegación.
  assert.deepEqual(idsDelSubarbol(6, ARBOL, { soloActivas: true }), [6]);
  // Contraste: sin la opción, el administrador sí la ve.
  assert.deepEqual(ordenados(idsDelSubarbol(6, ARBOL)), [6, 7, 8]);
});

Deno.test('soloActivas con la raíz inactiva no baja a ningún lado', () => {
  assert.deepEqual(idsDelSubarbol(9, ARBOL, { soloActivas: true }), [9]);
  assert.deepEqual(ordenados(idsDelSubarbol(9, ARBOL)), [9, 10]);
});

Deno.test('soloActivas en falso equivale a no pasar la opción', () => {
  assert.deepEqual(
    ordenados(idsDelSubarbol(1, ARBOL, { soloActivas: false })),
    ordenados(idsDelSubarbol(1, ARBOL)),
  );
});

// ─── Robustez ────────────────────────────────────────────────────────────────

Deno.test('un ciclo en los datos no cuelga el cálculo ni repite ids', () => {
  const conCiclo: readonly NodoCategoria[] = [
    { id: 1, parentId: 2, state: 'Activo' },
    { id: 2, parentId: 1, state: 'Activo' },
  ];
  assert.deepEqual(ordenados(idsDelSubarbol(1, conCiclo)), [1, 2]);
});

Deno.test('el resultado no repite ids', () => {
  const ids = idsDelSubarbol(1, ARBOL);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 5);
});
