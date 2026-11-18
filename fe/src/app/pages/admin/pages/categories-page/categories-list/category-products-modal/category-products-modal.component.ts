import { Component, computed, input, output, signal } from '@angular/core';
import { IApiCategory } from '@models/category.model';
import { IProductSummary } from '@models/product.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapSearch,
  bootstrapBoxSeam,
  bootstrapPencilSquare,
  bootstrapArrowRightShort,
} from '@ng-icons/bootstrap-icons';
import {
  ModalShellComponent,
  ModalSubtitleDirective,
} from '@shared/components/modals/modal-shell/modal-shell.component';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { ProductoDelSubarbol } from '@shared/utils/category-tree';

@Component({
  selector: 'app-category-products-modal',
  imports: [
    ModalShellComponent,
    ModalSubtitleDirective,
    NgIconComponent,
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

  searchQuery = signal('');

  filteredProducts = computed(() => {
    const products = this.products();
    const query = this.searchQuery().toLowerCase().trim();

    if (!query) return products;

    return products.filter((p) => p.name.toLowerCase().includes(query));
  });
}
