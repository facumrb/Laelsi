import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  IApiProduct,
  IBulkPricePreviewItem,
  IBulkPriceResult,
  ICreateProduct,
  IHome,
  IPaginatedProducts,
  IUpdateProduct,
  ProductState,
} from '@models/product.model';
import { IPaginatedResult } from '../../models/pagination.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiProductService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;
  // Los cambios masivos de precio tienen su propia Edge Function
  private readonly bulkUrl = `${environment.apiUrl}/bulk-prices`;

  // Obtener todos los productos
  getAllProducts(
    page: number = 1,
    limit: number = 16,
    filters: {
      query?: string;
      state?: string;
      categoryId?: number;
      stockFilter?: string;
    } = {},
  ): Observable<IPaginatedResult<IApiProduct>> {
    let params = new HttpParams().set('page', page).set('limit', limit);

    if (filters.query) params = params.set('query', filters.query);
    if (filters.state && filters.state !== 'Todos')
      params = params.set('state', filters.state);
    if (filters.categoryId && filters.categoryId !== 0)
      params = params.set('categoryId', filters.categoryId);
    if (filters.stockFilter && filters.stockFilter !== 'Todos')
      params = params.set('stockFilter', filters.stockFilter);

    return this.http
      .get<{
        message: string;
        data: IPaginatedResult<IApiProduct>;
      }>(this.apiUrl, { params })
      .pipe(map((response) => response.data));
  }

  // Obtener todos los productos activos
  getActiveProducts(
    page: number = 1,
    limit: number = 16,
  ): Observable<IPaginatedProducts> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<{
        message: string;
        data: IPaginatedProducts;
      }>(`${this.apiUrl}/active`, { params })
      .pipe(map((response) => response.data));
  }

  // Obtener productos con paginación
  getProductsPage(
    page: number = 1,
    limit: number = 16,
  ): Observable<IPaginatedResult<IApiProduct>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http
      .get<{
        message: string;
        data: IPaginatedResult<IApiProduct>;
      }>(`${this.apiUrl}/page`, { params })
      .pipe(map((response) => response.data));
  }

  // Obtener un producto por ID
  getProductById(id: number): Observable<IApiProduct> {
    return this.http
      .get<{ message: string; data: IApiProduct }>(`${this.apiUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  // Obtener un producto activo por ID (uso público)
  getActiveProductById(id: number): Observable<IApiProduct> {
    return this.http
      .get<{
        message: string;
        data: IApiProduct;
      }>(`${this.apiUrl}/active/${id}`)
      .pipe(map((response) => response.data));
  }

  /**
   * La portada de la tienda en una sola llamada: más vendidos y carruseles de las primeras categorías.
   * Reemplaza a las 8 llamadas en dos tandas que hacía la portada (ID 70, mejora de rendimiento 2).
   */
  getHome(): Observable<IHome> {
    return this.http
      .get<{ message: string; data: IHome }>(`${this.apiUrl}/home`)
      .pipe(map((response) => response.data));
  }

  /**
   * Estado actual de varios productos juntos (lo usa el carrito, que guarda una copia vencida).
   * Un producto que ya no existe figura como Inactivo.
   */
  getAvailability(ids: number[]): Observable<Record<number, ProductState>> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http
      .get<{
        message: string;
        data: Record<number, ProductState>;
      }>(`${this.apiUrl}/availability`, { params })
      .pipe(map((response) => response.data));
  }

  // Buscar productos por nombre o descripción
  searchProducts(
    query: string,
    page: number = 1,
    limit: number = 16,
    filters: {
      brand?: string;
      priceOrder?: string;
      popularityOrder?: string;
    } = {},
  ): Observable<IPaginatedProducts> {
    let params = new HttpParams()
      .set('query', query)
      .set('page', page)
      .set('limit', limit);
    if (filters.brand && filters.brand !== 'Todas')
      params = params.set('brand', filters.brand);
    if (filters.priceOrder && filters.priceOrder !== 'Defecto')
      params = params.set('priceOrder', filters.priceOrder);
    if (filters.popularityOrder && filters.popularityOrder !== 'Defecto')
      params = params.set('popularityOrder', filters.popularityOrder);
    return this.http
      .get<{
        message: string;
        data: IPaginatedProducts;
      }>(`${this.apiUrl}/search`, { params })
      .pipe(map((response) => response.data));
  }

  // Obtener productos segun una categoría (todos)
  getProductsByCategory(
    categoryId: number,
    page: number = 1,
    limit: number = 16,
  ): Observable<IPaginatedResult<IApiProduct>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<{
        message: string;
        data: IPaginatedResult<IApiProduct>;
      }>(`${this.apiUrl}/category/${categoryId}`, { params })
      .pipe(map((response) => response.data));
  }

  // Obtener productos activos segun una categoría
  getActiveProductsByCategory(
    categoryId: number,
    page: number = 1,
    limit: number = 16,
    filters: {
      brand?: string;
      priceOrder?: string;
      popularityOrder?: string;
    } = {},
  ): Observable<IPaginatedProducts> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (filters.brand && filters.brand !== 'Todas')
      params = params.set('brand', filters.brand);
    if (filters.priceOrder && filters.priceOrder !== 'Defecto')
      params = params.set('priceOrder', filters.priceOrder);
    if (filters.popularityOrder && filters.popularityOrder !== 'Defecto')
      params = params.set('popularityOrder', filters.popularityOrder);
    return this.http
      .get<{
        message: string;
        data: IPaginatedProducts;
      }>(`${this.apiUrl}/active/category/${categoryId}`, { params })
      .pipe(map((response) => response.data));
  }

  // Crea un nuevo producto (solo datos, las fotos se suben desde el api-photo.service)
  addProduct(product: ICreateProduct): Observable<IApiProduct> {
    return this.http
      .post<{ message: string; data: IApiProduct }>(this.apiUrl, product)
      .pipe(map((response) => response.data));
  }

  // Actualiza un producto
  updateProduct(id: number, product: IUpdateProduct): Observable<IApiProduct> {
    return this.http
      .patch<{
        message: string;
        data: IApiProduct;
      }>(`${this.apiUrl}/${id}`, product)
      .pipe(map((response) => response.data));
  }

  // Elimina un producto
  deleteProduct(id: number): Observable<void> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }

  // Bulk operations
  previewBulkPriceChange(
    productIds: number[],
    adjustmentType: string,
    adjustmentValue: number,
    roundingRule?: string,
  ): Observable<IBulkPricePreviewItem[]> {
    return this.http
      .post<{
        message: string;
        data: IBulkPricePreviewItem[];
      }>(`${this.bulkUrl}/preview`, {
        productIds,
        adjustmentType,
        adjustmentValue,
        roundingRule,
      })
      .pipe(map((res) => res.data));
  }

  applyBulkPriceChange(
    productIds: number[],
    adjustmentType: string,
    adjustmentValue: number,
    roundingRule?: string,
  ): Observable<IBulkPriceResult> {
    return this.http
      .post<{
        message: string;
        data: IBulkPriceResult;
      }>(`${this.bulkUrl}/apply`, {
        productIds,
        adjustmentType,
        adjustmentValue,
        roundingRule,
      })
      .pipe(map((res) => res.data));
  }

  rollbackBulkPriceChange(batchId: number): Observable<void> {
    return this.http
      .post<{ message: string }>(`${this.bulkUrl}/rollback/${batchId}`, {})
      .pipe(map(() => void 0));
  }

  getBulkHistory(): Observable<any[]> {
    return this.http
      .get<{ message: string; data: any[] }>(`${this.bulkUrl}/history`)
      .pipe(map((res) => res.data));
  }

  // Obtener los más vendidos
  getBestSellers(limit: number = 10): Observable<IApiProduct[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http
      .get<{
        message: string;
        data: IApiProduct[];
      }>(`${this.apiUrl}/best-sellers`, { params })
      .pipe(map((response) => response.data));
  }

  // Obtener los más vendidos por categoría
  getBestSellersByCategory(
    categoryId: number,
    limit: number = 10,
  ): Observable<IApiProduct[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http
      .get<{
        message: string;
        data: IApiProduct[];
      }>(`${this.apiUrl}/best-sellers/category/${categoryId}`, { params })
      .pipe(map((response) => response.data));
  }
}
