import { Component, model, signal, input, computed } from '@angular/core';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { FilterButtonComponent } from '@shared/components/buttons/filter-button/filter-button.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { StockFilter, StatusFilter } from '../../products-toolbar.component';
import { IApiCategory, MAX_CATEGORY_DEPTH } from '@models/category.model';
import { aplanarCategorias } from '@shared/utils/category-tree';
import {
  FilterAccordionComponent,
  FilterOption,
} from '@shared/components/filter-accordion/filter-accordion.component';

@Component({
  selector: 'app-products-filter-button',
  imports: [
    ClickOutsideDirective,
    ListboxDirective,
    FilterButtonComponent,
    NgIconComponent,
    FilterAccordionComponent,
  ],
  viewProviders: [provideIcons({ bootstrapChevronDown, bootstrapCheckLg })],
  templateUrl: './products-filter-button.component.html',
})
export class ProductsFilterButtonComponent {
  statusFilter = model.required<StatusFilter>();
  stockFilter = model.required<StockFilter>();
  categoryFilter = model.required<number | 'Todos'>();
  categories = input.required<IApiCategory[]>();

  showFilterMenu = signal(false);
  showCategoryMenu = signal(false);

  readonly statusOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Activo', label: 'Activos' },
    { value: 'Pausado', label: 'Pausados' },
    { value: 'Inactivo', label: 'Inactivos' },
  ];

  readonly stockOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'AltoStock', label: 'Stock alto (+10)' },
    { value: 'BajoStock', label: 'Stock bajo (-10)' },
    { value: 'SinStock', label: 'Stock agotado' },
    { value: 'MasProductos', label: 'Mayor a menor' },
    { value: 'MenosProductos', label: 'Menor a mayor' },
  ];

  // Categorías en formato árbol plano, de la raíz hasta el último nivel que pueden crear los negocios
  hierarchicalCategories = computed(() => aplanarCategorias(this.categories(), MAX_CATEGORY_DEPTH));

  selectedCategoryName = computed(() => {
    const selected = this.categoryFilter();
    if (selected === 'Todos') {
      return 'Todas las categorías';
    }
    const cat = this.categories().find((c) => c.id === selected);
    return cat ? cat.name : 'Categoría desconocida';
  });

  selectCategory(val: number | 'Todos') {
    this.categoryFilter.set(val);
    this.showCategoryMenu.set(false);
  }

  hayFiltrosActivos = computed(
    () =>
      this.statusFilter() !== 'Todos' ||
      this.stockFilter() !== 'Todos' ||
      this.categoryFilter() !== 'Todos',
  );

  limpiar() {
    this.statusFilter.set('Todos');
    this.stockFilter.set('Todos');
    this.categoryFilter.set('Todos');
    this.showFilterMenu.set(false);
  }
}
