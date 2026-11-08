import { IProductSummary } from './product.model';

export enum CategoryState {
  Activo = 'Activo',
  Inactivo = 'Inactivo',
}

/**
 * Profundidad del último nivel de subcategorías que se puede crear (la raíz es 0): 5 niveles en total.
 * Es un techo, no la profundidad aconsejada: las guías de usabilidad recomiendan que quien compra recorra
 * 3 o 4 niveles como máximo.
 *
 * Tiene que coincidir con PROFUNDIDAD_MAXIMA de supabase/functions/_shared/profundidad-categorias.ts: los
 * dos proyectos no comparten código y una prueba comprueba que el número sea el mismo.
 */
export const MAX_CATEGORY_DEPTH = 4;

export interface IApiCategory {
  id: number;
  name: string;
  description?: string | null;
  order: number;
  state: CategoryState;
  parentId?: number | null;
  parent?: IApiCategory | null;
  children?: IApiCategory[];
  depth?: number;
  products?: IProductSummary[]; // Solo en GET /categories (panel admin)
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// Para CREAR
export type ICreateCategory = Omit<
  IApiCategory,
  'id' | 'products' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'parent' | 'children' | 'depth' | 'order'
> & {
  parentId?: number | null;
  order?: number;
};

// Para EDITAR
export type IUpdateCategory = Partial<ICreateCategory>;
