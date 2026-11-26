import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DeliveryMethod,
  DeliveryMethodFilter,
  IApiOrder,
  OrderState,
  OrderStatusFilter,
  PaymentMethodFilter,
} from '@models/order.model';
import { ApiOrderService } from '@services/api-services/api-order.service';
import { AlertService } from '@services/alert.service';
import { CancelOrderModalComponent } from '@shared/components/modals/cancel-order-modal/cancel-order-modal.component';
import { OrdersListComponent } from './orders-list/orders-list.component';
import { OrdersToolbarComponent } from './orders-toolbar/orders-toolbar.component';
import { OrderDetailModalComponent } from '@shared/components/modals/order-detail-modal/order-detail-modal.component';
import { Router, ActivatedRoute } from '@angular/router';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { catchError, finalize, of, Subject, switchMap } from 'rxjs';

@Component({
  selector: 'app-orders-page',
  imports: [
    OrdersListComponent,
    OrdersToolbarComponent,
    OrderDetailModalComponent,
    CancelOrderModalComponent,
    PaginationComponent,
  ],
  templateUrl: './orders-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPageComponent implements OnInit {
  private alertService = inject(AlertService);
  private orderService = inject(ApiOrderService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Órdenes de la página actual
  private ordersRaw = signal<IApiOrder[]>([]);
  orders = this.ordersRaw.asReadonly();
  currentPage = signal(1);
  totalPages = signal(1);
  /*
  Solo cubre la primera carga: al cambiar de página o de filtro se siguen viendo las órdenes
  anteriores.
  */
  loading = signal(true);

  searchQuery = signal<string>('');
  statusFilter = signal<OrderStatusFilter>('Todos');
  deliveryMethodFilter = signal<DeliveryMethodFilter>('Todos');
  paymentMethodFilter = signal<PaymentMethodFilter>('Todos');
  // Orden que se muestra en el modal de detalle
  selectedOrderForModal = signal<IApiOrder | null>(null);
  // Id de la orden que se está por cancelar (abre el modal de cancelar)
  orderIdToCancel = signal<number | null>(null);
  // Ids de las órdenes con un cambio de estado o de entrega en curso
  private updatingIds = signal<ReadonlySet<number>>(new Set());

  // Pedidos de carga de órdenes
  private loadRequests = new Subject<void>();

  // true si hay alguna búsqueda o filtro activo
  filtersActive = computed(() => {
    return (
      this.searchQuery() !== '' ||
      this.statusFilter() !== 'Todos' ||
      this.deliveryMethodFilter() !== 'Todos' ||
      this.paymentMethodFilter() !== 'Todos'
    );
  });

  constructor() {
    /*
    Cada carga nueva cancela la anterior (switchMap): así la respuesta lenta de una búsqueda vieja
    no pisa la de la actual.
    */
    this.loadRequests
      .pipe(
        switchMap(() => {
          const filters = {
            query: this.searchQuery(),
            status: this.statusFilter(),
            deliveryMethod: this.deliveryMethodFilter(),
            paymentMethod: this.paymentMethodFilter(),
          };
          return (
            this.orderService
              .getAllOrders(this.currentPage(), 10, filters)
              // El errorInterceptor ya avisó con un toast
              .pipe(catchError(() => of(null)))
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((data) => {
        if (data) {
          this.ordersRaw.set(data.data);
          this.totalPages.set(data.totalPages);
        }
        this.loading.set(false);
      });

    /*
    Al cambiar cualquier filtro se vuelve a la página 1 y se recarga. La primera ejecución se
    saltea: la carga inicial la hace ngOnInit con la página de la URL.
    */
    let firstRun = true;
    effect(() => {
      this.searchQuery();
      this.statusFilter();
      this.deliveryMethodFilter();
      this.paymentMethodFilter();
      untracked(() => {
        if (firstRun) {
          firstRun = false;
          return;
        }
        this.currentPage.set(1);
        this.loadOrders();
      });
    });
  }

  ngOnInit() {
    const pageParam = this.route.snapshot.queryParamMap.get('page');
    this.currentPage.set(Number(pageParam) || 1);
    this.loadOrders();
  }

  // Pide las órdenes de la página actual con los filtros actuales
  loadOrders() {
    this.loadRequests.next();
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
    this.loadOrders();
  }

  openOrderDetail(order: IApiOrder) {
    this.selectedOrderForModal.set(order);
  }

  closeOrderDetail() {
    this.selectedOrderForModal.set(null);
  }

  handleUpdateStatus(event: { id: number; status: OrderState }) {
    if (!this.startUpdate(event.id)) return;

    this.orderService
      .updateStatus(event.id, event.status)
      .pipe(finalize(() => this.endUpdate(event.id)))
      .subscribe({
        next: (updatedOrder) => {
          this.alertService.toast(
            `Orden #${event.id} pasó a ${event.status}`,
            'success',
          );
          this.updateOrderInList(updatedOrder);
        },
      });
  }

  handleUpdateDelivery(event: { id: number; method: DeliveryMethod }) {
    if (!this.startUpdate(event.id)) return;

    this.orderService
      .updateDeliveryMethod(event.id, event.method)
      .pipe(finalize(() => this.endUpdate(event.id)))
      .subscribe({
        next: (updatedOrder) => {
          this.alertService.toast(
            `Método actualizado a "${event.method}"`,
            'success',
          );
          this.updateOrderInList(updatedOrder);
        },
      });
  }

  handleCancel(id: number) {
    this.orderIdToCancel.set(id);
  }

  handleOrderCancelled(updatedOrder: IApiOrder) {
    this.updateOrderInList(updatedOrder);
    this.orderIdToCancel.set(null);
    this.selectedOrderForModal.set(null);
  }

  // Marca la orden como en actualización. Devuelve false si ya tenía un cambio en curso
  private startUpdate(id: number): boolean {
    if (this.updatingIds().has(id)) return false;
    this.updatingIds.update((ids) => new Set(ids).add(id));
    return true;
  }

  // Quita la marca de actualización de la orden
  private endUpdate(id: number) {
    this.updatingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  // Reemplaza en la lista la orden que devolvió el servidor
  private updateOrderInList(updatedOrder: IApiOrder) {
    this.ordersRaw.update((current) =>
      current.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
    );
  }
}
