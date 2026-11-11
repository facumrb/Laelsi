import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormatDatePipe } from '@shared/pipes/format-date.pipe';
import { NombrePersonaPipe } from '@shared/pipes/nombre-persona.pipe';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapBoxSeam,
  bootstrapPeople,
  bootstrapCart,
  bootstrapCurrencyDollar,
  bootstrapGraphUpArrow,
  bootstrapBagCheck,
  bootstrapReceipt,
} from '@ng-icons/bootstrap-icons';
import { OrderState, IApiOrder } from '@models/order.model';
import { OrderDetailModalComponent } from '@shared/components/modals/order-detail-modal/order-detail-modal.component';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { injectAnalyticsSummaryQuery } from '@services/queries/analytics-queries';
import { ActivableDirective } from '@shared/directives/activable.directive';

@Component({
  selector: 'app-analytics-page',
  imports: [
    ActivableDirective,
    RouterModule,
    NgIconComponent,
    CurrencyPipe,
    FormatDatePipe,
    NombrePersonaPipe,
    OrderDetailModalComponent,
    ProductImageComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapBoxSeam,
      bootstrapPeople,
      bootstrapCart,
      bootstrapCurrencyDollar,
      bootstrapGraphUpArrow,
      bootstrapBagCheck,
      bootstrapReceipt,
    }),
  ],
  templateUrl: './analytics-page.component.html',
})
export class AnalyticsPageComponent {
  // Capa de queries (TanStack Query): el servidor entrega el resumen ya calculado
  // (totales, últimas órdenes y más vendidos), sin traer listados completos para contarlos acá
  private summaryQuery = injectAnalyticsSummaryQuery();

  // Estados de la pantalla. Si la carga falla, el errorInterceptor ya avisó con un toast;
  // el error solo se muestra cuando no hay ningún dato anterior que seguir mostrando.
  loading = computed(() => this.summaryQuery.isPending());
  failed = computed(
    () => this.summaryQuery.isError() && !this.summaryQuery.data(),
  );
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private summary = computed(() => this.summaryQuery.data());

  totalRevenue = computed(() => this.summary()?.totalRevenue ?? 0);
  totalOrders = computed(() => this.summary()?.totalOrders ?? 0);
  totalProducts = computed(() => this.summary()?.totalProducts ?? 0);
  totalClients = computed(() => this.summary()?.totalClients ?? 0);

  recentOrders = computed(() => this.summary()?.recentOrders ?? []);
  bestSellingProducts = computed(
    () => this.summary()?.bestSellingProducts ?? [],
  );

  selectedOrder = signal<IApiOrder | null>(null);

  retry() {
    this.summaryQuery.refetch();
  }

  openOrderModal(order: IApiOrder) {
    this.selectedOrder.set(order);
  }

  closeOrderModal() {
    this.selectedOrder.set(null);
  }

  getOrderStatusColor(status: OrderState): string {
    switch (status) {
      case OrderState.Pending:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case OrderState.Paid:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case OrderState.Shipped:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case OrderState.Delivered:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case OrderState.Cancelled:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }
}
