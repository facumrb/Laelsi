import { EntityStateBadgeComponent } from '@admin/components/table-components/entity-state-badge/entity-state-badge.component';
import { TableActionsComponent } from '@admin/components/table-components/table-actions/table-actions.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IApiCategory } from '@models/category.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapBoxSeam,
  bootstrapChevronRight,
} from '@ng-icons/bootstrap-icons';
import { CategoryProductsModalComponent } from './category-products-modal/category-products-modal.component';
import { Router } from '@angular/router';
import { IProductSummary } from '@models/product.model';
import { TableEmptyStateComponent } from '@admin/components/table-components/table-empty-state/table-empty-state.component';
import {
  SKELETON_ROWS,
  TableSkeletonComponent,
} from '@admin/components/table-components/table-skeleton/table-skeleton.component';
import { ActivableDirective } from '@shared/directives/activable.directive';
import { ProductoDelSubarbol } from '@shared/utils/category-tree';

@Component({
  selector: 'app-categories-list',
  imports: [
    ActivableDirective,
    TableActionsComponent,
    NgIconComponent,
    CategoryProductsModalComponent,
    TableEmptyStateComponent,
    TableSkeletonComponent,
    EntityStateBadgeComponent,
  ],
  viewProviders: provideIcons({
    bootstrapBoxSeam,
    bootstrapChevronRight,
  }),
  templateUrl: './categories-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesListComponent {
  private router = inject(Router);
  categories = input.required<IApiCategory[]>();
  onEdit = output<IApiCategory>();
  onDelete = output<IApiCategory>();
  // true cuando hay algún filtro activo: la lista se muestra plana, sin acordeón
  isFilterActive = input<boolean>(false);

  // Productos de cada categoría sumando los de sus subcategorías (los calcula la página)
  subtreeProducts = input<Map<number, ProductoDelSubarbol[]>>(new Map());

  // true mientras la página todavía no tiene datos que mostrar
  loading = input<boolean>(false);
  protected skeletonRows = SKELETON_ROWS;

  // Ids de las categorías expandidas en el acordeón
  expandedCategoryIds = signal<Set<number>>(new Set());

  // Categorías que se muestran según el acordeón
  visibleCategories = computed(() => {
    const all = this.categories();

    // Con algún filtro activo no hay acordeón: se muestra todo
    if (this.isFilterActive()) return all;

    const expanded = this.expandedCategoryIds();

    const isVisible = (cat: IApiCategory): boolean => {
      const parentId = cat.parentId ?? cat.parent?.id ?? null;
      if (parentId === null) return true; // Raíz siempre visible

      if (!expanded.has(parentId)) return false; // Si su padre directo está cerrado, se oculta

      // Escalar al abuelo por si el padre está abierto pero el abuelo cerrado
      const parentBlock = all.find((c) => c.id === parentId);
      if (parentBlock) return isVisible(parentBlock);

      return false;
    };

    return all.filter((c) => isVisible(c));
  });

  // Ids de las categorías que tienen al menos una hija
  private parentIds = computed(
    () =>
      new Set(
        this.categories()
          .map((c) => c.parentId ?? c.parent?.id ?? null)
          .filter((id): id is number => id !== null),
      ),
  );

  hasChildren(id: number): boolean {
    return this.parentIds().has(id);
  }

  toggleExpand(id: number) {
    this.expandedCategoryIds.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }

  // Categoría cuyo modal de productos está abierto
  selectedCategory = signal<IApiCategory | null>(null);

  // Abre el modal de productos de la categoría
  openProductsModal(category: IApiCategory) {
    this.selectedCategory.set(category);
  }

  // Cierra el modal de productos
  closeProductsModal() {
    this.selectedCategory.set(null);
  }

  // Cierra el modal y va a la edición del producto
  navigateToProductEdit(product: IProductSummary) {
    this.closeProductsModal();
    this.router.navigate(['/admin/products/edit', product.id]);
  }
}
