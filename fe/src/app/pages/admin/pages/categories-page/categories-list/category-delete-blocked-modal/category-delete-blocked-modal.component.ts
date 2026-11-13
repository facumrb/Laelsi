import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapExclamationTriangle } from '@ng-icons/bootstrap-icons';
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';
import { IApiCategory } from '@models/category.model';

import { BackdropCloseDirective } from '@shared/directives/backdrop-close.directive';

@Component({
  selector: 'app-category-delete-blocked-modal',
  imports: [
    BackdropCloseDirective,
    A11yModule,
    NgIconComponent,
    CloseModalButtonComponent,
  ],
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
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.onClose();
  }
}
