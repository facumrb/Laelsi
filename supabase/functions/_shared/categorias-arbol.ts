// ============================================================================
// Árbol de categorías: agrupar por padre y saber si un subárbol tiene productos (reglas puras)
// ============================================================================
// Estas dos funciones vivían en catalogo.ts, que importa la base de datos y por eso no se puede probar sola.
// Se movieron acá SIN cambiar su comportamiento (catalogo.ts las sigue exportando). Las usan las categorías, los
// productos y la portada (ver portada.ts). Pruebas en _tests/portada_unit_test.ts.
// ============================================================================

/** Agrupa las categorías por su padre (la clave null agrupa a las raíces) y conserva el orden recibido. */
export function groupByParent<T extends { parentId: number | null }>(categories: T[]): Map<number | null, T[]> {
  const groups = new Map<number | null, T[]>();
  for (const category of categories) {
    const siblings = groups.get(category.parentId) ?? [];
    siblings.push(category);
    groups.set(category.parentId, siblings);
  }
  return groups;
}

/** Verifica si una categoría (o alguna de su subárbol) tiene al menos un producto visible. */
export function hasActiveProductsInSubtree<T extends { id: number }>(
  categoryId: number,
  byParent: Map<number | null, T[]>,
  activeCounts: Map<number, number>,
): boolean {
  if ((activeCounts.get(categoryId) ?? 0) > 0) return true;
  return (byParent.get(categoryId) ?? []).some((child) =>
    hasActiveProductsInSubtree(child.id, byParent, activeCounts),
  );
}
