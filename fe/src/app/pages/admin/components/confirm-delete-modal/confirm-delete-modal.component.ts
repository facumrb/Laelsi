import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  bootstrapExclamationTriangle,
  bootstrapPersonSlash,
} from '@ng-icons/bootstrap-icons';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';

@Component({
  selector: 'app-confirm-delete-modal',
  imports: [ModalShellComponent],
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

  protected readonly titulo = computed(
    () => `${this.allowPermanentDelete() ? 'Eliminar' : 'Desactivar'} ${this.entityType()}`,
  );

  // Etiqueta de la línea del nombre; evita resolver el artículo y el género del tipo.
  protected readonly etiqueta = computed(() => {
    const tipo = this.entityType();
    const accion = this.allowPermanentDelete() ? 'eliminar' : 'desactivar';
    return `${tipo.charAt(0).toUpperCase()}${tipo.slice(1)} a ${accion}`;
  });

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
}
