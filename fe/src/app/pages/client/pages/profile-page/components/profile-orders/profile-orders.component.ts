import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
  output,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormatDatePipe } from '@shared/pipes/format-date.pipe';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapClockHistory,
  bootstrapBoxSeam,
  bootstrapCheckCircle,
  bootstrapXCircle,
} from '@ng-icons/bootstrap-icons';
import { IApiOrder, OrderState } from '@models/order.model';
import { OrderDetailModalComponent } from '@shared/components/modals/order-detail-modal/order-detail-modal.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { CancelOrderModalComponent } from '@shared/components/modals/cancel-order-modal/cancel-order-modal.component';

// Cómo se muestra la insignia de un estado de pedido
interface EstadoVisual {
  clase: string;
  icono: string;
}

const ESTADOS: Record<OrderState, EstadoVisual> = {
  [OrderState.Pending]: {
    clase: 'bg-amber-100 text-amber-700 border-amber-200',
    icono: 'bootstrapClockHistory',
  },
  [OrderState.Paid]: {
    clase: 'bg-blue-100 text-blue-700 border-blue-200',
    icono: 'bootstrapBoxSeam',
  },
  [OrderState.Shipped]: {
    clase: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icono: 'bootstrapCheckCircle',
  },
  [OrderState.Delivered]: {
    clase: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icono: 'bootstrapCheckCircle',
  },
  [OrderState.Cancelled]: {
    clase: 'bg-rose-100 text-rose-700 border-rose-200',
    icono: 'bootstrapXCircle',
  },
};

// Para un estado que la tienda todavía no conoce
const ESTADO_DESCONOCIDO: EstadoVisual = {
  clase: 'bg-gray-100 text-gray-700 border-gray-200',
  icono: 'bootstrapXCircle',
};

@Component({
  selector: 'app-profile-orders',
  imports: [
    NgIconComponent,
    CurrencyPipe,
    FormatDatePipe,
    OrderDetailModalComponent,
    PaginationComponent,
    CancelOrderModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      bootstrapClockHistory,
      bootstrapBoxSeam,
      bootstrapCheckCircle,
      bootstrapXCircle,
    }),
  ],
  templateUrl: './profile-orders.component.html',
})
export class ProfileOrdersComponent {
  // Los datos los pasa ProfilePageComponent al activar la pestaña
  orders = input<IApiOrder[]>([]);
  loading = input<boolean>(false);
  currentPage = input<number>(1);
  totalPages = input<number>(1);
  pageChange = output<number>();
  profileUpdated = output<void>();

  // Pedido abierto en el modal de detalle
  selectedOrder = signal<IApiOrder | null>(null);
  // Pedido que se está por cancelar
  orderIdToCancel = signal<number | null>(null);

  // Clase e ícono de la insignia de un estado
  estadoDe(status: OrderState | string): EstadoVisual {
    return ESTADOS[status as OrderState] ?? ESTADO_DESCONOCIDO;
  }

  // Abre el detalle de un pedido
  openModal(order: IApiOrder) {
    this.selectedOrder.set(order);
  }

  // Cierra el detalle
  closeModal() {
    this.selectedOrder.set(null);
  }

  // Abre la confirmación para cancelar un pedido
  handleCancel(id: number) {
    this.orderIdToCancel.set(id);
  }

  // El pedido se canceló: se cierran los modales y se recargan los datos
  handleOrderCancelled() {
    this.orderIdToCancel.set(null);
    this.closeModal();
    this.profileUpdated.emit();
  }

  onPageChange(page: number) {
    this.pageChange.emit(page);
  }
}
