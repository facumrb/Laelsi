import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { bootstrapExclamationTriangle } from '@ng-icons/bootstrap-icons';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';
import { IApiCategory } from '@models/category.model';

// Por qué no se puede borrar la categoría
export type DeleteBlockReason = 'productos' | 'subcategorias';

@Component({
  selector: 'app-category-delete-blocked-modal',
  imports: [ModalShellComponent],
  viewProviders: [
    provideIcons({
      bootstrapExclamationTriangle,
    }),
  ],
  templateUrl: './category-delete-blocked-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryDeleteBlockedModalComponent {
  category = input.required<IApiCategory>();
  reason = input<DeleteBlockReason>('productos');
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }
}
