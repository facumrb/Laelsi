import { Component, model, signal, computed } from '@angular/core';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { FilterButtonComponent } from '@shared/components/buttons/filter-button/filter-button.component';
import {
  FilterAccordionComponent,
  FilterOption,
} from '@shared/components/filter-accordion/filter-accordion.component';
import { UserStateFilter } from '@models/user.model';

// Botón "Filtros" de la pestaña de Administradores: filtra entre activos e inactivos
// (ID 65 de docs/requerimientos/discusiones.md)
@Component({
  selector: 'app-admins-filter-button',
  imports: [
    ClickOutsideDirective,
    FilterButtonComponent,
    FilterAccordionComponent,
  ],
  templateUrl: './admins-filter-button.component.html',
})
export class AdminsFilterButtonComponent {
  stateFilter = model.required<UserStateFilter>();

  showFilterMenu = signal(false);

  readonly stateOptions: FilterOption[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Activo', label: 'Activos' },
    { value: 'Inactivo', label: 'Inactivos' },
  ];

  hayFiltrosActivos = computed(() => this.stateFilter() !== 'Todos');

  limpiar(): void {
    this.stateFilter.set('Todos');
    this.showFilterMenu.set(false);
  }
}
