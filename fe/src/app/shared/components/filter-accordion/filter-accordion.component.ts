import { Component, input, model, signal } from '@angular/core';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';

export interface FilterOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-filter-accordion',
  imports: [ClickOutsideDirective, ListboxDirective, NgIconComponent],
  viewProviders: [provideIcons({ bootstrapChevronDown, bootstrapCheckLg })],
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

  // Devuelve el label de la opción seleccionada actualmente
  selectedLabel(): string {
    const opt = this.options().find((o) => o.value === this.selected());
    return opt ? opt.label : this.selected();
  }

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
