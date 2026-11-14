import { inject, Signal } from '@angular/core';
import {
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ApiCategoryService } from '../api-services/api-category.service';
import { ICreateCategory, IUpdateCategory } from '../../models/category.model';
import { injectInvalidateCatalog } from './catalog-cache';

/**
 * Query reactiva de TODAS las categorías en formato plano (Panel Admin).
 * Cada categoría trae su padre, sus hijas y sus productos asociados, que es lo
 * que necesitan los listados para armar la jerarquía y contar los productos.
 */
export function injectAllCategoriesQuery() {
  const apiCategoryService = inject(ApiCategoryService);

  return injectQuery(() => ({
    queryKey: ['categories', 'all'],
    queryFn: () => firstValueFrom(apiCategoryService.getAllCategories()),
    staleTime: 1000 * 60 * 2, // 2 minutos
  }));
}

/**
 * Query reactiva de las categorías activas (Tienda pública)
 */
export function injectActiveCategoriesQuery() {
  const apiCategoryService = inject(ApiCategoryService);

  return injectQuery(() => ({
    queryKey: ['categories', 'active'],
    queryFn: () => firstValueFrom(apiCategoryService.getActiveCategories()),
    staleTime: 1000 * 60 * 15, // 15 minutos
  }));
}

/**
 * Query reactiva del árbol de categorías (Navegación y reordenamiento).
 *
 * OJO: devuelve solo las categorías raíz con sus hijas anidadas en `children`
 * y NO incluye los productos. Para un listado plano con el contador de
 * productos hay que usar injectAllCategoriesQuery().
 */
export function injectCategoryTreeQuery(state?: string) {
  const apiCategoryService = inject(ApiCategoryService);

  return injectQuery(() => ({
    queryKey: ['categories', 'tree', state ?? 'all'],
    queryFn: () => firstValueFrom(apiCategoryService.getCategoryTree(state)),
    staleTime: 1000 * 60 * 10, // 10 minutos
  }));
}

/**
 * Query reactiva para el detalle de una categoría
 */
export function injectCategoryDetailQuery(idSignal: Signal<number>) {
  const apiCategoryService = inject(ApiCategoryService);

  return injectQuery(() => {
    const id = idSignal();
    return {
      queryKey: ['categories', 'detail', id],
      queryFn: () => firstValueFrom(apiCategoryService.getCategoryById(id, true)),
      enabled: id > 0,
      staleTime: 1000 * 60 * 15, // 15 minutos
    };
  });
}

/**
 * Mutación para crear una categoría
 */
export function injectAddCategoryMutation() {
  const apiCategoryService = inject(ApiCategoryService);
  const invalidateCatalog = injectInvalidateCatalog();

  return injectMutation(() => ({
    mutationFn: (newCategory: ICreateCategory) =>
      firstValueFrom(apiCategoryService.addCategory(newCategory)),
    onSuccess: () => {
      invalidateCatalog();
    },
  }));
}

/**
 * Mutación para actualizar una categoría
 */
export function injectUpdateCategoryMutation() {
  const apiCategoryService = inject(ApiCategoryService);
  const invalidateCatalog = injectInvalidateCatalog();

  return injectMutation(() => ({
    mutationFn: ({ id, category }: { id: number; category: IUpdateCategory }) =>
      firstValueFrom(apiCategoryService.updateCategory(id, category)),
    onSuccess: () => {
      invalidateCatalog();
    },
  }));
}

/**
 * Mutación para eliminar una categoría
 */
export function injectDeleteCategoryMutation() {
  const apiCategoryService = inject(ApiCategoryService);
  const invalidateCatalog = injectInvalidateCatalog();

  return injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(apiCategoryService.deleteCategory(id)),
    onSuccess: () => {
      invalidateCatalog();
    },
  }));
}
