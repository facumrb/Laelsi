import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { cadenaPlana } from '@shared/testing/categorias';
import { CategoryParentSelectComponent } from './category-parent-select.component';

// Una categoría nueva puede colgar de cualquiera que no esté en el último nivel: con cinco niveles, de las
// que están en los niveles 1 a 4. Al editar una categoría no se ofrecen ella ni sus descendientes.
describe('CategoryParentSelectComponent: madres posibles', () => {
  function madresPosibles(categoriaEditada: number | null): string[] {
    const fixture = TestBed.createComponent(CategoryParentSelectComponent);
    fixture.componentRef.setInput('control', new FormControl<number | null>(null));
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.componentRef.setInput('currentCategoryId', categoriaEditada);
    fixture.componentRef.setInput('currentParentId', null);
    fixture.detectChanges();
    return fixture.componentInstance.eligibleParents().map((c) => c.name);
  }

  it('al crear, ofrece las categorías de los cuatro primeros niveles y no la del quinto', () => {
    expect(madresPosibles(null)).toEqual(['Tecnología', 'Computación', 'Periféricos', 'Mouses']);
  });

  it('al editar, no ofrece la categoría editada ni sus descendientes', () => {
    expect(madresPosibles(3)).toEqual(['Tecnología', 'Computación']);
  });
});
