import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  signal,
} from '@angular/core';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { FilterButtonComponent } from '@shared/components/buttons/filter-button/filter-button.component';
import {
  FilterAccordionComponent,
  FilterOption,
} from '@shared/components/filter-accordion/filter-accordion.component';
import {
  FiscalCondition,
  FiscalConditionFilter,
  UserStateFilter,
} from '@models/user.model';

@Component({
  selector: 'app-clients-filter-button',
  imports: [
    ClickOutsideDirective,
    FilterButtonComponent,
    FilterAccordionComponent,
  ],
  templateUrl: './clients-filter-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsFilterButtonComponent {
  fiscalFilter = model.required<FiscalConditionFilter>();
  stateFilter = model.required<UserStateFilter>();

  showFilterMenu = signal(false);

  readonly stateOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Activo', label: 'Activos' },
    { value: 'Inactivo', label: 'Inactivos' },
  ];

  readonly fiscalOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: FiscalCondition.ConsumidorFinal, label: 'Consumidor Final' },
    {
      value: FiscalCondition.ResponsableInscripto,
      label: 'Responsable Inscripto',
    },
    { value: FiscalCondition.Monotributista, label: 'Monotributista' },
    { value: FiscalCondition.Exento, label: 'Exento' },
  ];

  hayFiltrosActivos = computed(
    () => this.fiscalFilter() !== 'Todos' || this.stateFilter() !== 'Todos',
  );

  limpiar(): void {
    this.fiscalFilter.set('Todos');
    this.stateFilter.set('Todos');
    this.showFilterMenu.set(false);
  }
}
