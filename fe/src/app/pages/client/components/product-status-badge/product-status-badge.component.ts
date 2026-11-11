import { Component, computed, input } from '@angular/core';
import { ProductState } from '@models/product.model';
import { CategoryState } from '@models/category.model';

@Component({
  selector: 'app-product-status-badge',
  templateUrl: './product-status-badge.component.html',
})
export class ProductStatusBadgeComponent {
  productState = input.required<ProductState>();
  categoryState = input<CategoryState>();
  productStock = input.required<number>();

  /*
   'badge': Estilo compacto para tarjetas o listados.
   'banner': Estilo ancho completo para la página de producto.
   'overlay': Estilo con fondo oscuro para superponer en imágenes.
  */
  mode = input<'badge' | 'banner' | 'overlay'>('badge');

  // Producto PAUSADO: Se ve en la tienda como "no disponible por ahora", aunque tenga stock. Es distinto de Inactivo, que directamente no aparece.
  isTemporarilyUnavailable = computed(
    () =>
      this.productState() === ProductState.Pausado &&
      this.categoryState() !== CategoryState.Inactivo,
  );

  isPaused = computed(
    () =>
      this.productState() === ProductState.Inactivo ||
      this.categoryState() === CategoryState.Inactivo,
  );

  isOutOfStock = computed(
    () =>
      this.productState() === ProductState.Activo &&
      this.categoryState() !== CategoryState.Inactivo &&
      this.productStock() <= 0,
  );
}
