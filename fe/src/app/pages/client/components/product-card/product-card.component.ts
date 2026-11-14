import { Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IApiProduct } from '@models/product.model';
import { ProductStatusBadgeComponent } from '@client/components/product-status-badge/product-status-badge.component';
import { AddToCartControlComponent } from '@client/components/add-to-cart-control/add-to-cart-control.component';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';

@Component({
  selector: 'app-product-card',
  imports: [
    CurrencyPipe,
    RouterLink,
    ProductStatusBadgeComponent,
    AddToCartControlComponent,
    ProductImageComponent,
  ],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  product = input.required<IApiProduct>();
  // Para las tarjetas que se ven sin hacer scroll: su foto carga ya y con prioridad alta
  prioritaria = input(false);
  imageFileName = computed(() => {
    const photos = this.product().photos;
    if (!photos || photos.length === 0) return null;
    const mainPhoto = photos.find((p) => p.order === 0);
    return (mainPhoto || photos[0]).fileName;
  });

  price = computed(() => {
    const currentPrice = this.product().prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.amount : 0;
  });

  currency = computed(() => {
    const currentPrice = this.product().prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.currency : 'ARS';
  });
}
