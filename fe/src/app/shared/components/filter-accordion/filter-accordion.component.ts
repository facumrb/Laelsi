import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';

let siguienteId = 0;

export interface FilterOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-filter-accordion',
  imports: [ClickOutsideDirective, ListboxDirective, NgIconComponent],
  viewProviders: [provideIcons({ bootstrapChevronDown, bootstrapCheckLg })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-accordion.component.html',
})
export class FilterAccordionComponent {
  // Título que se muestra arriba del botón (ej: "Filtrar por Estado")
  label = input.required<string>();

  // Lista de opciones disponibles
  options = input.required<FilterOption[]>();

  // Valor seleccionado actualmente
  selected = model.required<string>();

  // Estado interno: si el dropdown está abierto
  isOpen = signal(false);

  // ids del título y del valor elegido: juntos forman el nombre accesible del botón
  private readonly n = ++siguienteId;
  protected readonly labelId = `filter-accordion-${this.n}-titulo`;
  protected readonly valueId = `filter-accordion-${this.n}-valor`;

  // Devuelve el label de la opción seleccionada actualmente
  selectedLabel = computed(() => {
    const opt = this.options().find((o) => o.value === this.selected());
    return opt ? opt.label : this.selected();
  });

  // Selecciona una opción y cierra el dropdown
  select(value: string): void {
    this.selected.set(value);
    this.isOpen.set(false);
  }

  // Toggle del dropdown
  toggle(): void {
    this.isOpen.update((v) => !v);
  }
}
