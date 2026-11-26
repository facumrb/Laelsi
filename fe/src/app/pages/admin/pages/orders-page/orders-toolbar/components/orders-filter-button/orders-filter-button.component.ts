import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  signal,
} from '@angular/core';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { FilterButtonComponent } from '@shared/components/buttons/filter-button/filter-button.component';
import {
  FilterAccordionComponent,
  FilterOption,
} from '@shared/components/filter-accordion/filter-accordion.component';
import {
  DeliveryMethod,
  DeliveryMethodFilter,
  OrderState,
  OrderStatusFilter,
  PaymentMethod,
  PaymentMethodFilter,
} from '@models/order.model';

@Component({
  selector: 'app-orders-filter-button',
  imports: [
    ClickOutsideDirective,
    FilterButtonComponent,
    FilterAccordionComponent,
  ],
  templateUrl: './orders-filter-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersFilterButtonComponent {
  statusFilter = model.required<OrderStatusFilter>();
  deliveryMethodFilter = model.required<DeliveryMethodFilter>();
  paymentMethodFilter = model.required<PaymentMethodFilter>();

  showFilterMenu = signal(false);

  readonly statusOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: OrderState.Pending, label: 'Pendiente' },
    { value: OrderState.Paid, label: 'Pagado' },
    { value: OrderState.Shipped, label: 'Enviado' },
    { value: OrderState.Delivered, label: 'Entregado' },
    { value: OrderState.Cancelled, label: 'Cancelado' },
  ];

  readonly deliveryOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: DeliveryMethod.Envio, label: 'Envío' },
    { value: DeliveryMethod.RetiroSucursal, label: 'Retiro en sucursal' },
  ];

  readonly paymentOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: PaymentMethod.Transferencia, label: 'Transferencia' },
    { value: PaymentMethod.Local, label: 'Local' },
  ];

  // true si algún filtro no está en "Todos"
  hayFiltrosActivos = computed(
    () =>
      this.statusFilter() !== 'Todos' ||
      this.deliveryMethodFilter() !== 'Todos' ||
      this.paymentMethodFilter() !== 'Todos',
  );

  // Vuelve todos los filtros a "Todos" y cierra el menú
  limpiar(): void {
    this.statusFilter.set('Todos');
    this.deliveryMethodFilter.set('Todos');
    this.paymentMethodFilter.set('Todos');
    this.showFilterMenu.set(false);
  }
}
