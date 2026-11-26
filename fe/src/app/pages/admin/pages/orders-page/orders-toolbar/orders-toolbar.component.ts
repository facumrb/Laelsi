import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import {
  DeliveryMethodFilter,
  OrderStatusFilter,
  PaymentMethodFilter,
} from '@models/order.model';
import { OrdersFilterButtonComponent } from './components/orders-filter-button/orders-filter-button.component';

@Component({
  selector: 'app-orders-toolbar',
  imports: [
    ToolbarTitleComponent,
    SearchInputComponent,
    OrdersFilterButtonComponent,
  ],
  templateUrl: './orders-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersToolbarComponent {
  searchQuery = model.required<string>();
  statusFilter = model.required<OrderStatusFilter>();
  deliveryMethodFilter = model.required<DeliveryMethodFilter>();
  paymentMethodFilter = model.required<PaymentMethodFilter>();
}
