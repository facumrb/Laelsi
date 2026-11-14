import { IApiCategory } from '@models/category.model';
import { IProductSummary } from '@models/product.model';

export type CategoriaAplanada = IApiCategory & { depth: number };

/**
 * Pasa el árbol de categorías a una lista plana, con cada categoría seguida de sus hijas y su profundidad
 * (la raíz es 0). Incluye las categorías hasta la profundidad `hastaProfundidad`, inclusive.
 *
 * Lo usan los selectores del panel (categoría padre, categoría de un producto, filtro de productos). Cada
 * uno decide hasta dónde llegar: ver MAX_CATEGORY_DEPTH en @models/category.model.
 *
 * Una categoría se ubica por `parentId` o, si no lo trae, por `parent.id`.
 */
export function aplanarCategorias(
  categorias: IApiCategory[],
  hastaProfundidad: number,
): CategoriaAplanada[] {
  const lista: CategoriaAplanada[] = [];

  const recorrer = (madreId: number | null, profundidad: number) => {
    if (profundidad > hastaProfundidad) return;

    categorias
      .filter((c) => (c.parentId ?? c.parent?.id ?? null) === madreId)
      .sort((a, b) => a.order - b.order)
      .forEach((hija) => {
        lista.push({ ...hija, depth: profundidad });
        recorrer(hija.id, profundidad + 1);
      });
  };

  recorrer(null, 0);
  return lista;
}

// Un producto del subárbol de una categoría, con la categoría a la que pertenece realmente.
export type ProductoDelSubarbol = IProductSummary & {
  categoryId: number;
  categoryName: string;
};

/*
 Devuelve, para cada categoría, sus productos propios más los de todas sus descendientes (hijas, nietas...), sin importar el estado de cada una: el panel ve el árbol completo.
*/
export function productosDelSubarbol(
  categorias: IApiCategory[],
): Map<number, ProductoDelSubarbol[]> {
  const hijasPorMadre = new Map<number, IApiCategory[]>();
  for (const categoria of categorias) {
    const madreId = categoria.parentId ?? categoria.parent?.id ?? null;
    if (madreId === null) continue;
    hijasPorMadre.set(madreId, [
      ...(hijasPorMadre.get(madreId) ?? []),
      categoria,
    ]);
  }

  const propios = (categoria: IApiCategory): ProductoDelSubarbol[] =>
    (categoria.products ?? []).map((producto) => ({
      ...producto,
      categoryId: categoria.id,
      categoryName: categoria.name,
    }));

  const resultado = new Map<number, ProductoDelSubarbol[]>();
  for (const raiz of categorias) {
    // `visitadas` corta un ciclo si algún dato corrupto lo trajera; `vistos` evita repetir productos
    const visitadas = new Set<number>([raiz.id]);
    const vistos = new Set<number>();
    const productos: ProductoDelSubarbol[] = [];
    const pendientes: IApiCategory[] = [raiz];

    while (pendientes.length > 0) {
      const actual = pendientes.pop()!;
      for (const producto of propios(actual)) {
        if (vistos.has(producto.id)) continue;
        vistos.add(producto.id);
        productos.push(producto);
      }
      for (const hija of hijasPorMadre.get(actual.id) ?? []) {
        if (visitadas.has(hija.id)) continue;
        visitadas.add(hija.id);
        pendientes.push(hija);
      }
    }
    resultado.set(raiz.id, productos);
  }
  return resultado;
}
