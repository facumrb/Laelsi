import { Component, input, computed, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IApiCategory, MAX_CATEGORY_DEPTH } from '@models/category.model';
import { aplanarCategorias } from '@shared/utils/category-tree';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';

@Component({
  selector: 'app-category-parent-select',
  imports: [
    ReactiveFormsModule,
    ClickOutsideDirective,
    NgIconComponent,
    FieldErrorComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapChevronDown,
      bootstrapCheckLg,
    }),
  ],
  templateUrl: './category-parent-select.component.html',
})
export class CategoryParentSelectComponent {
  control = input.required<FormControl<number | null>>();
  categories = input.required<IApiCategory[]>();
  currentCategoryId = input<number | null>(null);
  currentParentId = input.required<number | null>();

  showParentMenu = signal(false);

  // Computada para categorías que pueden ser padres (en formato árbol plano)
  eligibleParents = computed(() => {
    const currentId = this.currentCategoryId();
    const allCats = this.categories();

    let validCats = allCats;
    if (currentId) {
      // Función recursiva para obtener todos los descendientes
      const getDescendantIds = (catId: number): number[] => {
        const children = allCats.filter(
          (c) => (c.parentId ?? c.parent?.id ?? null) === catId,
        );
        let ids = children.map((c) => c.id);
        children.forEach((c) => {
          ids = [...ids, ...getDescendantIds(c.id)];
        });
        return ids;
      };

      const descendants = getDescendantIds(currentId);
      validCats = allCats.filter(
        (c) => c.id !== currentId && !descendants.includes(c.id),
      );
    }

    // Listado "jerarquizado" ordenado por Categorías y Subcategorías. Una categoría que ya está en el último
    // nivel no puede tener hijas, así que no se ofrece como madre: por eso se llega hasta un nivel antes.
    return aplanarCategorias(validCats, MAX_CATEGORY_DEPTH - 1);
  });

  // Nombre del padre seleccionado
  parentName = computed(() => {
    const parentId = this.currentParentId();
    if (!parentId) return 'Ninguna (Categoría Raíz)';
    const parent = this.categories().find((c) => c.id === parentId);
    return parent ? parent.name : 'Ninguna (Categoría Raíz)';
  });

  toggleParentMenu() {
    this.showParentMenu.update((v) => !v);
  }

  selectParent(id: number | null) {
    this.control().setValue(id);
    this.showParentMenu.set(false);
  }
}
