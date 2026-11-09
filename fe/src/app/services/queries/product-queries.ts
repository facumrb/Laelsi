import { inject, Signal } from '@angular/core';
import {
  injectMutation,
  injectQuery,
  keepPreviousData,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ApiProductService } from '../api-services/api-product.service';
import { ICreateProduct, IUpdateProduct } from '../../models/product.model';
import { injectInvalidateCatalog } from './catalog-cache';

export interface IProductQueryFilters {
  query?: string;
  state?: string;
  categoryId?: number;
  stockFilter?: string;
  brand?: string;
  priceOrder?: string;
  popularityOrder?: string;
  page?: number;
  limit?: number;
}

/**
 * Query reactiva de productos activos (Tienda pública)
 */
export function injectActiveProductsQuery(
  filtersSignal: Signal<IProductQueryFilters>,
  options?: { enabled?: Signal<boolean> | boolean }
) {
  const apiProductService = inject(ApiProductService);

  return injectQuery(() => {
    const filters = filtersSignal();
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 16;

    return {
      queryKey: ['products', 'active', filters],
      queryFn: () => {
        if (filters.query) {
          return firstValueFrom(
            apiProductService.searchProducts(filters.query, page, limit, {
              brand: filters.brand,
              priceOrder: filters.priceOrder,
              popularityOrder: filters.popularityOrder,
            })
          );
        }
        if (filters.categoryId && filters.categoryId !== 0) {
          return firstValueFrom(
            apiProductService.getActiveProductsByCategory(
              filters.categoryId,
              page,
              limit,
              {
                brand: filters.brand,
                priceOrder: filters.priceOrder,
                popularityOrder: filters.popularityOrder,
              }
            )
          );
        }
        return firstValueFrom(apiProductService.getActiveProducts(page, limit));
      },
      staleTime: 1000 * 60 * 3, // 3 minutos
      // Mientras llega la página (o el filtro) nuevo se siguen mostrando los datos
      // anteriores. Sin esto la grilla queda vacía un instante en cada cambio de
      // página y la transición se ve brusca.
      placeholderData: keepPreviousData,
      enabled: options?.enabled !== undefined
        ? (typeof options.enabled === 'function' ? options.enabled() : options.enabled)
        : true,
    };
  });
}

/**
 * Query reactiva de todos los productos (Panel Admin)
 */
export function injectAllProductsQuery(
  filtersSignal: Signal<IProductQueryFilters>
) {
  const apiProductService = inject(ApiProductService);

  return injectQuery(() => {
    const filters = filtersSignal();
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 16;

    return {
      queryKey: ['products', 'all', filters],
      queryFn: () =>
        firstValueFrom(
          apiProductService.getAllProducts(page, limit, {
            query: filters.query,
            state: filters.state,
            categoryId: filters.categoryId,
            stockFilter: filters.stockFilter,
          })
        ),
      staleTime: 1000 * 60 * 2, // 2 minutos
      // Mantiene la tabla con los datos anteriores hasta que llega la página nueva
      placeholderData: keepPreviousData,
    };
  });
}

/**
 * Query reactiva para el detalle de un producto (Página de producto).
 * Trae el producto aunque esté inactivo: la página muestra el aviso de "no disponible".
 */
export function injectProductDetailQuery(idSignal: Signal<number>) {
  const apiProductService = inject(ApiProductService);

  return injectQuery(() => {
    const id = idSignal();
    return {
      queryKey: ['products', 'detail', id],
      queryFn: () => firstValueFrom(apiProductService.getProductById(id)),
      enabled: id > 0,
      staleTime: 1000 * 60 * 5, // 5 minutos
    };
  });
}

/**
 * Mutación para crear un producto
 */
export function injectAddProductMutation() {
  const apiProductService = inject(ApiProductService);
  const invalidateCatalog = injectInvalidateCatalog();

  return injectMutation(() => ({
    mutationFn: (newProduct: ICreateProduct) =>
      firstValueFrom(apiProductService.addProduct(newProduct)),
    onSuccess: () => {
      invalidateCatalog();
    },
  }));
}

/**
 * Mutación para actualizar un producto existente
 */
export function injectUpdateProductMutation() {
  const apiProductService = inject(ApiProductService);
  const invalidateCatalog = injectInvalidateCatalog();

  return injectMutation(() => ({
    mutationFn: ({ id, product }: { id: number; product: IUpdateProduct }) =>
      firstValueFrom(apiProductService.updateProduct(id, product)),
    onSuccess: () => {
      invalidateCatalog();
    },
  }));
}

/**
 * Mutación para eliminar un producto
 */
export function injectDeleteProductMutation() {
  const apiProductService = inject(ApiProductService);
  const invalidateCatalog = injectInvalidateCatalog();

  return injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(apiProductService.deleteProduct(id)),
    onSuccess: () => {
      invalidateCatalog();
    },
  }));
}

/**
 * Mutación para el cambio masivo de precios
 */
export function injectBulkPriceMutation() {
  const apiProductService = inject(ApiProductService);
  const invalidateCatalog = injectInvalidateCatalog();

  return injectMutation(() => ({
    mutationFn: ({
      productIds,
      adjustmentType,
      adjustmentValue,
      roundingRule,
    }: {
      productIds: number[];
      adjustmentType: string;
      adjustmentValue: number;
      roundingRule?: string;
    }) =>
      firstValueFrom(
        apiProductService.applyBulkPriceChange(
          productIds,
          adjustmentType,
          adjustmentValue,
          roundingRule
        )
      ),
    onSuccess: () => {
      invalidateCatalog();
    },
  }));
}

/**
 * Query de la portada completa (Página principal): los más vendidos y el carrusel de cada una de las primeras
 * categorías, con UNA sola llamada. Antes la portada hacía 8 llamadas en dos tandas (ID 70).
 */
export function injectHomeQuery() {
  const apiProductService = inject(ApiProductService);

  return injectQuery(() => ({
    queryKey: ['products', 'home'],
    queryFn: () => firstValueFrom(apiProductService.getHome()),
    staleTime: 1000 * 60 * 10, // 10 minutos: igual que los más vendidos, que cambian con poca frecuencia
  }));
}

/**
 * Query de los más vendidos generales (Página principal)
 */
export function injectBestSellersQuery(limit: number = 10) {
  const apiProductService = inject(ApiProductService);

  return injectQuery(() => ({
    queryKey: ['products', 'best-sellers', limit],
    queryFn: () => firstValueFrom(apiProductService.getBestSellers(limit)),
    staleTime: 1000 * 60 * 10, // 10 minutos: los más vendidos cambian con poca frecuencia
  }));
}

/**
 * Query de los más vendidos por categoría (Carruseles de la página principal)
 */
export function injectBestSellersByCategoryQuery(
  categoryIdSignal: Signal<number>,
  limit: number = 10
) {
  const apiProductService = inject(ApiProductService);

  return injectQuery(() => {
    const categoryId = categoryIdSignal();
    return {
      queryKey: ['products', 'best-sellers', 'category', categoryId, limit],
      queryFn: () =>
        firstValueFrom(apiProductService.getBestSellersByCategory(categoryId, limit)),
      enabled: categoryId > 0,
      staleTime: 1000 * 60 * 10, // 10 minutos
    };
  });
}
