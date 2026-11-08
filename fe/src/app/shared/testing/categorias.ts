// Datos de prueba de categorías, para los specs de los menús y selectores que dependen de la profundidad.
import { CategoryState, IApiCategory } from '@models/category.model';

/** Una categoría mínima. `order` decide el lugar entre hermanas. */
export function categoria(id: number, name: string, parentId: number | null = null, order = 1): IApiCategory {
  return { id, name, order, state: CategoryState.Activo, parentId, createdAt: '', updatedAt: '' };
}

/** Los cinco niveles de la cadena de prueba, de la raíz hacia abajo. El id de cada una es su posición (1 a 5). */
export const NOMBRES_DE_LA_CADENA = ['Tecnología', 'Computación', 'Periféricos', 'Mouses', 'Inalámbricos'] as const;

/** La cadena en una lista plana, como la devuelve la lista de categorías (cada una trae su `parentId`). */
export function cadenaPlana(): IApiCategory[] {
  return NOMBRES_DE_LA_CADENA.map((nombre, i) => ({
    ...categoria(i + 1, nombre, i === 0 ? null : i),
    depth: i,
  }));
}

/** La misma cadena anidada en `children`, como la devuelve el árbol de la API. Devuelve la raíz. */
export function cadenaAnidada(): IApiCategory {
  const plana = cadenaPlana();
  for (let i = plana.length - 2; i >= 0; i--) plana[i].children = [plana[i + 1]];
  return plana[0];
}
