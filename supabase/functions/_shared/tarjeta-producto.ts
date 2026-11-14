// ============================================================================
// Productos para las tarjetas de la tienda (armado puro)
// ============================================================================
// Las tarjetas de los listados públicos solo muestran una foto y no muestran la descripción (TEXT), así que esos listados no cargan ni una ni las otras. La forma es la misma que arma loadProducts (catalogo.ts):
// `photos` sigue siendo un arreglo, ahora de 0 o 1 elemento, la primera foto (la de menor orden).

/*
 Arma los productos de tarjeta en el orden de `ids` (los que no existen se omiten). `categoriaDe` resuelve la categoría (con sus padres) a partir del `categoryId` de la fila.
*/
export function armarTarjetasDeProducto(
  ids: number[],

  productos: any[],
  primerasFotos: Map<number, { id: number; fileName: string }>,

  precios: any[],
  categoriaDe: (categoryId: number) => any
): any[] {
  const porId = new Map<number, any>(productos.map((p) => [p.id, p]));

  const resultado: any[] = [];
  for (const id of ids) {
    const producto = porId.get(id);
    if (!producto) continue;

    const { categoryId, description: _descripcion, ...resto } = producto;
    const primeraFoto = primerasFotos.get(id);
    resultado.push({
      ...resto,
      category: categoriaDe(categoryId),
      photos: primeraFoto ? [primeraFoto] : [],
      prices: precios.filter((precio: any) => precio.productId === id)
    });
  }
  return resultado;
}
