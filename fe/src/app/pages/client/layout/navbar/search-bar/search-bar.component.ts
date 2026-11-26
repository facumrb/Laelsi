import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { IApiProduct } from '@models/product.model';
import { ApiProductService } from '@services/api-services/api-product.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapSearch } from '@ng-icons/bootstrap-icons';
import { catchError, EMPTY, of, Subject, switchMap, tap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { precioVigente } from '@shared/utils/precio-vigente';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  Cada término nuevo cancela lo anterior (la espera y la petición en curso), así una respuesta vieja no
  vuelve a abrir las sugerencias. Con más de 2 caracteres espera 300 ms sin tipeo y recién ahí busca.
  Con menos, limpia los resultados en el acto. Cancelar es mandar un término vacío (cancelarBusqueda).
  */
  private initSearchFlow(): void {
    this.searchSubject
      .pipe(
        switchMap((term) => {
          if (term.length <= 2) {
            this.limpiarResultados();
            return EMPTY;
          }
          return timer(300).pipe(
            tap(() => this.isLoading.set(true)),
            switchMap(() =>
              this.apiProductService
                .searchProducts(term, 1, MAX_SUGERENCIAS)
                .pipe(catchError(() => of(null))),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((respuesta) => {
        const productos = respuesta?.data.slice(0, MAX_SUGERENCIAS) ?? [];
        this.results.set(productos);
        this.showResults.set(productos.length > 0);
        this.isLoading.set(false);
      });
  }

  // Vacía las sugerencias y apaga el indicador de carga.
  private limpiarResultados(): void {
    this.isLoading.set(false);
    this.showResults.set(false);
    this.results.set([]);
  }

  // Corta la búsqueda pendiente o en curso y cierra las sugerencias.
  private cancelarBusqueda(): void {
    this.searchSubject.next('');
  }

  // Extrae del producto el monto del precio marcado como 'actual'.
  getProductPrice(product: IApiProduct): number {
    return precioVigente(product.prices)?.amount ?? 0;
  }

  // Extrae la denominación (USD, ARS, etc) del precio activo del producto.
  getProductCurrency(product: IApiProduct): string {
    return precioVigente(product.prices)?.currency ?? 'ARS';
  }

  // Registra cada tipeo del usuario y lo inserta en el flujo reactivo de búsqueda.
  onSearch(term: string): void {
    this.query.set(term);
    this.searchSubject.next(term);
  }

  goToProduct(productId: number): void {
    this.cancelarBusqueda();
    this.query.set('');
    this.router.navigate(['/product', productId]);
  }

  handleFullSearch(): void {
    const currentQuery = this.query().trim();
    if (currentQuery) {
      this.cancelarBusqueda();
      this.router.navigate(['/search'], { queryParams: { q: currentQuery } });
    }
  }

  // Esc o clic afuera: cierra las sugerencias y corta la búsqueda pendiente, para que no se vuelvan a abrir solas.
  cerrarSugerencias(): void {
    this.cancelarBusqueda();
  }

  clearSearch(): void {
    this.query.set('');
    this.cancelarBusqueda();
  }
}
