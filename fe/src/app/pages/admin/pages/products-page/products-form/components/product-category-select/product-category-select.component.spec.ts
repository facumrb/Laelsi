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

// Cada nivel suma sangría y el desplegable medía lo mismo que su botón (unos 200 px en una tablet), así que los
// niveles 4 y 5 quedaban con ~70 px de texto: "Mouses inalá…". El desplegable puede crecer más allá del botón, hasta un
// tope que entra en cualquier pantalla (ver la prueba en el navegador con un árbol de 5 niveles).
describe('ProductCategorySelectComponent: ancho del desplegable', () => {
  it('el desplegable puede ser más ancho que el botón, con un tope que entra en la pantalla', () => {
    const fixture = TestBed.createComponent(ProductCategorySelectComponent);
    fixture.componentRef.setInput('control', new FormControl<IApiCategory | null>(null));
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.componentInstance.toggleMenu();
    fixture.detectChanges();

    const desplegable = (fixture.nativeElement as HTMLElement).querySelector('.select-dropdown') as HTMLElement;

    expect(desplegable.classList.contains('min-w-full')).toBe(true); // nunca más angosto que el botón
    expect(desplegable.classList.contains('w-max')).toBe(true); // crece hasta lo que ocupa el nombre más largo
    // pero no se sale de la pantalla: se descuenta el margen del formulario (en un teléfono de 360 px el desplegable
    // terminaba 9 px más allá del borde con 100vw-2rem)
    expect(desplegable.className).toContain('max-w-[min(28rem,calc(100vw-4rem))]');
    expect(desplegable.classList.contains('w-full')).toBe(false);
  });

  it('un nombre más largo que el desplegable se parte en líneas, no se corta con puntos suspensivos', () => {
    const fixture = TestBed.createComponent(ProductCategorySelectComponent);
    fixture.componentRef.setInput('control', new FormControl<IApiCategory | null>(null));
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.componentInstance.toggleMenu();
    fixture.detectChanges();

    const desplegable = (fixture.nativeElement as HTMLElement).querySelector('.select-dropdown') as HTMLElement;
    const nombres = desplegable.querySelectorAll('span.wrap-break-word');

    expect(nombres.length).toBe(5); // una por categoría ofrecida
    expect(desplegable.querySelectorAll('span.truncate').length).toBe(0);
  });
});
