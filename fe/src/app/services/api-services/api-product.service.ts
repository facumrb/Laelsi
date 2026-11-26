import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  BulkAdjustmentType,
  IApiProduct,
  IBulkPriceBatch,
  IBulkPricePreviewItem,
  IBulkPriceResult,
  ICreateProduct,
  IHome,
  IPaginatedProducts,
  IUpdateProduct,
  ProductState,
} from '@models/product.model';
import { IPaginatedResult } from '@models/pagination.model';
import { environment } from '@environments/environment';
import { contextoPublico } from '@interceptor/peticion-publica';
import { IApiResponse } from '@models/api-response.model';

// Filtros de los listados de la tienda (búsqueda y productos de una categoría)
interface IStoreFilters {
  brand?: string;
  priceOrder?: string;
  popularityOrder?: string;
}

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
      .get<IApiResponse<IPaginatedResult<IApiProduct>>>(this.apiUrl, { params })
      .pipe(map((response) => response.data));
  }

  // Este método no se utiliza actualmente
  getActiveProducts(
    page: number = 1,
    limit: number = 16,
  ): Observable<IPaginatedProducts> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<
        IApiResponse<IPaginatedProducts>
      >(`${this.apiUrl}/active`, { params, context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

  // Este método no se utiliza actualmente
  getProductsPage(
    page: number = 1,
    limit: number = 16,
  ): Observable<IPaginatedResult<IApiProduct>> {
    const params = new HttpParams().set('page', page).set('limit', limit);

    return this.http
      .get<
        IApiResponse<IPaginatedResult<IApiProduct>>
      >(`${this.apiUrl}/page`, { params })
      .pipe(map((response) => response.data));
  }

  // publico = true para la tienda: sale sin credenciales. El panel usa el valor por defecto
  getProductById(id: number, publico = false): Observable<IApiProduct> {
    return this.http
      .get<IApiResponse<IApiProduct>>(`${this.apiUrl}/${id}`, {
        context: publico ? contextoPublico() : undefined,
      })
      .pipe(map((response) => response.data));
  }

  // Este método no se utiliza actualmente
  // Obtener un producto activo por ID (uso público)
  getActiveProductById(id: number): Observable<IApiProduct> {
    return this.http
      .get<IApiResponse<IApiProduct>>(`${this.apiUrl}/active/${id}`)
      .pipe(map((response) => response.data));
  }

  getHome(): Observable<IHome> {
    return this.http
      .get<
        IApiResponse<IHome>
      >(`${this.apiUrl}/home`, { context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

  /**
   * Estado actual de varios productos juntos (lo usa el carrito, que guarda una copia vencida).
   * Un producto que ya no existe figura como Inactivo.
   */
  getAvailability(ids: number[]): Observable<Record<number, ProductState>> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http
      .get<
        IApiResponse<Record<number, ProductState>>
      >(`${this.apiUrl}/availability`, { params, context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

  // Buscar productos por nombre o descripción
  searchProducts(
    query: string,
    page: number = 1,
    limit: number = 16,
    filters: IStoreFilters = {},
  ): Observable<IPaginatedProducts> {
    const params = this.withStoreFilters(
      new HttpParams()
        .set('query', query)
        .set('page', page)
        .set('limit', limit),
      filters,
    );
    return this.http
      .get<
        IApiResponse<IPaginatedProducts>
      >(`${this.apiUrl}/search`, { params, context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

  // Este método no se utiliza actualmente
  getProductsByCategory(
    categoryId: number,
    page: number = 1,
    limit: number = 16,
  ): Observable<IPaginatedResult<IApiProduct>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<
        IApiResponse<IPaginatedResult<IApiProduct>>
      >(`${this.apiUrl}/category/${categoryId}`, { params })
      .pipe(map((response) => response.data));
  }

  getActiveProductsByCategory(
    categoryId: number,
    page: number = 1,
    limit: number = 16,
    filters: IStoreFilters = {},
  ): Observable<IPaginatedProducts> {
    const params = this.withStoreFilters(
      new HttpParams().set('page', page).set('limit', limit),
      filters,
    );
    return this.http
      .get<IApiResponse<IPaginatedProducts>>(
        `${this.apiUrl}/active/category/${categoryId}`,
        {
          params,
          context: contextoPublico(),
        },
      )
      .pipe(map((response) => response.data));
  }

  // Crea un nuevo producto (solo datos, las fotos se suben desde el api-photo.service)
  addProduct(product: ICreateProduct): Observable<IApiProduct> {
    return this.http
      .post<IApiResponse<IApiProduct>>(this.apiUrl, product)
      .pipe(map((response) => response.data));
  }

  updateProduct(id: number, product: IUpdateProduct): Observable<IApiProduct> {
    return this.http
      .patch<IApiResponse<IApiProduct>>(`${this.apiUrl}/${id}`, product)
      .pipe(map((response) => response.data));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http
      .delete<IApiResponse<null>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }

  previewBulkPriceChange(
    productIds: number[],
    adjustmentType: BulkAdjustmentType,
    adjustmentValue: number,
    roundingRule?: string,
  ): Observable<IBulkPricePreviewItem[]> {
    return this.http
      .post<IApiResponse<IBulkPricePreviewItem[]>>(`${this.bulkUrl}/preview`, {
        productIds,
        adjustmentType,
        adjustmentValue,
        roundingRule,
      })
      .pipe(map((res) => res.data));
  }

  applyBulkPriceChange(
    productIds: number[],
    adjustmentType: BulkAdjustmentType,
    adjustmentValue: number,
    roundingRule?: string,
  ): Observable<IBulkPriceResult> {
    return this.http
      .post<IApiResponse<IBulkPriceResult>>(`${this.bulkUrl}/apply`, {
        productIds,
        adjustmentType,
        adjustmentValue,
        roundingRule,
      })
      .pipe(map((res) => res.data));
  }

  // Este método no se utiliza actualmente
  rollbackBulkPriceChange(batchId: number): Observable<void> {
    return this.http
      .post<IApiResponse<null>>(`${this.bulkUrl}/rollback/${batchId}`, {})
      .pipe(map(() => void 0));
  }

  // Este método no se utiliza actualmente
  getBulkHistory(): Observable<IBulkPriceBatch[]> {
    return this.http
      .get<IApiResponse<IBulkPriceBatch[]>>(`${this.bulkUrl}/history`)
      .pipe(map((res) => res.data));
  }

  // Este método no se utiliza actualmente
  getBestSellers(limit: number = 10): Observable<IApiProduct[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http
      .get<
        IApiResponse<IApiProduct[]>
      >(`${this.apiUrl}/best-sellers`, { params, context: contextoPublico() })
      .pipe(map((response) => response.data));
  }

  // Este método no se utiliza actualmente
  getBestSellersByCategory(
    categoryId: number,
    limit: number = 10,
  ): Observable<IApiProduct[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http
      .get<IApiResponse<IApiProduct[]>>(
        `${this.apiUrl}/best-sellers/category/${categoryId}`,
        {
          params,
          context: contextoPublico(),
        },
      )
      .pipe(map((response) => response.data));
  }

  // 'Todas' y 'Defecto' son los valores de la interfaz para "sin filtro": no se envían
  private withStoreFilters(
    params: HttpParams,
    filters: IStoreFilters,
  ): HttpParams {
    if (filters.brand && filters.brand !== 'Todas')
      params = params.set('brand', filters.brand);
    if (filters.priceOrder && filters.priceOrder !== 'Defecto')
      params = params.set('priceOrder', filters.priceOrder);
    if (filters.popularityOrder && filters.popularityOrder !== 'Defecto')
      params = params.set('popularityOrder', filters.popularityOrder);
    return params;
  }
}
