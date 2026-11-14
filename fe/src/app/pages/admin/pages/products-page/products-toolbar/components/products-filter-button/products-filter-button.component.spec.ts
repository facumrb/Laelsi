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

// Con cinco niveles de sangría, un menú de 288 px dejaría ~125 px de texto a los niveles profundos: desde
// pantallas chicas en adelante (sm) el menú es más ancho; en un teléfono sigue limitado al 90% de la pantalla.
describe('ProductsFilterButtonComponent: ancho del menú', () => {
  it('el menú de filtros es más ancho desde sm y nunca pasa del 90% de la pantalla', () => {
    const fixture = TestBed.createComponent(ProductsFilterButtonComponent);
    fixture.componentRef.setInput('statusFilter', 'Todos');
    fixture.componentRef.setInput('stockFilter', 'Todos');
    fixture.componentRef.setInput('categoryFilter', 'Todos');
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.componentInstance.showFilterMenu.set(true);
    fixture.detectChanges();

    const menu = (fixture.nativeElement as HTMLElement).querySelector('.z-50') as HTMLElement;

    expect(menu.classList.contains('w-72')).toBe(true);
    expect(menu.classList.contains('sm:w-96')).toBe(true);
    expect(menu.classList.contains('max-w-[90vw]')).toBe(true);
  });

  // ID 64 (hallazgo 2): el botón es más angosto que el menú (384 px) hasta ~820 px de ancho, así que pegar el menú al
  // borde DERECHO del botón desde sm lo cortaría por el borde izquierdo de la ventana entre 640 y 768 px (hasta 70 px
  // fuera). Por eso, como en los filtros de Categorías, Clientes, Administradores y Órdenes, se pega a la derecha
  // recién desde lg, donde el botón queda lejos del borde izquierdo.
  it('el menú se alinea a la izquierda de su botón hasta lg y a la derecha desde lg, nunca desde sm', () => {
    const fixture = TestBed.createComponent(ProductsFilterButtonComponent);
    fixture.componentRef.setInput('statusFilter', 'Todos');
    fixture.componentRef.setInput('stockFilter', 'Todos');
    fixture.componentRef.setInput('categoryFilter', 'Todos');
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.componentInstance.showFilterMenu.set(true);
    fixture.detectChanges();

    const menu = (fixture.nativeElement as HTMLElement).querySelector('.z-50') as HTMLElement;

    expect(menu.classList.contains('left-0')).toBe(true);
    expect(menu.classList.contains('lg:left-auto')).toBe(true);
    expect(menu.classList.contains('lg:right-0')).toBe(true);
    expect(menu.classList.contains('lg:origin-top-right')).toBe(true);
    expect(menu.classList.contains('sm:left-auto')).toBe(false);
    expect(menu.classList.contains('sm:right-0')).toBe(false);
  });

  // En un teléfono el menú no puede ensancharse (tiene tope del 90% de la pantalla): el nombre de un nivel profundo se
  // parte en líneas en vez de cortarse con puntos suspensivos.
  it('un nombre más largo que el menú se parte en líneas, no se corta con puntos suspensivos', () => {
    const fixture = TestBed.createComponent(ProductsFilterButtonComponent);
    fixture.componentRef.setInput('statusFilter', 'Todos');
    fixture.componentRef.setInput('stockFilter', 'Todos');
    fixture.componentRef.setInput('categoryFilter', 'Todos');
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.componentInstance.showFilterMenu.set(true);
    fixture.componentInstance.showCategoryMenu.set(true);
    fixture.detectChanges();

    const lista = (fixture.nativeElement as HTMLElement).querySelector('.overflow-auto') as HTMLElement;

    expect(lista.querySelectorAll('span.wrap-break-word').length).toBe(6); // "Todas las categorías" + las cinco ofrecidas
    expect(lista.querySelectorAll('span.truncate').length).toBe(0);
  });
});
