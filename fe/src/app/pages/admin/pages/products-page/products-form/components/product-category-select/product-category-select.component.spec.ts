import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { IApiCategory } from '@models/category.model';
import { cadenaPlana, NOMBRES_DE_LA_CADENA } from '@shared/testing/categorias';
import { ProductCategorySelectComponent } from './product-category-select.component';

// Un producto se puede cargar en cualquier categoría. Si el selector corta en el tercer nivel, los productos
// de las categorías más profundas no se pueden cargar ni mover.
describe('ProductCategorySelectComponent: categorías ofrecidas', () => {
  it('ofrece las categorías de los cinco niveles, de la raíz hacia abajo', () => {
    const fixture = TestBed.createComponent(ProductCategorySelectComponent);
    fixture.componentRef.setInput('control', new FormControl<IApiCategory | null>(null));
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.detectChanges();

    const ofrecidas = fixture.componentInstance.hierarchicalCategories();

    expect(ofrecidas.map((c) => c.name)).toEqual([...NOMBRES_DE_LA_CADENA]);
    expect(ofrecidas.map((c) => c.depth)).toEqual([0, 1, 2, 3, 4]);
  });
});
