import { IApiCategory } from '@models/category.model';

export type CategoriaAplanada = IApiCategory & { depth: number };

/**
 * Pasa el árbol de categorías a una lista plana, con cada categoría seguida de sus hijas y su profundidad
 * (la raíz es 0). Incluye las categorías hasta la profundidad `hastaProfundidad`, inclusive.
 *
 * Lo usan los selectores del panel (categoría padre, categoría de un producto, filtro de productos), que
 * antes armaban esta misma lista cada uno por su lado, cada uno con su propio tope de niveles. Cada uno
 * decide hasta dónde llegar: ver MAX_CATEGORY_DEPTH en @models/category.model.
 *
 * Una categoría se ubica por `parentId` o, si no lo trae, por `parent.id`.
 */
export function aplanarCategorias(categorias: IApiCategory[], hastaProfundidad: number): CategoriaAplanada[] {
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
