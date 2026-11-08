import { describe, expect, it } from 'vitest';
import { IApiCategory, MAX_CATEGORY_DEPTH } from '@models/category.model';
import { cadenaPlana, categoria } from '@shared/testing/categorias';
import { aplanarCategorias } from './category-tree';

// Tecnología (1) > Computación (2) > Periféricos (3) > Mouses (4) > Inalámbricos (5), más Celulares (6), segunda
// hija de Tecnología, y una segunda raíz, Librería (7).
const ARBOL: IApiCategory[] = [...cadenaPlana(), categoria(6, 'Celulares', 1, 2), categoria(7, 'Librería', null, 2)];

const nombres = (lista: { name: string }[]) => lista.map((c) => c.name);

describe('aplanarCategorias', () => {
  it('lista cada categoría seguida de sus hijas, en orden', () => {
    expect(nombres(aplanarCategorias(ARBOL, MAX_CATEGORY_DEPTH))).toEqual([
      'Tecnología',
      'Computación',
      'Periféricos',
      'Mouses',
      'Inalámbricos',
      'Celulares',
      'Librería',
    ]);
  });

  it('le asigna a cada una su profundidad', () => {
    expect(aplanarCategorias(ARBOL, MAX_CATEGORY_DEPTH).map((c) => c.depth)).toEqual([0, 1, 2, 3, 4, 1, 0]);
  });

  it('corta en la profundidad pedida y deja afuera las más profundas', () => {
    expect(nombres(aplanarCategorias(ARBOL, 2))).toEqual(['Tecnología', 'Computación', 'Periféricos', 'Celulares', 'Librería']);
    expect(nombres(aplanarCategorias(ARBOL, 0))).toEqual(['Tecnología', 'Librería']);
  });

  it('con el máximo del sistema llega hasta el quinto nivel', () => {
    expect(nombres(aplanarCategorias(ARBOL, MAX_CATEGORY_DEPTH))).toContain('Inalámbricos');
    expect(MAX_CATEGORY_DEPTH).toBe(4);
  });

  it('ordena a las hermanas por su campo order', () => {
    const desordenadas = [categoria(2, 'B', null, 2), categoria(1, 'A', null, 1), categoria(3, 'A1', 1, 2), categoria(4, 'A0', 1, 1)];

    expect(nombres(aplanarCategorias(desordenadas, 4))).toEqual(['A', 'A0', 'A1', 'B']);
  });

  it('reconoce a la madre por parent.id cuando la categoría no trae parentId', () => {
    const conParent = [categoria(1, 'Madre'), { ...categoria(2, 'Hija'), parentId: undefined, parent: categoria(1, 'Madre') }];

    expect(aplanarCategorias(conParent, 4).map((c) => [c.name, c.depth])).toEqual([
      ['Madre', 0],
      ['Hija', 1],
    ]);
  });

  it('una lista vacía da una lista vacía', () => {
    expect(aplanarCategorias([], MAX_CATEGORY_DEPTH)).toEqual([]);
  });
});
