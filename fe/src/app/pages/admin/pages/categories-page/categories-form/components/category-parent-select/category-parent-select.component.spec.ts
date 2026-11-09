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

  // Lo que ve la persona: se abre el menú y se leen las opciones dibujadas (no solo la lista calculada), para
  // descartar que la plantilla imponga su propio tope de niveles.
  it('con el menú abierto, dibuja como madre posible hasta la categoría del cuarto nivel', () => {
    const fixture = TestBed.createComponent(CategoryParentSelectComponent);
    fixture.componentRef.setInput('control', new FormControl<number | null>(null));
    fixture.componentRef.setInput('categories', cadenaPlana());
    fixture.componentRef.setInput('currentCategoryId', null);
    fixture.componentRef.setInput('currentParentId', null);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('button#parentId')?.click();
    fixture.detectChanges();

    const opciones = Array.from(raiz.querySelectorAll('ul li span.block')).map((s) => (s.textContent ?? '').trim());

    expect(opciones).toEqual(['Tecnología', 'Computación', 'Periféricos', 'Mouses']);
  });
});
