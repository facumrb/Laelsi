import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  linkedSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductCardComponent } from '@client/components/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '@client/components/product-card-skeleton/product-card-skeleton.component';
import {
  ProductsFilterComponent,
  PriceOrder,
  PopularityOrder,
} from '@client/components/products-filter/products-filter.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { BreadcrumbsComponent } from '@client/components/breadcrumbs/breadcrumbs.component';
import { injectActiveProductsQuery } from '@services/queries/product-queries';

@Component({
  selector: 'app-search-result',
  imports: [
    ProductCardComponent,
    ProductCardSkeletonComponent,
    ProductsFilterComponent,
    PaginationComponent,
    BreadcrumbsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-result.component.html',
})
export class SearchResultComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  searchTerm = signal<string>('');

  priceOrder = signal<PriceOrder>('Defecto');
  brandFilter = signal<string>('Todas');
  popularityOrder = signal<PopularityOrder>('Defecto');

  // Reacciona a cambios en los filtros y recarga del server: al cambiar cualquiera,
  // reseteamos a página 1. No hace falta recargar a mano porque la página forma
  // parte de la queryKey y TanStack Query pide los datos por su cuenta.
  currentPage = linkedSignal<unknown, number>({
    source: () => [
      this.priceOrder(),
      this.brandFilter(),
      this.popularityOrder(),
    ],
    computation: () => 1,
  });

  breadcrumbSteps = computed(() => [
    { label: 'Búsqueda' },
    { label: `Resultados para "${this.searchTerm()}"` },
  ]);

  // Filtros agrupados que consume la query (cada combinación se cachea por separado)
  private activeFilters = computed(() => ({
    query: this.searchTerm(),
    brand: this.brandFilter(),
    priceOrder: this.priceOrder(),
    popularityOrder: this.popularityOrder(),
    page: this.currentPage(),
    limit: 16,
  }));

  // La query se habilita recién cuando leímos los parámetros de la URL
  private isReady = signal(false);

  private productsQuery = injectActiveProductsQuery(this.activeFilters, {
    enabled: this.isReady,
  });

  // Los productos ya vienen filtrados, ordenados y paginados del server
  products = computed(() => this.productsQuery.data()?.data ?? []);
  totalPages = computed(() => this.productsQuery.data()?.totalPages ?? 1);
  // Todas las marcas de la búsqueda: las informa el servidor, porque con la paginación los
  // productos de la página actual no alcanzan para armar la lista completa
  availableBrands = computed(() => this.productsQuery.data()?.brands ?? []);

  // Mientras no hay datos se muestran esqueletos: evitan el salto de diseño y el cartel falso de "no hay productos"
  loadingProducts = computed(() => this.productsQuery.isPending());
  readonly skeletonCards = [1, 2, 3, 4, 5, 6, 7, 8];
  // Las que entran en la primera fila de la grilla en celular (2 columnas)
  readonly tarjetasPrioritarias = 2;

  constructor() {
    // La búsqueda y la página salen de la URL. Al actualizar los signals, TanStack Query trae
    // los datos del caché o del server según corresponda.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const newQ = params.get('q')?.trim() || '';

      // Sin nada que buscar no hay resultados que mostrar: se vuelve al inicio (Atrás no regresa acá)
      if (!newQ) {
        this.router.navigate(['/'], { replaceUrl: true });
        return;
      }

      // Una búsqueda nueva empieza sin los filtros de la anterior
      if (newQ !== this.searchTerm()) this.resetFilters();

      this.searchTerm.set(newQ);
      this.currentPage.set(Number(params.get('page')) || 1);
      this.isReady.set(true);
    });
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  // Al cambiar un filtro se vuelve a la página 1, así que la página deja de ir en la URL
  onFilterChange() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: null },
      queryParamsHandling: 'merge',
    });
  }

  // Vuelve los filtros a sus valores iniciales
  private resetFilters() {
    this.priceOrder.set('Defecto');
    this.brandFilter.set('Todas');
    this.popularityOrder.set('Defecto');
  }
}
