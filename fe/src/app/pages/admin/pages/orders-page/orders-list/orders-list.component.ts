import { Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IApiOrder, OrderState, DeliveryMethod } from '@models/order.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapTruck,
  bootstrapShop,
  bootstrapCheckCircle,
  bootstrapXCircle,
  bootstrapClock,
  bootstrapCheck2All,
  bootstrapArrowRight,
} from '@ng-icons/bootstrap-icons';

import { TableEmptyStateComponent } from '@admin/components/table-components/table-empty-state/table-empty-state.component';
import {
  SKELETON_ROWS,
  TableSkeletonComponent,
} from '@admin/components/table-components/table-skeleton/table-skeleton.component';
import { NombrePersonaPipe } from '@shared/pipes/nombre-persona.pipe';
import { ActivableDirective } from '@shared/directives/activable.directive';

@Component({
  selector: 'app-orders-list',
  imports: [
    ActivableDirective,
    CurrencyPipe,
    NgIconComponent,
    RouterLink,
    TableEmptyStateComponent,
    TableSkeletonComponent,
    NombrePersonaPipe,
  ],
  viewProviders: provideIcons({
    bootstrapTruck,
    bootstrapShop,
    bootstrapCheckCircle,
    bootstrapXCircle,
    bootstrapClock,
    bootstrapCheck2All,
    bootstrapArrowRight,
  }),
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent {
  orders = input.required<IApiOrder[]>();
  isFilterActive = input<boolean>(false);

  // true mientras la página todavía no tiene datos que mostrar
  loading = input<boolean>(false);
  protected skeletonRows = SKELETON_ROWS;

  onUpdateStatus = output<{ id: number; status: OrderState }>();
  onUpdateDelivery = output<{ id: number; method: DeliveryMethod }>();
  onCancel = output<number>();
  onViewDetails = output<IApiOrder>();

  OrderState = OrderState;
  DeliveryMethod = DeliveryMethod;

  getStatusColor(status: OrderState): string {
    switch (status) {
      case OrderState.Pending:
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case OrderState.Paid:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case OrderState.Shipped:
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case OrderState.Delivered:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case OrderState.Cancelled:
        return 'bg-rose-100 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  getActionColor(status: OrderState): string {
    switch (status) {
      case OrderState.Paid:
        return 'bg-blue-600 text-white hover:bg-blue-700 border-transparent';
      case OrderState.Shipped:
        return 'bg-indigo-600 text-white hover:bg-indigo-700 border-transparent';
      case OrderState.Delivered:
        return 'bg-emerald-700 text-white hover:bg-emerald-800 border-transparent';
      default:
        return 'bg-gray-600 text-white hover:bg-gray-700 border-transparent';
    }
  }

  getStatusIcon(status: OrderState): string {
    switch (status) {
      case OrderState.Pending:
        return 'bootstrapClock';
      case OrderState.Paid:
        return 'bootstrapCheckCircle';
      case OrderState.Shipped:
        return 'bootstrapTruck';
      case OrderState.Delivered:
        return 'bootstrapCheck2All';
      case OrderState.Cancelled:
        return 'bootstrapXCircle';
      default:
        return 'bootstrapInbox';
    }
  }

  getNextStates(order: IApiOrder): OrderState[] {
    if (
      order.status === OrderState.Cancelled ||
      order.status === OrderState.Delivered
    ) {
      return [];
    }

    if (order.deliveryMethod === DeliveryMethod.Envio) {
      switch (order.status) {
        case OrderState.Pending:
          return [OrderState.Paid];
        case OrderState.Paid:
          return [OrderState.Shipped];
        case OrderState.Shipped:
          return [OrderState.Delivered];
        default:
          return [];
      }
    } else {
      switch (order.status) {
        case OrderState.Pending:
          return [OrderState.Paid];
        case OrderState.Paid:
          return [OrderState.Delivered];
        default:
          return [];
      }
    }
  }

  canTranslateDelivery(order: IApiOrder): boolean {
    return [OrderState.Pending, OrderState.Paid].includes(order.status);
  }
}
