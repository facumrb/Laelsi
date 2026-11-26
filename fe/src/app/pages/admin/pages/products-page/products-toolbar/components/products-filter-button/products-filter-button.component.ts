import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { FilterButtonComponent } from '@shared/components/buttons/filter-button/filter-button.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { ProductStateFilter, ProductStockFilter } from '@models/product.model';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsFilterButtonComponent {
  statusFilter = model.required<ProductStateFilter>();
  stockFilter = model.required<ProductStockFilter>();
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

  // Categorías en orden de árbol, de la raíz hasta el último nivel que se puede crear
  hierarchicalCategories = computed(() =>
    aplanarCategorias(this.categories(), MAX_CATEGORY_DEPTH),
  );

  // Nombre de la categoría elegida en el filtro
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
