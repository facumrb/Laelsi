import { EntityStateBadgeComponent } from '@admin/components/table-components/entity-state-badge/entity-state-badge.component';
import { TableActionsComponent } from '@admin/components/table-components/table-actions/table-actions.component';
import { CurrencyPipe } from '@angular/common';
import { Component, input, output, model } from '@angular/core';
import { IApiProduct } from '@models/product.model';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapCheck } from '@ng-icons/bootstrap-icons';
import { TableEmptyStateComponent } from '@admin/components/table-components/table-empty-state/table-empty-state.component';
import {
  SKELETON_ROWS,
  TableSkeletonComponent,
} from '@admin/components/table-components/table-skeleton/table-skeleton.component';
import { ActivableDirective } from '@shared/directives/activable.directive';

@Component({
  selector: 'app-products-list',
  imports: [
    ActivableDirective,
    CurrencyPipe,
    TableActionsComponent,
    NgIconComponent,
    TableEmptyStateComponent,
    TableSkeletonComponent,
    EntityStateBadgeComponent,
    ProductImageComponent,
  ],
  viewProviders: provideIcons({
    bootstrapCheck,
  }),
  templateUrl: './products-list.component.html',
})
export class ProductsListComponent {
  products = input.required<IApiProduct[]>();
  onEdit = output<IApiProduct>();
  onDelete = output<IApiProduct>();
  isFilterActive = input<boolean>(false);

  // true mientras la página todavía no tiene datos que mostrar
  loading = input<boolean>(false);
  protected skeletonRows = SKELETON_ROWS;

  selectedIds = model<number[]>([]);

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  isAllSelected(): boolean {
    return (
      this.products().length > 0 &&
      this.products().every((p) => this.selectedIds().includes(p.id))
    );
  }

  toggleSelect(id: number) {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set(this.products().map((p) => p.id));
    }
  }

  getProductPrice(product: IApiProduct): number {
    const currentPrice = product.prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.amount : 0;
  }

  getProductCurrency(product: IApiProduct): string {
    const currentPrice = product.prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.currency : 'ARS';
  }
}
