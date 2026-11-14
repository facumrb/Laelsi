// ============================================================================
// Carga liviana de productos para las tarjetas de la tienda (armado puro)
// ============================================================================
// Los listados públicos devuelven por producto solo lo que muestra la tarjeta: sin descripción y con la primera
// foto. El resto de la forma de la respuesta es la misma que arma loadProducts (catalogo.ts).
//
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/
// ============================================================================
import assert from 'node:assert/strict';
import { armarTarjetasDeProducto } from '../_shared/tarjeta-producto.ts';

// deno-lint-ignore no-explicit-any
const fila = (id: number, extra: Record<string, any> = {}): Record<string, any> => ({
  id,
  name: `Producto ${id}`,
  description: `Descripción larga del producto ${id}`,
  brand: 'Marca',
  totalSold: 3,
  state: 'Activo',
  stock: 7,
  categoryId: 10,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
  deletedAt: null,
  ...extra,
});

const categoriaDe = (categoryId: number) => ({ id: categoryId, name: 'Cat', parent: null });
const precio = (id: number, productId: number) => ({ id, amount: 100, currency: 'ARS', isCurrent: true, productId });

Deno.test('la tarjeta no incluye la descripción', () => {
  const [tarjeta] = armarTarjetasDeProducto([1], [fila(1)], new Map(), [], categoriaDe);
  assert.equal('description' in tarjeta, false);
});

Deno.test('la tarjeta lleva solo la primera foto, como arreglo de un elemento', () => {
  const primeras = new Map([[1, { id: 5, fileName: 'a.webp' }]]);
  const [tarjeta] = armarTarjetasDeProducto([1], [fila(1)], primeras, [], categoriaDe);
  assert.deepEqual(tarjeta.photos, [{ id: 5, fileName: 'a.webp' }]);
});

Deno.test('un producto sin fotos da photos vacío', () => {
  const [tarjeta] = armarTarjetasDeProducto([1], [fila(1)], new Map(), [], categoriaDe);
  assert.deepEqual(tarjeta.photos, []);
});

Deno.test('el resto de los campos coincide con el del camino completo', () => {
  const producto = fila(1);
  const precios = [precio(9, 1), precio(8, 2)];
  const [tarjeta] = armarTarjetasDeProducto([1], [producto], new Map(), precios, categoriaDe);

  const { categoryId, description: _descripcion, ...resto } = producto;
  assert.deepEqual(tarjeta, {
    ...resto,
    category: categoriaDe(categoryId),
    photos: [],
    prices: [precio(9, 1)],
  });
});

Deno.test('conserva el orden de los ids, reparte fotos y precios por producto y omite los inexistentes', () => {
  const primeras = new Map([
    [2, { id: 20, fileName: 'dos.webp' }],
    [3, { id: 30, fileName: 'tres.webp' }],
  ]);
  const tarjetas = armarTarjetasDeProducto(
    [3, 99, 1, 2],
    [fila(1), fila(2), fila(3)],
    primeras,
    [precio(1, 1), precio(2, 2), precio(3, 3)],
    categoriaDe,
  );
  assert.deepEqual(tarjetas.map((t) => t.id), [3, 1, 2]);
  assert.deepEqual(tarjetas.map((t) => t.photos.length), [1, 0, 1]);
  assert.deepEqual(tarjetas.map((t) => t.prices.map((p: { id: number }) => p.id)), [[3], [1], [2]]);
});

Deno.test('un producto con categoría inexistente da category null, igual que el camino completo', () => {
  const [tarjeta] = armarTarjetasDeProducto([1], [fila(1)], new Map(), [], () => null);
  assert.equal(tarjeta.category, null);
});
