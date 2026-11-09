import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { IApiProduct, ProductState } from '@models/product.model';
import { IApiCategory } from '@models/category.model';
import { AlertService } from '@services/alert.service';
import { ProductsListComponent } from './products-list/products-list.component';
import {
  ProductsToolbarComponent,
  StatusFilter,
  StockFilter,
} from './products-toolbar/products-toolbar.component';
import { Router, ActivatedRoute } from '@angular/router';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { BulkPriceModalComponent } from './products-toolbar/components/bulk-price-modal/bulk-price-modal.component';
import { ConfirmDeleteModalComponent } from '@admin/components/confirm-delete-modal/confirm-delete-modal.component';
import {
  injectAllProductsQuery,
  injectUpdateProductMutation,
  injectDeleteProductMutation,
} from '@services/queries/product-queries';
import { injectAllCategoriesQuery } from '@services/queries/category-queries';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';

@Component({
  selector: 'app-products-page',
  imports: [
    ProductsListComponent,
    ProductsToolbarComponent,
    BulkPriceModalComponent,
    PaginationComponent,
    ConfirmDeleteModalComponent,
  ],
  templateUrl: './products-page.component.html',
})
export class ProductsPageComponent {
  private alertService = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  searchQuery = signal('');
  statusFilter = signal<StatusFilter>('Todos');
  stockFilter = signal<StockFilter>('Todos');
  categoryFilter = signal<number | 'Todos'>('Todos');
  productToDelete = signal<IApiProduct | null>(null);

  // Al cambiar cualquier filtro, reseteamos a página 1. No hace falta recargar a mano:
  // la página forma parte de la queryKey y TanStack Query pide los datos al server.
  // La primera vez (cuando todavía no hay valor previo) se toma la página de la URL.
  currentPage = linkedSignal<unknown, number>({
    source: () => [
      this.searchQuery(),
      this.statusFilter(),
      this.stockFilter(),
      this.categoryFilter(),
    ],
    computation: (_filters, previous) =>
      previous ? 1 : Number(this.route.snapshot.queryParamMap.get('page')) || 1,
  });

  showBulkModal = signal(false);

  // Filtros agrupados que consume la query (cada combinación se cachea por separado)
  private activeFilters = computed(() => ({
    query: this.searchQuery(),
    state: this.statusFilter(),
    categoryId:
      this.categoryFilter() === 'Todos'
        ? undefined
        : (this.categoryFilter() as number),
    stockFilter: this.stockFilter(),
    page: this.currentPage(),
    limit: 16,
  }));

  // Capa de queries (TanStack Query): los listados quedan en caché y las mutaciones los invalidan
  private productsQuery = injectAllProductsQuery(this.activeFilters);
  private categoriesQuery = injectAllCategoriesQuery();
  private updateMutation = injectUpdateProductMutation();
  private deleteMutation = injectDeleteProductMutation();
  private invalidateCatalog = injectInvalidateCatalog();

  private productsRaw = computed(() => this.productsQuery.data()?.data ?? []);
  totalPages = computed(() => this.productsQuery.data()?.totalPages ?? 1);

  availableCategories = computed<IApiCategory[]>(
    () => this.categoriesQuery.data() ?? [],
  );

  filtersActive = computed(() => {
    return (
      this.searchQuery() !== '' ||
      this.statusFilter() !== 'Todos' ||
      this.stockFilter() !== 'Todos' ||
      this.categoryFilter() !== 'Todos'
    );
  });

  productsFiltered = computed(() => {
    return [...this.productsRaw()];
  });

  selectedIds = signal<number[]>([]);

  handleBulkPriceUpdate() {
    if (this.selectedIds().length === 0) {
      this.alertService.toast('Selecciona al menos un producto', 'warning');
      return;
    }
    this.showBulkModal.set(true);
  }

  handleBulkSuccess() {
    this.showBulkModal.set(false);
    // El modal aplica los precios llamando a la API directamente,
    // así que invalidamos el caché para recargar los productos.
    this.invalidateCatalog();
    this.selectedIds.set([]); // Limpiar selección tras éxito
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  handleNavigateToCreate() {
    this.router.navigate(['/admin/products/create']);
  }

  handleNavigateToEdit(product: IApiProduct) {
    this.router.navigate(['/admin/products/edit', product.id]);
  }

  handleDelete(product: IApiProduct) {
    this.productToDelete.set(product);
  }

  confirmDeactivateProduct() {
    const product = this.productToDelete();
    if (!product) return;

    this.updateMutation.mutate(
      { id: product.id, product: { state: ProductState.Inactivo } },
      {
        onSuccess: () => {
          this.alertService.toast('Producto desactivado', 'success');
          this.productToDelete.set(null);
        },
      },
    );
  }

  // Pausar: la ficha se sigue viendo en la tienda como "no disponible por ahora" (ID 54)
  confirmPauseProduct() {
    const product = this.productToDelete();
    if (!product) return;

    this.updateMutation.mutate(
      { id: product.id, product: { state: ProductState.Pausado } },
      {
        onSuccess: () => {
          this.alertService.toast('Publicación pausada', 'success');
          this.productToDelete.set(null);
        },
      },
    );
  }

  confirmDeleteProduct() {
    const product = this.productToDelete();
    if (!product) return;

    // La mutación invalida el caché: se recarga desde el servidor para que la paginación se recalcule
    this.deleteMutation.mutate(product.id, {
      onSuccess: () => {
        this.alertService.toast(
          'Producto eliminado permanentemente',
          'success',
        );
        this.productToDelete.set(null);
      },
    });
  }
}
