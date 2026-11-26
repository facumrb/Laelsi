import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  effect,
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
import { IApiCategory, CategoryState } from '@models/category.model';
import {
  BreadcrumbsComponent,
  BreadcrumbStep,
} from '@client/components/breadcrumbs/breadcrumbs.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { combineLatest } from 'rxjs';
import { InactiveCategoryModalComponent } from './inactive-category-modal/inactive-category-modal.component';
import { injectCategoryDetailQuery } from '@services/queries/category-queries';
import { injectActiveProductsQuery } from '@services/queries/product-queries';
import { pasosDeCategoria } from '@shared/utils/category-tree';

@Component({
  selector: 'app-category-page',
  imports: [
    ProductCardComponent,
    ProductCardSkeletonComponent,
    ProductsFilterComponent,
    BreadcrumbsComponent,
    PaginationComponent,
    InactiveCategoryModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-page.component.html',
})
export class CategoryPageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private currentCategoryId = signal<number>(0);

  // 1. Obtener la categoría y validar que esté activa
  // (capa de queries de TanStack Query: la categoría queda en caché por ID)
  private categoryQuery = injectCategoryDetailQuery(this.currentCategoryId);

  category = computed<IApiCategory | null>(
    () => this.categoryQuery.data() ?? null,
  );

  showInactiveCategoryModal = signal<boolean>(false);

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

  // El camino de la categoría. La actual es la página en la que estamos: va sin link
  breadcrumbSteps = computed<BreadcrumbStep[]>(() => {
    const cat = this.category();
    if (!cat) return [];

    const steps: BreadcrumbStep[] = pasosDeCategoria(cat);
    steps[steps.length - 1] = { label: cat.name };
    return steps;
  });

  // Filtros agrupados que consume la query (cada combinación se cachea por separado)
  private activeFilters = computed(() => ({
    categoryId: this.currentCategoryId(),
    brand: this.brandFilter(),
    priceOrder: this.priceOrder(),
    popularityOrder: this.popularityOrder(),
    page: this.currentPage(),
    limit: 16,
  }));

  // 2. Obtener los productos activos de la categoría con filtros
  // (la query se habilita recién cuando conocemos el ID de la categoría)
  private isQueryEnabled = computed(() => this.currentCategoryId() > 0);
  private productsQuery = injectActiveProductsQuery(this.activeFilters, {
    enabled: this.isQueryEnabled,
  });

  // Los productos ya vienen filtrados, ordenados y paginados del server
  products = computed(() => this.productsQuery.data()?.data ?? []);
  totalPages = computed(() => this.productsQuery.data()?.totalPages ?? 1);
  // Todas las marcas de la categoría: las informa el servidor, porque con la paginación los
  // productos de la página actual no alcanzan para armar la lista completa
  availableBrands = computed(() => this.productsQuery.data()?.brands ?? []);

  // Mientras no hay datos (primera carga, o un filtro o página nuevos) se muestran esqueletos en lugar de la grilla:
  // reservan el lugar y evitan el salto de diseño y el cartel falso de "no hay productos" (ID 70)
  loadingProducts = computed(() => this.productsQuery.isPending());
  readonly skeletonCards = [1, 2, 3, 4, 5, 6, 7, 8];
  // Las que entran en la primera fila de la grilla en celular (2 columnas)
  readonly tarjetasPrioritarias = 2;

  constructor() {
    effect(() => {
      // Si la categoría no existe (o falla la carga), volvemos al inicio
      if (this.categoryQuery.isError()) {
        this.router.navigate(['/']);
        return;
      }

      const data = this.categoryQuery.data();
      if (data && data.state !== CategoryState.Activo) {
        this.showInactiveCategoryModal.set(true);
      }
    });

    // Escuchamos el ID de la categoría y la página de la URL. Al actualizar los signals,
    // TanStack Query trae los datos del caché o del server según corresponda.
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, queryParams]) => {
        const id = Number(params.get('id'));

        if (!id) {
          this.router.navigate(['/']);
          return;
        }

        // Otra categoría empieza sin los filtros de la anterior (sus marcas pueden no existir acá)
        if (id !== this.currentCategoryId()) this.resetFilters();

        this.currentPage.set(Number(queryParams.get('page')) || 1);
        this.currentCategoryId.set(id);
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

  closeInactiveModal() {
    this.showInactiveCategoryModal.set(false);
    this.router.navigate(['/']);
  }

  // Vuelve los filtros a sus valores iniciales
  private resetFilters() {
    this.priceOrder.set('Defecto');
    this.brandFilter.set('Todas');
    this.popularityOrder.set('Defecto');
  }
}
