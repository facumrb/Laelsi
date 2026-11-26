import {
  ChangeDetectionStrategy,
  Component,
  model,
  output,
  signal,
} from '@angular/core';
import { CreateEntityButtonComponent } from '@admin/components/toolbar-components/create-entity-button/create-entity-button.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import { CategoriesOrderModalComponent } from './components/categories-order-modal/categories-order-modal.component';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { CategoriesFilterButtonComponent } from './components/categories-filter-button/categories-filter-button.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapArrowDownUp } from '@ng-icons/bootstrap-icons';
import {
  CategoryStateFilter,
  CategoryStockFilter,
} from '@models/category.model';

@Component({
  selector: 'app-categories-toolbar',
  imports: [
    ToolbarTitleComponent,
    CreateEntityButtonComponent,
    CategoriesOrderModalComponent,
    SearchInputComponent,
    CategoriesFilterButtonComponent,
    NgIconComponent,
  ],
  providers: [provideIcons({ bootstrapArrowDownUp })],
  templateUrl: './categories-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesToolbarComponent {
  searchQuery = model.required<string>();
  statusFilter = model.required<CategoryStateFilter>();
  stockFilter = model.required<CategoryStockFilter>();

  // Avisa que se pidió crear una categoría
  onAdd = output<void>();

  // Avisa que se guardó un orden nuevo
  onOrderChange = output<void>();

  showOrderModal = signal(false);
}
