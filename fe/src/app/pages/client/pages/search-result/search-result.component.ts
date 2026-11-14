import {
  Component,
  inject,
  signal,
  computed,
  linkedSignal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductCardComponent } from '@client/components/product-card/product-card.component';
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
    ProductsFilterComponent,
    PaginationComponent,
    BreadcrumbsComponent,
  ],
  templateUrl: './search-result.component.html',
})
export class SearchResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  // Todas las marcas de la búsqueda: las informa el servidor, porque con la paginación los
  // productos de la página actual no alcanzan para armar la lista completa
  availableBrands = computed(() => this.productsQuery.data()?.brands ?? []);
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
    {
      label: this.searchTerm()
        ? `Resultados para "${this.searchTerm()}"`
        : 'Todos los productos',
    },
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

  private productsRaw = computed(() => this.productsQuery.data()?.data ?? []);
  totalPages = computed(() => this.productsQuery.data()?.totalPages ?? 1);

  // Los productos ya vienen filtrados y ordenados del server
  productsFiltered = computed(() => [...this.productsRaw()]);

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const newQ = params['q'] || '';
      const newPage = Number(params['page']) || 1;

      // Solo recargar si cambió el query de búsqueda o la página: de eso se encarga
      // TanStack Query, porque ambos signals forman parte de la queryKey
      this.searchTerm.set(newQ);
      this.currentPage.set(newPage);
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
}
