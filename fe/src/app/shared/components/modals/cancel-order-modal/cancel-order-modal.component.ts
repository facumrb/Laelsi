import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';
import { ApiOrderService } from '@services/api-services/api-order.service';
import { AlertService } from '@services/alert.service';
import { IApiOrder } from '@models/order.model';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';

@Component({
  selector: 'app-cancel-order-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShellComponent],
  templateUrl: './cancel-order-modal.component.html',
})
export class CancelOrderModalComponent {
  orderId = input.required<number>();
  variant = input<'admin' | 'client'>('admin');
  close = output<void>();
  orderCancelled = output<IApiOrder>();

  protected readonly titulo = computed(
    () =>
      `${this.variant() === 'client' ? 'Pedido' : 'Orden'} #${this.orderId()}`,
  );

  private orderService = inject(ApiOrderService);
  private alertService = inject(AlertService);
  private invalidateCatalog = injectInvalidateCatalog();

  // Mientras viaja la cancelación el modal no se cierra y los botones quedan desactivados
  protected readonly enviando = signal(false);

  onConfirm() {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.orderService
      .cancelOrder(this.orderId())
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (updatedOrder) => {
          // Al cancelar se restaura el stock: invalidamos el caché de productos
          this.invalidateCatalog();
          const successMsg =
            this.variant() === 'client'
              ? 'Pedido cancelado correctamente'
              : 'Orden cancelada correctamente';
          this.alertService.toast(successMsg, 'success');
          this.orderCancelled.emit(updatedOrder);
          this.close.emit();
        },
      });
  }

  onClose() {
    this.close.emit();
  }
}
