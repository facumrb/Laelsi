import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapTrash,
  bootstrapPlus,
  bootstrapDash,
  bootstrapCartX,
  bootstrapExclamationTriangleFill,
} from '@ng-icons/bootstrap-icons';
import { IApiProduct } from '@models/product.model';
import { CartService } from '@services/cart.service';
import { AlertService } from '@services/alert.service';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { mensajeDeConsultaPorWhatsApp } from '@shared/utils/disponibilidad-producto';
import { enlaceWhatsappTienda } from '@shared/utils/datos-tienda';
import { precioVigente } from '@shared/utils/precio-vigente';

@Component({
  selector: 'app-cart-items',
  imports: [CurrencyPipe, RouterLink, NgIconComponent, ProductImageComponent],
  viewProviders: [
    provideIcons({
      bootstrapTrash,
      bootstrapPlus,
      bootstrapDash,
      bootstrapCartX,
      bootstrapExclamationTriangleFill,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-items.component.html',
})
export class CartItemsComponent {
  private cartService = inject(CartService);
  private alertService = inject(AlertService);

  items = this.cartService.items;

  // Precio por unidad del producto (0 si no tiene uno vigente)
  getCurrentPrice(product: IApiProduct): number {
    return precioVigente(product.prices)?.amount ?? 0;
  }

  // Aviso de un producto pausado o inactivo
  availability(productId: number) {
    return this.cartService.availabilityOf(productId);
  }

  // Consulta prearmada por WhatsApp para saber cuándo vuelve un producto pausado
  whatsAppUrl(productName: string): string {
    return enlaceWhatsappTienda(mensajeDeConsultaPorWhatsApp(productName));
  }

  // Cambia la cantidad de un producto del carrito
  updateQuantity(productId: number, quantity: number) {
    this.cartService.updateQuantity(productId, quantity);
  }

  // Quita un producto del carrito
  removeItem(productId: number) {
    this.cartService.removeFromCart(productId);
  }

  // Vacía el carrito, previa confirmación
  async clearCart() {
    const isConfirmed = await this.alertService.confirmDelete(
      'Se eliminarán todos los productos seleccionados',
    );
    if (isConfirmed) {
      this.cartService.clearCart();
    }
  }
}
