import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { categoria } from '@shared/testing/categorias';
import { CategoriesListComponent } from './categories-list.component';

// En un teléfono la lista se dibuja como tarjetas, y ahí el nombre se cortaba con puntos suspensivos: con cinco niveles
// de categorías el nombre queda con ~190 px y el `title` con el nombre completo no se ve al tocar. En la tabla de
// escritorio (lg) las columnas son fijas y el corte con puntos suspensivos sigue siendo lo razonable.
describe('CategoriesListComponent: nombres largos', () => {
  it('en las tarjetas el nombre se parte en líneas y en la tabla se corta con puntos suspensivos', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CategoriesListComponent);
    fixture.componentRef.setInput('categories', [categoria(1, 'Mouses inalámbricos para juegos de alto rendimiento')]);
    fixture.detectChanges();

    const nombre = (fixture.nativeElement as HTMLElement).querySelector('span[title]') as HTMLElement;

    expect(nombre.textContent).toContain('Mouses inalámbricos para juegos de alto rendimiento');
    expect(nombre.classList.contains('wrap-break-word')).toBe(true);
    expect(nombre.classList.contains('lg:truncate')).toBe(true);
    expect(nombre.classList.contains('truncate')).toBe(false);
  });
});
