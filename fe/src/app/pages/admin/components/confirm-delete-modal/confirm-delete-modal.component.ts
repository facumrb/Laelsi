import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapExclamationTriangle,
  bootstrapPersonSlash,
} from '@ng-icons/bootstrap-icons';
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';

@Component({
  selector: 'app-confirm-delete-modal',
  imports: [A11yModule, NgIconComponent, CloseModalButtonComponent],
  viewProviders: [
    provideIcons({
      bootstrapExclamationTriangle,
      bootstrapPersonSlash,
    }),
  ],
  templateUrl: './confirm-delete-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDeleteModalComponent {
  entityName = input.required<string>();
  entityType = input<string>('registro');
  canDeactivate = input<boolean>(true);
  isDeactivated = input<boolean>(false);

  // Ofrecer también "Pausar" (productos): la ficha se sigue viendo como "no disponible por ahora".
  canPause = input<boolean>(false);

  // false = no se ofrece el borrado permanente (clientes y administradores: ID 65 de
  // docs/requerimientos/discusiones.md, por ahora solo desactivación lógica). El modal pasa a ser un
  // "Desactivar" que explica que no se borra nada.
  allowPermanentDelete = input<boolean>(true);

  confirmDelete = output<void>();
  confirmDeactivate = output<void>();
  confirmPause = output<void>();
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }

  onConfirmDelete(): void {
    this.confirmDelete.emit();
  }

  onConfirmDeactivate(): void {
    this.confirmDeactivate.emit();
  }

  onConfirmPause(): void {
    this.confirmPause.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.onClose();
  }
}
