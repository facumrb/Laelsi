import { Component, input, computed } from '@angular/core';
import { CategoryState } from '@models/category.model';
import { ProductState } from '@models/product.model';

// Los clientes y los administradores tienen el mismo par Activo / Inactivo, así que alcanza con el texto
export type EntityState = CategoryState | ProductState | 'Activo' | 'Inactivo' | 'Pausado';
export type BadgeMode = 'table' | 'card';

@Component({
  selector: 'app-entity-state-badge',
  templateUrl: './entity-state-badge.component.html',
})
export class EntityStateBadgeComponent {
  state = input.required<EntityState>();

  // Modo de visualización. Por defecto 'table'.
  mode = input<BadgeMode>('table');

  isActive = computed(() => this.state() === 'Activo');

  // Un producto Pausado se sigue viendo en la tienda (no disponible por ahora): ni verde ni rojo
  isPaused = computed(() => this.state() === 'Pausado');

  badgeClass = computed(() => {
    if (this.isActive()) return 'bg-green-50 text-green-700 border-green-200';
    if (this.isPaused()) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  });

  // Clase de color del punto indicador según el estado de la entidad.
  dotClass = computed(() => {
    if (this.isActive()) return 'bg-green-500';
    if (this.isPaused()) return 'bg-amber-500';
    return 'bg-red-500';
  });
}
