import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
} from '@angular/core';
import { IApiCategory } from '@models/category.model';
import { ProductStateFilter, ProductStockFilter } from '@models/product.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapCurrencyDollar } from '@ng-icons/bootstrap-icons';
import { CreateEntityButtonComponent } from '@admin/components/toolbar-components/create-entity-button/create-entity-button.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { ProductsFilterButtonComponent } from './components/products-filter-button/products-filter-button.component';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsToolbarComponent {
  searchQuery = model.required<string>();
  statusFilter = model.required<ProductStateFilter>();
  stockFilter = model.required<ProductStockFilter>();
  categoryFilter = model.required<number | 'Todos'>();
  // Categorías que se ofrecen en el filtro
  categories = input.required<IApiCategory[]>();
  // true si hay productos seleccionados (habilita "Actualizar precios")
  hasSelection = input<boolean>(false);

  // Avisa que se pidió crear un producto
  onAdd = output<void>();

  // Avisa que se pidió actualizar los precios de los productos seleccionados
  onBulkPriceUpdate = output<void>();
}
