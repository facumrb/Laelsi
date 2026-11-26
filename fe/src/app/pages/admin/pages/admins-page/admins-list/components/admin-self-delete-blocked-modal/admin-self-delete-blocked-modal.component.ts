import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { bootstrapExclamationTriangle } from '@ng-icons/bootstrap-icons';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';

@Component({
  selector: 'app-admin-self-delete-blocked-modal',
  imports: [ModalShellComponent],
  viewProviders: [
    provideIcons({
      bootstrapExclamationTriangle,
    }),
  ],
  templateUrl: './admin-self-delete-blocked-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSelfDeleteBlockedModalComponent {
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }
}
