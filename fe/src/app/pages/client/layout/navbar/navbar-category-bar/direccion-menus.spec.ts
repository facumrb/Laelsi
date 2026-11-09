import { describe, expect, it } from 'vitest';
import { IApiCategory } from '@models/category.model';
import { cadenaAnidada, categoria } from '@shared/testing/categorias';
import { direccionDeLosMenus, menusLateralesDeLaRama } from './direccion-menus';

const conHijas = (madre: IApiCategory, ...hijas: IApiCategory[]): IApiCategory => ({ ...madre, children: hijas });

// La barra de escritorio abre un menú desplegable debajo de la categoría y, desde el tercer nivel, un menú lateral
// por nivel hacia un costado. Con hasta cinco niveles pueden hacer falta tres menús laterales (unos 550 px): si la
// categoría está del lado derecho de la barra, a la derecha no entran y los últimos niveles quedan fuera de la
// pantalla, sin forma de llegar a ellos. Esta decisión elige hacia qué lado abrirlos.
describe('menusLateralesDeLaRama', () => {
  it('una categoría sin hijas no abre ningún menú', () => {
    expect(menusLateralesDeLaRama(categoria(1, 'Sola'))).toBe(0);
  });

  it('con solo hijas directas alcanza el desplegable: ningún menú lateral', () => {
    expect(menusLateralesDeLaRama(conHijas(categoria(1, 'Madre'), categoria(2, 'Hija', 1)))).toBe(0);
  });

  it('cada nivel más agrega un menú lateral: una cadena de cinco niveles necesita tres', () => {
    expect(menusLateralesDeLaRama(cadenaAnidada())).toBe(3);
  });

  it('cuenta por la rama más profunda, no por la primera', () => {
    const superficial = categoria(2, 'Superficial', 1);
    const profunda = conHijas(categoria(3, 'Profunda', 1), conHijas(categoria(4, 'Nieta', 3), categoria(5, 'Bisnieta', 4)));

    expect(menusLateralesDeLaRama(conHijas(categoria(1, 'Raíz'), superficial, profunda))).toBe(2);
  });
});

describe('direccionDeLosMenus', () => {
  it('abre a la derecha cuando hay lugar para todos los niveles', () => {
    expect(direccionDeLosMenus({ izquierdaDelDesplegable: 60, anchoDePantalla: 1440, menusLaterales: 3 })).toBe('derecha');
  });

  it('abre a la izquierda cuando a la derecha no entran pero a la izquierda sí', () => {
    expect(direccionDeLosMenus({ izquierdaDelDesplegable: 953, anchoDePantalla: 1440, menusLaterales: 3 })).toBe('izquierda');
  });

  it('sin menús laterales da igual dónde esté: se queda a la derecha', () => {
    expect(direccionDeLosMenus({ izquierdaDelDesplegable: 1300, anchoDePantalla: 1440, menusLaterales: 0 })).toBe('derecha');
  });

  it('si entran justo a la derecha, no hace falta cambiar de lado', () => {
    // Tres menús laterales ocupan 3 x (176 + 8) = 552 px. A la derecha del desplegable (que mide 200) sobran
    // 860 - 8 de margen - (100 + 200) = 552
    expect(direccionDeLosMenus({ izquierdaDelDesplegable: 100, anchoDePantalla: 860, menusLaterales: 3 })).toBe('derecha');
  });

  it('un píxel menos de lugar a la derecha y con lugar de sobra a la izquierda, cambia de lado', () => {
    expect(direccionDeLosMenus({ izquierdaDelDesplegable: 600, anchoDePantalla: 860, menusLaterales: 3 })).toBe('izquierda');
  });

  it('si no entran de ningún lado, elige el lado con más lugar', () => {
    // pantalla de 1024 px con la categoría a 535 px: a la izquierda sobran 527 y a la derecha 281
    expect(direccionDeLosMenus({ izquierdaDelDesplegable: 535, anchoDePantalla: 1024, menusLaterales: 3 })).toBe('izquierda');
    // y al revés: a la derecha sobran 392 y a la izquierda 292
    expect(direccionDeLosMenus({ izquierdaDelDesplegable: 300, anchoDePantalla: 900, menusLaterales: 3 })).toBe('derecha');
  });
});
