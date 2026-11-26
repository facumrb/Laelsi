import { Component, input, computed, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { IApiCategory, MAX_CATEGORY_DEPTH } from '@models/category.model';
import { aplanarCategorias } from '@shared/utils/category-tree';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';

@Component({
  selector: 'app-category-parent-select',
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

  // Categorías que se pueden elegir como madre (en orden de árbol)
  eligibleParents = computed(() => {
    const currentId = this.currentCategoryId();
    const allCats = this.categories();
    const childrenOf = (catId: number) =>
      allCats.filter((c) => (c.parentId ?? c.parent?.id ?? null) === catId);

    let validCats = allCats;
    // Niveles que tiene debajo la categoría que se edita (0 si no tiene hijas)
    let subtreeHeight = 0;
    if (currentId) {
      const descendants = new Set<number>();
      const walk = (catId: number, level: number) => {
        for (const child of childrenOf(catId)) {
          descendants.add(child.id);
          subtreeHeight = Math.max(subtreeHeight, level);
          walk(child.id, level + 1);
        }
      };
      walk(currentId, 1);

      // Ni ella misma ni sus descendientes pueden ser su madre
      validCats = allCats.filter(
        (c) => c.id !== currentId && !descendants.has(c.id),
      );
    }

    /*
    La madre tiene que dejar lugar para la categoría y todos sus niveles de abajo: con la madre en
    profundidad p, la última hija queda en p + 1 + subtreeHeight, que no puede pasar de
    MAX_CATEGORY_DEPTH. Sin hijas, se llega hasta el penúltimo nivel.
    */
    return aplanarCategorias(validCats, MAX_CATEGORY_DEPTH - 1 - subtreeHeight);
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
