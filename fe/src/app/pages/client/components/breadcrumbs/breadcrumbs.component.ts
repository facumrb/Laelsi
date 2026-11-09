import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronRight,
  bootstrapHouseDoor,
} from '@ng-icons/bootstrap-icons';

export interface BreadcrumbStep {
  label: string;
  url?: string;
}

// Cantidad máxima de pasos visibles (sin contar "Inicio") antes de colapsar el medio.
const MAX_VISIBLE = 3;

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, NgIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      bootstrapChevronRight,
      bootstrapHouseDoor,
    }),
  ],
  templateUrl: './breadcrumbs.component.html',
})
export class BreadcrumbsComponent {
  steps = input.required<BreadcrumbStep[]>();

  // Si hay demasiados pasos, se muestran el primero, "…" y los dos últimos.
  isCollapsed = computed(() => this.steps().length > MAX_VISIBLE);

  // Índices de los pasos del medio que quedan ocultos (siguen igualmente en el DOM por el microdata).
  private hiddenRange = computed(() => {
    const total = this.steps().length;
    return this.isCollapsed() ? { from: 1, to: total - 3 } : null;
  });

  isHidden(index: number): boolean {
    const range = this.hiddenRange();
    return !!range && index >= range.from && index <= range.to;
  }
}
