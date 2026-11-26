import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapFunnel,
  bootstrapFunnelFill,
} from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-filter-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  host: {
    class: 'block w-full h-full sm:w-auto',
  },
  viewProviders: [
    provideIcons({
      bootstrapFunnel,
      bootstrapFunnelFill,
    }),
  ],
  templateUrl: './filter-button.component.html',
})
export class FilterButtonComponent {
  isActive = input<boolean>(false);
  isOpen = model.required<boolean>();

  toggle() {
    this.isOpen.update((v) => !v);
  }
}
