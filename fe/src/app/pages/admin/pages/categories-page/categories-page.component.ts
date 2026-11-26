import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  CategoryState,
  CategoryStateFilter,
  CategoryStockFilter,
  IApiCategory,
} from '@models/category.model';
import { AlertService } from '@services/alert.service';
import { CategoriesListComponent } from './categories-list/categories-list.component';
import { CategoriesToolbarComponent } from './categories-toolbar/categories-toolbar.component';
import { Router } from '@angular/router';
import {
  injectAllCategoriesQuery,
  injectUpdateCategoryMutation,
  injectDeleteCategoryMutation,
} from '@services/queries/category-queries';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';
import { productosDelSubarbol } from '@shared/utils/category-tree';
import { ConfirmDeleteModalComponent } from '@admin/components/confirm-delete-modal/confirm-delete-modal.component';
import {
  CategoryDeleteBlockedModalComponent,
  DeleteBlockReason,
} from './categories-list/category-delete-blocked-modal/category-delete-blocked-modal.component';

// Id de la madre de una categoría (null si es raíz)
const parentIdOf = (c: IApiCategory): number | null =>
  c.parentId ?? c.parent?.id ?? null;

@Component({
  selector: 'app-categories-page',
  imports: [
    CategoriesListComponent,
    CategoriesToolbarComponent,
    ConfirmDeleteModalComponent,
    CategoryDeleteBlockedModalComponent,
  ],
  templateUrl: './categories-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPageComponent {
  private alertService = inject(AlertService);
  private router = inject(Router);

  statusFilter = signal<CategoryStateFilter>('Todos');
  stockFilter = signal<CategoryStockFilter>('Todos');
  searchQuery = signal('');
  categoryToDelete = signal<IApiCategory | null>(null);
  // Categoría que no se puede borrar y el motivo (abre el aviso de bloqueo)
  categoryBlocked = signal<{
    category: IApiCategory;
    reason: DeleteBlockReason;
  } | null>(null);

  // Capa de queries (TanStack Query): el listado queda en caché y las mutaciones lo invalidan
  private categoriesQuery = injectAllCategoriesQuery();
  private updateMutation = injectUpdateCategoryMutation();
  private deleteMutation = injectDeleteCategoryMutation();
  private invalidateCatalog = injectInvalidateCatalog();

  // Listado plano de todas las categorías (cada una con su padre y sus productos asociados)
  private categoriesRaw = computed(() => this.categoriesQuery.data() ?? []);
  loading = computed(() => this.categoriesQuery.isPending());

  /*
  Productos de cada categoría sumando los de sus descendientes. Se calcula sobre la lista sin
  filtrar: con una búsqueda activa, una madre sigue contando a las hijas que no coinciden.
  */
  subtreeProducts = computed(() => productosDelSubarbol(this.categoriesRaw()));

  filtersActive = computed(() => {
    return (
      this.searchQuery() !== '' ||
      this.statusFilter() !== 'Todos' ||
      this.stockFilter() !== 'Todos'
    );
  });

  // Categorías filtradas y ordenadas para la lista
  categoriesFiltered = computed(() => {
    // Valores actuales de los signals
    const currentCategories = this.categoriesRaw();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const stockType = this.stockFilter();
    const subtree = this.subtreeProducts();
    // Productos propios y de las subcategorías
    const productCount = (c: IApiCategory) => subtree.get(c.id)?.length ?? 0;

    // Filtros: búsqueda, estado y cantidad de productos
    const filtered = currentCategories.filter((cat) => {
      // Búsqueda por nombre o descripción
      const matchesSearch =
        cat.name.toLowerCase().includes(query) ||
        (cat.description || '').toLowerCase().includes(query);

      // Estado
      const matchesStatus = status === 'Todos' || cat.state === status;

      // Cantidad de productos asociados (propios y de sus subcategorías)
      const cant = productCount(cat);
      let matchesStock = true;
      if (stockType === 'ConProductos') matchesStock = cant > 0;
      if (stockType === 'SinProductos') matchesStock = cant === 0;

      return matchesSearch && matchesStatus && matchesStock;
    });

    // Ordenamiento
    if (stockType === 'MasProductos') {
      // De mayor a menor cantidad de productos
      return filtered.sort((a, b) => productCount(b) - productCount(a));
    }
    if (stockType === 'MenosProductos') {
      // De menor a mayor cantidad de productos
      return filtered.sort((a, b) => productCount(a) - productCount(b));
    }

    /*
    Orden por defecto. Con algún filtro activo la jerarquía no se puede mantener (faltan madres
    o hijas), así que se ordena solo por orden. Sin filtros se arma el árbol: cada madre seguida
    de sus hijas, por orden.
    */
    if (this.filtersActive()) {
      return filtered.sort((a, b) => a.order - b.order);
    }
    // Arma el árbol: cada categoría seguida de sus hijas, recursivamente
    const buildTree = (
      list: IApiCategory[],
      parentId: number | null = null,
    ): IApiCategory[] =>
      list
        .filter((c) => parentIdOf(c) === parentId)
        .sort((a, b) => a.order - b.order)
        .flatMap((cat) => [cat, ...buildTree(list, cat.id)]);
    return buildTree(currentCategories);
  });

  // Vuelve a pedir las categorías (después de guardar un orden nuevo desde el toolbar)
  refreshCategories() {
    this.invalidateCatalog();
  }

  handleNavigateToCreate() {
    this.router.navigate(['/admin/categories/create']);
  }

  handleNavigateToEdit(category: IApiCategory) {
    this.router.navigate(['/admin/categories/edit', category.id]);
  }

  /*
  El servidor no deja borrar una categoría con productos propios o con subcategorías: en esos
  casos se avisa antes de pedir la confirmación.
  */
  handleDelete(category: IApiCategory) {
    if ((category.products?.length || 0) > 0) {
      this.categoryBlocked.set({ category, reason: 'productos' });
      return;
    }
    if (this.categoriesRaw().some((c) => parentIdOf(c) === category.id)) {
      this.categoryBlocked.set({ category, reason: 'subcategorias' });
      return;
    }

    this.categoryToDelete.set(category);
  }

  confirmDeactivateCategory() {
    const category = this.categoryToDelete();
    if (!category || this.updateMutation.isPending()) return;

    this.updateMutation.mutate(
      { id: category.id, category: { state: CategoryState.Inactivo } },
      {
        onSuccess: () => {
          this.alertService.toast('Categoría desactivada', 'success');
          this.categoryToDelete.set(null);
        },
      },
    );
  }

  confirmDeleteCategory() {
    const category = this.categoryToDelete();
    if (!category || this.deleteMutation.isPending()) return;

    // La mutación invalida el caché: el listado se recarga para sincronizar el corrimiento de órdenes
    this.deleteMutation.mutate(category.id, {
      onSuccess: () => {
        this.alertService.toast(
          'Categoría eliminada permanentemente',
          'success',
        );
        this.categoryToDelete.set(null);
      },
    });
  }
}
