import { Component, input, model, output } from '@angular/core';
import { IApiCategory } from '@models/category.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapCurrencyDollar } from '@ng-icons/bootstrap-icons';
import { CreateEntityButtonComponent } from '@admin/components/toolbar-components/create-entity-button/create-entity-button.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { ProductsFilterButtonComponent } from './components/products-filter-button/products-filter-button.component';

export type StockFilter =
  | 'Todos'
  | 'AltoStock' // Productos con stock > 10
  | 'BajoStock' // Productos con stock <= 10
  | 'SinStock' // Productos con stock = 0
  | 'MasProductos' // Productos de Mayor a menor stock
  | 'MenosProductos'; // Productos de Menor a mayor stock

export type StatusFilter = 'Todos' | 'Activo' | 'Pausado' | 'Inactivo';

@Component({
  selector: 'app-products-toolbar',
  imports: [
    ToolbarTitleComponent,
    NgIconComponent,
    CreateEntityButtonComponent,
    SearchInputComponent,
    ProductsFilterButtonComponent,
  ],
  viewProviders: provideIcons({
    bootstrapCurrencyDollar,
  }),
  templateUrl: './products-toolbar.component.html',
})
export class ProductsToolbarComponent {
  searchQuery = model.required<string>();
  statusFilter = model.required<StatusFilter>();
  stockFilter = model.required<StockFilter>();
  hasSelection = input<boolean>(false);

  // Output para avisar que hicieron clic en "Agregar"
  onAdd = output<void>();

  onBulkPriceUpdate = output<void>();

  categoryFilter = model.required<number | 'Todos'>();
  categories = input.required<IApiCategory[]>();
}
