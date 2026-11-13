import {
  Component,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { IApiCategory } from '@models/category.model';
import { IProductSummary } from '@models/product.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapSearch,
  bootstrapBoxSeam,
  bootstrapPencilSquare,
  bootstrapArrowRightShort,
} from '@ng-icons/bootstrap-icons';
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { ProductoDelSubarbol } from '@shared/utils/category-tree';

import { BackdropCloseDirective } from '@shared/directives/backdrop-close.directive';

@Component({
  selector: 'app-category-products-modal',
  imports: [
    BackdropCloseDirective,
    FormsModule,
    A11yModule,
    NgIconComponent,
    CloseModalButtonComponent,
    SearchInputComponent,
    ProductImageComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapSearch,
      bootstrapBoxSeam,
      bootstrapPencilSquare,
      bootstrapArrowRightShort,
    }),
  ],
  templateUrl: './category-products-modal.component.html',
})
export class CategoryProductsModalComponent {
  category = input.required<IApiCategory>();
  // Los productos de la categoría y de todas sus subcategorías
  products = input.required<ProductoDelSubarbol[]>();
  close = output<void>();
  onNavigateToProduct = output<IProductSummary>();

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close.emit();
  }

  // Lógica del buscador interno
  searchQuery = signal('');

  // Productos filtrados
  filteredProducts = computed(() => {
    const products = this.products();
    const query = this.searchQuery().toLowerCase().trim();

    if (!query) return products;

    return products.filter((p) => p.name.toLowerCase().includes(query));
  });
}
