import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { IApiCategory, MAX_CATEGORY_DEPTH } from '@models/category.model';
import { aplanarCategorias } from '@shared/utils/category-tree';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
  bootstrapPlusLg,
} from '@ng-icons/bootstrap-icons';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';

@Component({
  selector: 'app-product-category-select',
  imports: [
    ClickOutsideDirective,
    ListboxDirective,
    NgIconComponent,
    FieldErrorComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapChevronDown,
      bootstrapCheckLg,
      bootstrapPlusLg,
    }),
  ],
  templateUrl: './product-category-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCategorySelectComponent {
  control = input.required<FormControl<IApiCategory | null>>();
  categories = input.required<IApiCategory[]>();

  createCategory = output<void>();

  showCategoryMenu = signal(false);

  /*
  Categorías en orden de árbol, de la raíz hasta el último nivel que se puede crear: un producto
  se puede cargar en cualquiera de ellas.
  */
  hierarchicalCategories = computed(() =>
    aplanarCategorias(this.categories(), MAX_CATEGORY_DEPTH),
  );

  // Categoría elegida, sincronizada con el control (así se redibuja aunque el padre sea OnPush)
  value = signal<IApiCategory | null>(null);

  // Nombre de la categoría seleccionada
  selectedCategoryName = computed(
    () => this.value()?.name ?? 'Seleccione una categoría',
  );

  constructor() {
    effect((onCleanup) => {
      const ctrl = this.control();
      this.value.set(ctrl.value);
      const sub = ctrl.valueChanges.subscribe((v) => this.value.set(v));
      onCleanup(() => sub.unsubscribe());
    });
  }

  toggleMenu() {
    this.showCategoryMenu.update((v) => !v);
  }

  selectCategory(cat: IApiCategory) {
    this.control().setValue(cat);
    this.showCategoryMenu.set(false);
  }
}
