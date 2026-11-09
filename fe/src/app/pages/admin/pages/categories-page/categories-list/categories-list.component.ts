import { EntityStateBadgeComponent } from '@admin/components/table-components/entity-state-badge/entity-state-badge.component';
import { TableActionsComponent } from '@admin/components/table-components/table-actions/table-actions.component';
import { Component, inject, input, output, signal, computed } from '@angular/core';
import { IApiCategory } from '@models/category.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapBoxSeam, bootstrapChevronRight, bootstrapChevronDown } from '@ng-icons/bootstrap-icons';
import { CategoryProductsModalComponent } from './category-products-modal/category-products-modal.component';
import { Router } from '@angular/router';
import { IProductSummary } from '@models/product.model';
import { TableEmptyStateComponent } from '@admin/components/table-components/table-empty-state/table-empty-state.component';
import { ActivableDirective } from '@shared/directives/activable.directive';

@Component({
  selector: 'app-categories-list',
  imports: [
    ActivableDirective,
    TableActionsComponent,
    NgIconComponent,
    CategoryProductsModalComponent,
    TableEmptyStateComponent,
    EntityStateBadgeComponent,
  ],
  viewProviders: provideIcons({
    bootstrapBoxSeam,
    bootstrapChevronRight,
    bootstrapChevronDown,
  }),
  templateUrl: './categories-list.component.html',
})
export class CategoriesListComponent {
  private router = inject(Router);
  categories = input.required<IApiCategory[]>();
  onEdit = output<IApiCategory>();
  onDelete = output<IApiCategory>();
  isFilterActive = input<boolean>(false);

  // Estado para el árbol de categorías (acordeón)
  expandedCategoryIds = signal<Set<number>>(new Set());

  // Categorías que deben renderizarse en el HTML
  visibleCategories = computed(() => {
    const all = this.categories();
    
    // Si hay búsqueda activa, anulamos el acordeón (todo lineal)
    if (this.isFilterActive()) return all;

    const expanded = this.expandedCategoryIds();

    const isVisible = (cat: IApiCategory): boolean => {
      const parentId = cat.parentId ?? cat.parent?.id ?? null;
      if (parentId === null) return true; // Raíz siempre visible
      
      if (!expanded.has(parentId)) return false; // Si su padre directo está cerrado, se oculta

      // Escalar al abuelo por si el padre está abierto pero el abuelo cerrado
      const parentBlock = all.find(c => c.id === parentId);
      if (parentBlock) return isVisible(parentBlock);
      
      return false;
    };

    return all.filter(c => isVisible(c));
  });

  hasChildren(id: number): boolean {
    return this.categories().some(c => (c.parentId ?? c.parent?.id ?? null) === id);
  }

  toggleExpand(id: number) {
    this.expandedCategoryIds.update(set => {
      const newSet = new Set(set);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }

  // Estado para el modal
  selectedCategory = signal<IApiCategory | null>(null);

  // Método para abrir el modal
  openProductsModal(category: IApiCategory) {
    this.selectedCategory.set(category);
  }

  // Método para cerrar el modal
  closeProductsModal() {
    this.selectedCategory.set(null);
  }

  // Método para navegar a la edición del producto
  navigateToProductEdit(product: IProductSummary) {
    this.closeProductsModal();
    this.router.navigate(['/admin/products/edit', product.id]);
  }
}
