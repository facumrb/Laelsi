// ============================================================================
// Estados de publicación de un producto: Activo, Pausado e Inactivo (reglas puras)
// ============================================================================
// Discusión del ID 54 (docs/requerimientos/discusiones.md):
//   Activo   se ve en la tienda y se puede comprar.
//   Pausado  SE VE en la tienda como "no disponible por ahora"; no se puede comprar. El stock no cambia.
//   Inactivo NO aparece en la tienda.
// En el carrito, un producto pausado o inactivo se muestra con su aviso y no se puede sumar.
//
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/
// ============================================================================
import assert from 'node:assert/strict';
import {
  ESTADOS_PRODUCTO,
  ESTADOS_VISIBLES_EN_TIENDA,
  dejoDeSerVisible,
  disponibilidadEnCarrito,
  esComprable,
  esEstadoProducto,
  esVisibleEnTienda,
  estadosPorId,
  leerIdsDeProductos,
  MAX_IDS_DISPONIBILIDAD,
  siguioVisible,
} from '../_shared/publicacion.ts';

Deno.test('los estados de un producto son Activo, Inactivo y Pausado', () => {
  assert.deepEqual([...ESTADOS_PRODUCTO].sort(), ['Activo', 'Inactivo', 'Pausado']);
});

Deno.test('esEstadoProducto acepta los tres estados y rechaza el resto', () => {
  for (const estado of ['Activo', 'Inactivo', 'Pausado']) assert.equal(esEstadoProducto(estado), true);
  for (const invalido of ['pausado', 'Borrado', '', undefined, null, 3]) {
    assert.equal(esEstadoProducto(invalido), false, `no debería aceptar ${String(invalido)}`);
  }
});

Deno.test('se ve en la tienda un producto Activo o Pausado, pero no uno Inactivo', () => {
  assert.equal(esVisibleEnTienda('Activo'), true);
  assert.equal(esVisibleEnTienda('Pausado'), true);
  assert.equal(esVisibleEnTienda('Inactivo'), false);
  assert.deepEqual([...ESTADOS_VISIBLES_EN_TIENDA].sort(), ['Activo', 'Pausado']);
});

Deno.test('solo se puede comprar un producto Activo', () => {
  assert.equal(esComprable('Activo'), true);
  assert.equal(esComprable('Pausado'), false);
  assert.equal(esComprable('Inactivo'), false);
});

// ─── Cambios de estado y categorías ──────────────────────────────────────────
// Una categoría solo se desactiva sola cuando deja de tener productos VISIBLES: un producto
// pausado la mantiene visible.

Deno.test('dejoDeSerVisible: solo cuando pasa de visible a Inactivo', () => {
  assert.equal(dejoDeSerVisible('Activo', 'Inactivo'), true);
  assert.equal(dejoDeSerVisible('Pausado', 'Inactivo'), true);
  assert.equal(dejoDeSerVisible('Activo', 'Pausado'), false);
  assert.equal(dejoDeSerVisible('Pausado', 'Activo'), false);
  assert.equal(dejoDeSerVisible('Inactivo', 'Inactivo'), false);
  assert.equal(dejoDeSerVisible('Inactivo', 'Activo'), false);
});

Deno.test('siguioVisible: visible antes y después (por ejemplo al cambiar de categoría)', () => {
  assert.equal(siguioVisible('Activo', 'Activo'), true);
  assert.equal(siguioVisible('Activo', 'Pausado'), true);
  assert.equal(siguioVisible('Pausado', 'Activo'), true);
  assert.equal(siguioVisible('Activo', 'Inactivo'), false);
  assert.equal(siguioVisible('Inactivo', 'Activo'), false);
});

// ─── Carrito ─────────────────────────────────────────────────────────────────

Deno.test('carrito: un producto Activo está disponible y no lleva aviso', () => {
  assert.deepEqual(disponibilidadEnCarrito('Activo'), { disponible: true, motivo: null, mensaje: null });
});

Deno.test('carrito: un producto Pausado avisa que la publicación está en pausa', () => {
  const d = disponibilidadEnCarrito('Pausado');
  assert.equal(d.disponible, false);
  assert.equal(d.motivo, 'pausado');
  assert.match(d.mensaje ?? '', /pausa/i);
});

Deno.test('carrito: un producto Inactivo avisa que el negocio ya no trabaja con él', () => {
  const d = disponibilidadEnCarrito('Inactivo');
  assert.equal(d.disponible, false);
  assert.equal(d.motivo, 'inactivo');
  assert.match(d.mensaje ?? '', /no está trabajando/i);
});

Deno.test('carrito: los avisos de pausado e inactivo son distintos', () => {
  assert.notEqual(disponibilidadEnCarrito('Pausado').mensaje, disponibilidadEnCarrito('Inactivo').mensaje);
});

// ─── Disponibilidad de varios productos a la vez (GET /products/availability?ids=1,2,3) ──────────────
// El carrito guarda una COPIA del producto, así que su estado puede estar vencido. Para avisar sin pedir
// una ficha entera por cada producto (ni provocar un 404 por cada Inactivo) pregunta por todos juntos.

Deno.test('leerIdsDeProductos: lista de ids separados por comas', () => {
  assert.deepEqual(leerIdsDeProductos('1,2,3'), [1, 2, 3]);
  assert.deepEqual(leerIdsDeProductos(' 4 , 5 '), [4, 5]);
});

Deno.test('leerIdsDeProductos: no repite ids y conserva el orden en que llegaron', () => {
  assert.deepEqual(leerIdsDeProductos('3,1,3,2,1'), [3, 1, 2]);
});

Deno.test('leerIdsDeProductos: sin ids devuelve una lista vacía (no es un error)', () => {
  assert.deepEqual(leerIdsDeProductos(null), []);
  assert.deepEqual(leerIdsDeProductos(undefined), []);
  assert.deepEqual(leerIdsDeProductos(''), []);
  assert.deepEqual(leerIdsDeProductos('  '), []);
});

Deno.test('leerIdsDeProductos: un id que no es un entero positivo se rechaza, no se ignora', () => {
  for (const invalido of ['a', '1,b', '1.5', '-2', '0', '1,,2', '1; drop table product']) {
    assert.throws(() => leerIdsDeProductos(invalido), RangeError, `debería rechazar "${invalido}"`);
  }
});

Deno.test('leerIdsDeProductos: tiene un tope de ids por pedido', () => {
  const justo = Array.from({ length: MAX_IDS_DISPONIBILIDAD }, (_, i) => i + 1).join(',');
  assert.equal(leerIdsDeProductos(justo).length, MAX_IDS_DISPONIBILIDAD);
  assert.throws(() => leerIdsDeProductos(`${justo},${MAX_IDS_DISPONIBILIDAD + 1}`), RangeError);
});

Deno.test('estadosPorId: devuelve el estado de cada producto que existe', () => {
  const filas = [
    { id: 1, state: 'Activo' as const },
    { id: 2, state: 'Pausado' as const },
  ];
  assert.deepEqual(estadosPorId([1, 2], filas), { 1: 'Activo', 2: 'Pausado' });
});

Deno.test('estadosPorId: un producto que ya no existe se informa como Inactivo (no se revela la diferencia)', () => {
  const filas = [{ id: 1, state: 'Activo' as const }];
  assert.deepEqual(estadosPorId([1, 99], filas), { 1: 'Activo', 99: 'Inactivo' });
});

Deno.test('estadosPorId: solo informa los ids pedidos, aunque la consulta devuelva de más', () => {
  const filas = [
    { id: 1, state: 'Activo' as const },
    { id: 2, state: 'Pausado' as const },
  ];
  assert.deepEqual(estadosPorId([2], filas), { 2: 'Pausado' });
});
