import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UnderDevelopmentComponent } from '@shared/components/under-development/under-development.component';

@Component({
  selector: 'app-diseno-grafico-page',
  imports: [UnderDevelopmentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diseno-grafico-page.component.html',
})
export class DisenoGraficoPageComponent {}
