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
import { contextoPublico } from '../../interceptors/peticion-publica';

@Injectable({
  providedIn: 'root',
})
export class ApiProductService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;
  // Los cambios masivos de precio tienen su propia Edge Function
  private readonly bulkUrl = `${environment.apiUrl}/bulk-prices`;

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

  getActiveProducts(
    page: number = 1,
    limit: number = 16,
  ): Observable<IPaginatedProducts> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<{
        message: string;
        data: IPaginatedProducts;
      }>(`${this.apiUrl}/active`, { params, context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

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

  getProductById(id: number, publico = false): Observable<IApiProduct> {
    return this.http
      .get<{ message: string; data: IApiProduct }>(`${this.apiUrl}/${id}`, {
        context: publico ? contextoPublico() : undefined,
      })
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

  getHome(): Observable<IHome> {
    return this.http
      .get<{
        message: string;
        data: IHome;
      }>(`${this.apiUrl}/home`, { context: contextoPublico() })
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
      }>(`${this.apiUrl}/availability`, { params, context: contextoPublico() })
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
      }>(`${this.apiUrl}/search`, { params, context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

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
      }>(`${this.apiUrl}/active/category/${categoryId}`, {
        params,
        context: contextoPublico(),
      })
      .pipe(map((response) => response.data));
  }

  // Crea un nuevo producto (solo datos, las fotos se suben desde el api-photo.service)
  addProduct(product: ICreateProduct): Observable<IApiProduct> {
    return this.http
      .post<{ message: string; data: IApiProduct }>(this.apiUrl, product)
      .pipe(map((response) => response.data));
  }

  updateProduct(id: number, product: IUpdateProduct): Observable<IApiProduct> {
    return this.http
      .patch<{
        message: string;
        data: IApiProduct;
      }>(`${this.apiUrl}/${id}`, product)
      .pipe(map((response) => response.data));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }

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

  getBestSellers(limit: number = 10): Observable<IApiProduct[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http
      .get<{
        message: string;
        data: IApiProduct[];
      }>(`${this.apiUrl}/best-sellers`, { params, context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

  getBestSellersByCategory(
    categoryId: number,
    limit: number = 10,
  ): Observable<IApiProduct[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http
      .get<{
        message: string;
        data: IApiProduct[];
      }>(`${this.apiUrl}/best-sellers/category/${categoryId}`, {
        params,
        context: contextoPublico(),
      })
      .pipe(map((response) => response.data));
  }
}
