import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { bootstrapExclamationTriangle } from '@ng-icons/bootstrap-icons';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';

@Component({
  selector: 'app-inactive-category-modal',
  imports: [ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ bootstrapExclamationTriangle })],
  templateUrl: './inactive-category-modal.component.html',
})
export class InactiveCategoryModalComponent {
  closed = output<void>();
}
