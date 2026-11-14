import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  effect,
  linkedSignal,
} from '@angular/core';
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
  templateUrl: './category-page.component.html',
})
export class CategoryPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private currentCategoryId = signal<number>(0);

  // 1. Obtener la categoría y validar que esté activa
  // (capa de queries de TanStack Query: la categoría queda en caché por ID)
  private categoryQuery = injectCategoryDetailQuery(this.currentCategoryId);

  category = computed<IApiCategory | null>(
    () => this.categoryQuery.data() ?? null,
  );
  // Todas las marcas de la categoría: las informa el servidor, porque con la paginación los
  // productos de la página actual no alcanzan para armar la lista completa
  availableBrands = computed(() => this.productsQuery.data()?.brands ?? []);

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

  breadcrumbSteps = computed<BreadcrumbStep[]>(() => {
    const cat = this.category();
    if (!cat) return [];

    const steps: BreadcrumbStep[] = [];

    const buildPath = (current: IApiCategory) => {
      steps.unshift({
        label: current.name,
        url: `/category/${current.id}`,
      });
      if (current.parent) {
        buildPath(current.parent);
      }
    };

    buildPath(cat);

    // La categoría actual es la página en la que estamos: va sin link
    steps[steps.length - 1] = { label: cat.name };
    return steps;
  });

  showInactiveCategoryModal = signal<boolean>(false);

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

  private productsRaw = computed(() => this.productsQuery.data()?.data ?? []);
  totalPages = computed(() => this.productsQuery.data()?.totalPages ?? 1);

  // Los productos ya vienen filtrados y ordenados del server
  productsFiltered = computed(() => [...this.productsRaw()]);

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
  }

  ngOnInit(): void {
    // Escuchamos el ID de la categoría y la página de la URL. Al actualizar los signals,
    // TanStack Query trae los datos del caché o del server según corresponda.
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(
      ([params, queryParams]) => {
        const id = Number(params.get('id'));

        if (!id) {
          this.router.navigate(['/']);
          return;
        }

        const pageParam = queryParams.get('page');
        this.currentPage.set(Number(pageParam) || 1);
        this.currentCategoryId.set(id);
      },
    );
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  closeInactiveModal() {
    this.showInactiveCategoryModal.set(false);
    this.router.navigate(['/']);
  }
}
