import { Component, inject, signal, computed } from '@angular/core';
import { IApiCategory, CategoryState } from '@models/category.model';
import { ReactiveFormsModule } from '@angular/forms';
import { AlertService } from '@services/alert.service';
import { CategoriesListComponent } from './categories-list/categories-list.component';
import {
  CategoriesToolbarComponent,
  StatusFilter,
  StockFilter,
} from './categories-toolbar/categories-toolbar.component';
import { Router } from '@angular/router';
import {
  injectAllCategoriesQuery,
  injectUpdateCategoryMutation,
  injectDeleteCategoryMutation,
} from '@services/queries/category-queries';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';
import { productosDelSubarbol } from '@shared/utils/category-tree';
import { ConfirmDeleteModalComponent } from '@admin/components/confirm-delete-modal/confirm-delete-modal.component';
import { CategoryDeleteBlockedModalComponent } from './categories-list/category-delete-blocked-modal/category-delete-blocked-modal.component';

@Component({
  selector: 'app-categories-page',
  imports: [
    ReactiveFormsModule,
    CategoriesListComponent,
    CategoriesToolbarComponent,
    ConfirmDeleteModalComponent,
    CategoryDeleteBlockedModalComponent,
  ],
  templateUrl: './categories-page.component.html',
})
export class CategoriesPageComponent {
  private alertService = inject(AlertService);
  private router = inject(Router);

  statusFilter = signal<StatusFilter>('Todos');
  stockFilter = signal<StockFilter>('Todos');
  searchQuery = signal('');
  categoryToDelete = signal<IApiCategory | null>(null);
  categoryBlocked = signal<IApiCategory | null>(null);

  // Capa de queries (TanStack Query): el listado queda en caché y las mutaciones lo invalidan
  private categoriesQuery = injectAllCategoriesQuery();
  private updateMutation = injectUpdateCategoryMutation();
  private deleteMutation = injectDeleteCategoryMutation();
  private invalidateCatalog = injectInvalidateCatalog();

  // Listado plano de todas las categorías (cada una con su padre y sus productos asociados)
  private categoriesRaw = computed(() => this.categoriesQuery.data() ?? []);
  loading = computed(() => this.categoriesQuery.isPending());

  // Productos de cada categoría sumando los de sus descendientes. Se calcula sobre la lista sin
  // filtrar: con una búsqueda activa, una madre sigue contando a las hijas que no coinciden.
  subtreeProducts = computed(() => productosDelSubarbol(this.categoriesRaw()));

  filtersActive = computed(() => {
    return (
      this.searchQuery() !== '' ||
      this.statusFilter() !== 'Todos' ||
      this.stockFilter() !== 'Todos'
    );
  });

  categoriesFiltered = computed(() => {
    // Obtenemos los valores actuales de los signals
    const currentCategories = this.categoriesRaw();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const stockType = this.stockFilter();
    const subtree = this.subtreeProducts();
    const productCount = (c: IApiCategory) => subtree.get(c.id)?.length ?? 0;

    // Helper para obtener parentId de forma consistente
    const getParentId = (c: IApiCategory): number | null =>
      c.parentId ?? c.parent?.id ?? null;

    // Aplicamos filtros (Search, Status, Stock)
    let filtered = currentCategories.filter((cat) => {
      // Filtro de Búsqueda
      const matchesSearch =
        cat.name.toLowerCase().includes(query) ||
        (cat.description || '').toLowerCase().includes(query);

      // Filtro de Estado
      const matchesStatus = status === 'Todos' || cat.state === status;

      // Filtro de Cantidad de Productos asociados (propios y de sus subcategorías)
      const cant = productCount(cat);
      let matchesStock = true;
      if (stockType === 'ConProductos') matchesStock = cant > 0;
      if (stockType === 'SinProductos') matchesStock = cant === 0;

      return matchesSearch && matchesStatus && matchesStock;
    });

    // Ordenamiento
    if (stockType === 'MasProductos') {
      // Ordenar de Mayor a Menor
      filtered = filtered.sort((a, b) => productCount(b) - productCount(a));
    } else if (stockType === 'MenosProductos') {
      // Ordenar de Menor a Mayor
      filtered = filtered.sort((a, b) => productCount(a) - productCount(b));
    } else {
      // ORDENAMIENTO JERÁRQUICO (POR DEFECTO)
      // Si hay filtros activos (búsqueda), no podemos mantener la jerarquía estricta,
      // pero si no hay filtros, ordenamos: Padre -> Hijos (por orden)
      if (this.filtersActive()) {
        filtered.sort((a, b) => a.order - b.order);
      } else {
        const buildTree = (
          list: IApiCategory[],
          parentId: number | null = null,
        ): IApiCategory[] => {
          return list
            .filter((c) => getParentId(c) === parentId)
            .sort((a, b) => a.order - b.order)
            .reduce((acc: IApiCategory[], cat) => {
              return [...acc, cat, ...buildTree(list, cat.id)];
            }, []);
        };
        return buildTree(currentCategories);
      }
    }

    return filtered;
  });

  loadCategories() {
    // Invalidamos el caché para que el listado se vuelva a pedir al server
    // (ej: después de reordenar las categorías desde el toolbar)
    this.invalidateCatalog();
  }

  handleNavigateToCreate() {
    this.router.navigate(['/admin/categories/create']);
  }

  handleNavigateToEdit(category: IApiCategory) {
    this.router.navigate(['/admin/categories/edit', category.id]);
  }

  // --- Lógica para borrar la categoria ---
  handleDelete(category: IApiCategory) {
    const cantidadProductos = category.products?.length || 0;
    if (cantidadProductos > 0) {
      this.categoryBlocked.set(category);
      return;
    }

    this.categoryToDelete.set(category);
  }

  confirmDeactivateCategory() {
    const category = this.categoryToDelete();
    if (!category) return;

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
    if (!category) return;

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
