import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UnderDevelopmentComponent } from '@shared/components/under-development/under-development.component';

@Component({
  selector: 'app-impresiones-page',
  imports: [UnderDevelopmentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './impresiones-page.component.html',
})
export class ImpresionesPageComponent {}
