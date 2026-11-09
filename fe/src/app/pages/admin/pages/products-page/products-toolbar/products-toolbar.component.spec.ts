import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProductsToolbarComponent } from './products-toolbar.component';

// ID 64 (hallazgo 3): a 1024 px de ancho, con el menú lateral abierto, quedan ~770 px para el contenido. La fila de
// controles (buscar, actualizar precios, filtros y agregar) mide más que eso y, al no poder envolver, el botón
// "Agregar Producto" se salía de la ventana: se veía "+ Agreg…" con ~90 px fuera. Con `flex-wrap` la fila baja a una
// segunda línea cuando no entra.
describe('ProductsToolbarComponent: la fila de controles envuelve en vez de salirse de la ventana', () => {
  function crear() {
    const fixture = TestBed.createComponent(ProductsToolbarComponent);
    fixture.componentRef.setInput('searchQuery', '');
    fixture.componentRef.setInput('statusFilter', 'Todos');
    fixture.componentRef.setInput('stockFilter', 'Todos');
    fixture.componentRef.setInput('categoryFilter', 'Todos');
    fixture.componentRef.setInput('categories', []);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('el grupo de controles puede envolver desde lg, que es cuando se pone en fila', () => {
    const grupo = crear().querySelector<HTMLElement>('.toolbar-container > div')!;

    expect(grupo.classList.contains('lg:flex-row')).toBe(true);
    expect(grupo.classList.contains('lg:flex-wrap')).toBe(true);
    expect(grupo.classList.contains('lg:justify-end')).toBe(true);
  });

  it('el botón de agregar sigue estando y dice "Agregar Producto"', () => {
    const boton = crear().querySelector<HTMLButtonElement>('app-create-entity-button button')!;

    // Los dos <span> van separados por el gap del botón, no por un espacio
    expect(boton.textContent?.replace(/\s+/g, '')).toBe('AgregarProducto');
  });
});
