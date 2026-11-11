import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Fila de carga de las tablas del panel: ocupa el lugar de una fila real (en escritorio y en tarjeta
// móvil) mientras llegan los datos, para que no se muestre el estado vacío antes de tiempo.

export const SKELETON_ROWS: readonly number[] = Array.from({ length: 8 }, (_, i) => i);

@Component({
  selector: '[app-table-skeleton]',
  templateUrl: './table-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'admin-table-row pointer-events-none',
    'aria-hidden': 'true',
  },
})
export class TableSkeletonComponent {
  columns = input.required<number>();

  protected middleColumns = computed(() =>
    Array.from({ length: Math.max(this.columns() - 2, 0) }, (_, i) => i),
  );
}
