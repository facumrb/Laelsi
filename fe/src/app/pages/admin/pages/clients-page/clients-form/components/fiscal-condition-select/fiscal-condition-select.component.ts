import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapCheckLg,
  bootstrapChevronDown,
} from '@ng-icons/bootstrap-icons';
import { FiscalCondition } from '@models/user.model';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';

// Color del punto de cada condición fiscal en el desplegable
const DOT_CLASS: Record<FiscalCondition, string> = {
  [FiscalCondition.ConsumidorFinal]: 'bg-gray-400',
  [FiscalCondition.ResponsableInscripto]: 'bg-blue-500',
  [FiscalCondition.Monotributista]: 'bg-orange-500',
  [FiscalCondition.Exento]: 'bg-green-500',
};

// Desplegable de la condición fiscal del cliente (formulario del panel)
@Component({
  selector: 'app-fiscal-condition-select',
  imports: [NgIconComponent, ClickOutsideDirective, ListboxDirective],
  viewProviders: [provideIcons({ bootstrapChevronDown, bootstrapCheckLg })],
  templateUrl: './fiscal-condition-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiscalConditionSelectComponent {
  // Control del formulario padre
  control = input.required<FormControl<FiscalCondition>>();

  readonly options = Object.values(FiscalCondition);
  readonly dotClass = DOT_CLASS;

  isOpen = signal(false);

  // Valor elegido, sincronizado con el control
  value = signal<FiscalCondition | null>(null);

  constructor() {
    effect((onCleanup) => {
      const ctrl = this.control();
      this.value.set(ctrl.value);
      const sub = ctrl.valueChanges.subscribe((v) => this.value.set(v));
      onCleanup(() => sub.unsubscribe());
    });
  }

  // Abre o cierra el menú
  toggle() {
    this.isOpen.update((v) => !v);
  }

  // Elige una condición y cierra el menú
  select(option: FiscalCondition) {
    this.control().setValue(option);
    this.isOpen.set(false);
  }
}
