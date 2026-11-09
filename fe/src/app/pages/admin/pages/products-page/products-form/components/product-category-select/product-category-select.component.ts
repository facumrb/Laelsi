import { Component, input, computed, signal, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
    ReactiveFormsModule,
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
})
export class ProductCategorySelectComponent {
  control = input.required<FormControl<IApiCategory | null>>();
  categories = input.required<IApiCategory[]>();
  
  createCategory = output<void>();

  showCategoryMenu = signal(false);

  // Categorías en formato árbol plano, de la raíz hasta el último nivel que pueden crear los negocios: un
  // producto se puede cargar en cualquiera de ellas
  hierarchicalCategories = computed(() => aplanarCategorias(this.categories(), MAX_CATEGORY_DEPTH));

  // Nombre de la categoria seleccionada
  get selectedCategoryName() {
    const cat = this.control().value;
    if (!cat) return 'Seleccione una categoría';
    return cat.name;
  }

  toggleMenu() {
    this.showCategoryMenu.update((v) => !v);
  }

  selectCategory(cat: IApiCategory) {
    this.control().setValue(cat);
    this.showCategoryMenu.set(false);
  }
}
