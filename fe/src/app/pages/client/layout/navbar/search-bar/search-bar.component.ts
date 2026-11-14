import { Component, signal, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { IApiProduct } from '@models/product.model';
import { ApiProductService } from '@services/api-services/api-product.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapSearch } from '@ng-icons/bootstrap-icons';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';

// Cantidad de sugerencias que se piden al servicio y que se muestran en el autocompletado.
const MAX_SUGERENCIAS = 6;

@Component({
  selector: 'app-search-bar',
  imports: [
    CurrencyPipe,
    NgIconComponent,
    ClickOutsideDirective,
    ProductImageComponent,
  ],
  viewProviders: provideIcons({
    bootstrapSearch,
  }),
  templateUrl: './search-bar.component.html',
})
export class SearchBarComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiProductService = inject(ApiProductService);

  query = signal('');
  results = signal<IApiProduct[]>([]);
  showResults = signal(false);
  isLoading = signal(false);

  // Subject auxiliar para controlar el flujo asíncrono de petición de resultados
  private readonly searchSubject = new Subject<string>();

  constructor() {
    this.initSearchFlow();
  }

  /*
   Inicializa el flujo reactivo de búsqueda.
   - debounceTime: Espera 300ms cuando el usuario deja de escribir.
   - filter: Solo dispara peticiones para cadenas largas (más de 2 caracteres).
  */
  private initSearchFlow(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => {
          if (term.length > 2) {
            this.isLoading.set(true);
          } else {
            // Limpia si se vació el input o tiene muy pocos caracteres
            this.isLoading.set(false);
            this.showResults.set(false);
            this.results.set([]);
          }
        }),
        filter((term) => term.length > 2),
        switchMap((term) =>
          this.apiProductService.searchProducts(term, 1, MAX_SUGERENCIAS).pipe(
            catchError(() => {
              return of({
                data: [],
                total: 0,
                page: 1,
                limit: 16,
                totalPages: 0,
              } as any);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (products) => {
          this.results.set(products.data.slice(0, MAX_SUGERENCIAS));
          this.showResults.set(products.data.length > 0);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  // Extrae del producto el monto del precio marcado como 'actual'.
  getProductPrice(product: IApiProduct): number {
    const currentPrice = product.prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.amount : 0;
  }

  // Extrae la denominación (USD, ARS, etc) del precio activo del producto.
  getProductCurrency(product: IApiProduct): string {
    const currentPrice = product.prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.currency : 'ARS';
  }

  // Registra cada tipeo del usuario y lo inserta en el flujo reactivo de búsqueda.
  onSearch(term: string): void {
    this.query.set(term);
    this.searchSubject.next(term);
  }

  goToProduct(productId: number): void {
    this.showResults.set(false);
    this.query.set('');
    this.router.navigate(['/product', productId]);
  }

  handleFullSearch(): void {
    const currentQuery = this.query().trim();
    if (currentQuery) {
      this.showResults.set(false);
      this.router.navigate(['/search'], { queryParams: { q: currentQuery } });
    }
  }

  clearSearch(): void {
    this.query.set('');
    this.results.set([]);
    this.showResults.set(false);
  }
}
