import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { cadenaPlana, NOMBRES_DE_LA_CADENA } from '@shared/testing/categorias';
import { ProductsFilterButtonComponent } from './products-filter-button.component';

// El filtro de productos por categoría tiene que poder elegir cualquiera de los cinco niveles.
describe('ProductsFilterButtonComponent: categorías para filtrar', () => {
  it('ofrece las categorías de los cinco niveles, de la raíz hacia abajo', () => {
    const fixture = TestBed.createComponent(ProductsFilterButtonComponent);
    fixture.componentRef.setInput('statusFilter', 'Todos');
    fixture.componentRef.setInput('stockFilter', 'Todos');
    fixture.componentRef.setInput('categoryFilter', 'Todos');
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.detectChanges();

    const ofrecidas = fixture.componentInstance.hierarchicalCategories();

    expect(ofrecidas.map((c) => c.name)).toEqual([...NOMBRES_DE_LA_CADENA]);
    expect(ofrecidas.map((c) => c.depth)).toEqual([0, 1, 2, 3, 4]);
  });
});
