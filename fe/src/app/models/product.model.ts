import { IApiCategory } from './category.model';
import { IApiProductPhoto } from './photo.model';
import { IPaginatedResult } from './pagination.model';

// Estados de publicación (ID 54 de docs/requerimientos/discusiones.md):
//   Activo   se ve en la tienda y se puede comprar.
//   Pausado  SE VE en la tienda como "no disponible por ahora"; no se puede comprar. El stock no cambia.
//   Inactivo NO aparece en la tienda.
export enum ProductState {
  Activo = 'Activo',
  Inactivo = 'Inactivo',
  Pausado = 'Pausado',
}

export interface IApiPrice {
  id: number;
  amount: number;
  currency: string;
  validFrom: string;
  isCurrent: boolean;
}

export interface IApiProduct {
  id: number;
  name: string;
  description: string;
  prices: IApiPrice[];
  brand: string;
  totalSold: number;
  state: ProductState;
  stock: number;
  photos: IApiProductPhoto[]; // Array de URLs de las fotos del producto
  category: IApiCategory;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * Página de productos de la tienda. `brands` trae TODAS las marcas del resultado (no solo las de
 * esta página) para el filtro; el servidor la manda en la búsqueda y en los productos de una categoría.
 */
export interface IPaginatedProducts extends IPaginatedResult<IApiProduct> {
  brands?: string[];
}

/**
 * La portada de la tienda en una sola llamada (GET /products/home): los más vendidos y, de las primeras
 * categorías con productos, sus más vendidos. Las categorías sin más vendidos no vienen.
 */
export interface IHome {
  bestSellers: IApiProduct[];
  categories: { category: IApiCategory; products: IApiProduct[] }[];
}

/**
 * Resumen de un producto dentro de una categoría (GET /categories, panel admin). Es lo justo para
 * contarlos y listarlos con su miniatura: no trae precio, stock ni descripción.
 */
export interface IProductSummary {
  id: number;
  name: string;
  photos: Pick<IApiProductPhoto, 'id' | 'fileName'>[]; // Solo la primera foto de la galería
}

// Una fila de la vista previa de un cambio masivo de precios (POST /bulk-prices/preview)
export interface IBulkPricePreviewItem {
  productId: number;
  name: string;
  currentPrice: number;
  newPrice: number;
  diff: number;
  isValid: boolean;
  error: string | null; // Motivo por el que el precio nuevo no es válido
}

// Resultado de aplicar un cambio masivo de precios (POST /bulk-prices/apply)
export interface IBulkPriceResult {
  batchId: number;
  updatedCount: number;
  errorCount: number;
  errors: { productId: number; name: string; error: string }[];
}

export type ICreateProduct = Omit<
  IApiProduct,
  | 'id'
  | 'photos'
  | 'category'
  | 'prices'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
> & {
  price: number;
  category: number;
};

export type IUpdateProduct = Partial<ICreateProduct>;

// Las siguientes son interfaces para almacenar el estado de un producto en edición
export interface IProductDraftForm {
  name?: string | null;
  description?: string | null;
  price?: number | null;
  brand?: string | null;
  totalSold?: number | null;
  stock?: number | null;
  state?: ProductState | null;
  category?: IApiCategory | null;
  photos?: any[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

export interface IProductDraft {
  formValue: IProductDraftForm;
  isEditMode: boolean;
  productId: number | null;
  photos: IApiProductPhoto[] | any[];
  photosToDeleteIds: number[];
  returnUrl: string;
}
