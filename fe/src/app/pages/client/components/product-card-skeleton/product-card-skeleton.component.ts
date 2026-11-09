import { Component } from '@angular/core';

/**
 * Esqueleto de una tarjeta de producto (ID 70 de docs/requerimientos/discusiones.md). Ocupa el mismo lugar que la
 * tarjeta real (la misma proporción de imagen y un cuerpo de la misma altura) mientras cargan los datos, para que
 * la página no se corra cuando llegan: ese corrimiento es el salto de diseño (CLS) que mide Lighthouse. Es
 * decorativo: los lectores de pantalla lo ignoran (el aviso de "cargando" lo da la grilla).
 */
@Component({
  selector: 'app-product-card-skeleton',
  templateUrl: './product-card-skeleton.component.html',
  host: { 'aria-hidden': 'true', class: 'block h-full' },
})
export class ProductCardSkeletonComponent {}
