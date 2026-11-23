import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';

// Encabezado de las pantallas de formulario del panel: título y botón "Volver"
@Component({
  selector: 'app-form-page-header',
  imports: [GoBackButtonComponent],
  host: { class: 'block' },
  templateUrl: './form-page-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormPageHeaderComponent {
  // Título de la pantalla
  title = input.required<string>();

  // Destino fijo de "Volver" (null = historial)
  backUrl = input<string | null>(null);

  // Destino de "Volver" cuando no hay historial
  fallbackUrl = input<string>('/');
}
