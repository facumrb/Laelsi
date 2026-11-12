import { Component, HostListener, inject, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';
import { ApiOrderService } from '@services/api-services/api-order.service';
import { AlertService } from '@services/alert.service';
import { IApiOrder } from '@models/order.model';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';

import { BackdropCloseDirective } from '@shared/directives/backdrop-close.directive';

@Component({
  selector: 'app-cancel-order-modal',
  imports: [BackdropCloseDirective, CloseModalButtonComponent, A11yModule],
  templateUrl: './cancel-order-modal.component.html',
})
export class CancelOrderModalComponent {
  orderId = input.required<number>();
  variant = input<'admin' | 'client'>('admin');
  close = output<void>();
  orderCancelled = output<IApiOrder>();

  private orderService = inject(ApiOrderService);
  private alertService = inject(AlertService);
  private invalidateCatalog = injectInvalidateCatalog();

  onConfirm() {
    this.orderService.cancelOrder(this.orderId()).subscribe({
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

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.close.emit();
  }
}
