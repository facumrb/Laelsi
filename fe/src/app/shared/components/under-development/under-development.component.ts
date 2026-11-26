import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapTools } from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-under-development',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  viewProviders: [
    provideIcons({
      bootstrapTools,
    }),
  ],
  templateUrl: './under-development.component.html',
})
export class UnderDevelopmentComponent {
  sectionName = input<string>('');
}
