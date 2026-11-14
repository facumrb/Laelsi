import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapExclamationTriangle } from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-inactive-category-modal',
  imports: [NgIconComponent, CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ bootstrapExclamationTriangle })],
  templateUrl: './inactive-category-modal.component.html',
})
export class InactiveCategoryModalComponent {
  closed = output<void>();
}
