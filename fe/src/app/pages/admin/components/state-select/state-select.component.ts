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
import {
  EntityState,
  entityStateDotClass,
} from '@admin/components/table-components/entity-state-badge/entity-state-badge.component';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';

// Desplegable de "Estado" de los formularios del panel (productos y categorías)
@Component({
  selector: 'app-state-select',
  imports: [
    NgIconComponent,
    ClickOutsideDirective,
    ListboxDirective,
    FieldErrorComponent,
  ],
  viewProviders: [provideIcons({ bootstrapChevronDown, bootstrapCheckLg })],
  templateUrl: './state-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateSelectComponent {
  // Control del formulario padre
  control = input.required<FormControl<EntityState>>();

  // Estados que se ofrecen, en el orden en que se muestran
  options = input.required<readonly EntityState[]>();

  // id del botón (lo usa el label con for)
  inputId = input<string>('state');

  // Clases extra del botón (el foco cambia según el formulario)
  triggerClass = input<string>('');

  readonly dotClass = entityStateDotClass;

  isOpen = signal(false);

  // Estado elegido, sincronizado con el control
  value = signal<EntityState | null>(null);

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

  // Elige un estado y cierra el menú
  select(option: EntityState) {
    this.control().setValue(option);
    this.isOpen.set(false);
  }
}
