import { Component, inject, OnInit } from '@angular/core';
import { CartService } from '@services/cart.service';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapCartX } from '@ng-icons/bootstrap-icons';
import { CartItemsComponent } from './cart-items/cart-items.component';
import { OrderSummaryComponent } from './order-summary/order-summary.component';

@Component({
  selector: 'app-cart-page',
  imports: [
    RouterLink,
    NgIconComponent,
    CartItemsComponent,
    OrderSummaryComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapCartX,
    }),
  ],
  templateUrl: './cart-page.component.html',
})
export class CartPageComponent implements OnInit {
  private cartService = inject(CartService);

  items = this.cartService.items;
  totalItems = this.cartService.totalItems;

  ngOnInit(): void {
    // El carrito guarda una copia de cada producto: se pregunta cuáles se pausaron o desactivaron
    // desde que se agregaron, para avisarlo (ID 54 de docs/requerimientos/discusiones.md)
    this.cartService.refreshAvailability();
  }
}
