import { Component, input, inject, computed } from '@angular/core';
import { CartService } from '@services/cart.service';
import { AuthService } from '@services/auth.service';
import { AlertService } from '@services/alert.service';
import { IApiProduct } from '@models/product.model';
import { esComprable } from '@shared/utils/disponibilidad-producto';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapPlusLg,
  bootstrapDashLg,
} from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-add-to-cart-control',
  imports: [NgIconComponent],
  viewProviders: [
    provideIcons({
      bootstrapPlusLg,
      bootstrapDashLg,
    }),
  ],
  templateUrl: './add-to-cart-control.component.html',
})
export class AddToCartControlComponent {
  product = input.required<IApiProduct>();
  layout = input<'compact' | 'full'>('compact');

  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);

  currentQuantity = computed(() => {
    const items = this.cartService.items();
    return items.find((i) => i.product.id === this.product().id)?.quantity || 0;
  });

  // Un producto pausado o inactivo se ve pero no se puede comprar (ID 54 de discusiones.md)
  canBuy = computed(() => esComprable(this.product().state));

  // Calculo para ver si podemos agregar mas unidades basado en el stock
  canIncrease = computed(() => {
    const qty = this.currentQuantity();
    const stock = this.product().stock;
    return qty < stock;
  });

  addInitial(event: Event) {
    this.stopEvent(event);

    // PROVISIONAL-2026-11-09 (ID 68 de docs/requerimientos/discusiones.md): una cuenta de administrador
    // no puede hacer pedidos (el servidor responde "no se encontró el cliente"). Solución temporal hasta
    // decidir qué uso tendrá un carrito de administrador: se avisa en un modal en vez de agregar.
    if (this.authService.isAdmin()) {
      this.alertService.modal(
        'MODO ADMIN: carrito no habilitado',
        'Las cuentas de administrador no pueden hacer pedidos. Para comprar, ingresá con una cuenta de cliente.',
        'info',
      );
      return;
    }

    if (this.canBuy() && this.product().stock > 0) {
      this.cartService.addToCart(this.product(), 1);
    }
  }

  increment(event: Event) {
    this.stopEvent(event);
    if (this.canIncrease()) {
      this.cartService.updateQuantity(
        this.product().id,
        this.currentQuantity() + 1,
      );
    }
  }

  decrement(event: Event) {
    this.stopEvent(event);
    const newQty = this.currentQuantity() - 1;
    this.cartService.updateQuantity(this.product().id, newQty);
  }

  private stopEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }
}
