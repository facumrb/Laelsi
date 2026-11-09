import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapArrowCounterclockwise,
  bootstrapPencilSquare,
  bootstrapTrash,
} from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-table-actions',
  imports: [NgIconComponent],
  viewProviders: [
    provideIcons({
      bootstrapArrowCounterclockwise,
      bootstrapPencilSquare,
      bootstrapTrash,
    }),
  ],
  templateUrl: './table-actions.component.html',
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableActionsComponent<T> {
  // Recibimos el objeto genérico (Product, Category, Admin, Client, etc.)
  item = input.required<T>();

  // Clientes y administradores inactivos: en vez de "Eliminar" se ofrece "Reactivar" (ID 65 de discusiones.md)
  canDelete = input<boolean>(true);
  canReactivate = input<boolean>(false);

  onEdit = output<T>();
  onDelete = output<T>();
  onReactivate = output<T>();
}
