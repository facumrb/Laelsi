import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UnderDevelopmentComponent } from '@shared/components/under-development/under-development.component';

@Component({
  selector: 'app-sellos-page',
  imports: [UnderDevelopmentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sellos-page.component.html',
})
export class SellosPageComponent {}
