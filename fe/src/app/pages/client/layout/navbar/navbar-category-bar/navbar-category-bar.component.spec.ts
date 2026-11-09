import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IApiCategory } from '@models/category.model';
import { cadenaAnidada, categoria } from '@shared/testing/categorias';
import { DEMORA_MENU_LATERAL_MS, NavbarCategoryBarComponent } from './navbar-category-bar.component';

// La barra de escritorio abre un menú por nivel, hacia la derecha. Antes solo sabía dibujar tres niveles; los
// negocios pueden crear hasta cinco y los de más abajo no aparecían en ningún menú.
describe('NavbarCategoryBarComponent: niveles', () => {
  function barra(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NavbarCategoryBarComponent);
    fixture.componentRef.setInput('categories', [cadenaAnidada()]);
    fixture.componentRef.setInput('activeCategoryIds', new Set<number>());
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('ofrece un enlace para cada uno de los cinco niveles', () => {
    const enlaces = Array.from(barra().querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(enlaces).toContain('/category/1');
    expect(enlaces).toContain('/category/2');
    expect(enlaces).toContain('/category/3');
    expect(enlaces).toContain('/category/4');
    expect(enlaces).toContain('/category/5');
  });

  it('abre un menú lateral por cada nivel que tiene hijas, desde el tercero', () => {
    // El nivel 2 está en el desplegable de la raíz; los niveles 3, 4 y 5 aparecen cada uno en un menú lateral
    expect(barra().querySelectorAll('.navbar-subdropdown').length).toBe(3);
  });

  it('sigue mostrando los enlaces fijos del final de la barra', () => {
    const enlaces = Array.from(barra().querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(enlaces).toContain('/impresiones');
    expect(enlaces).toContain('/sellos');
  });
});

// Con cinco niveles los menús laterales ocupan unos 550 px. Si la categoría está del lado derecho de la barra, a la
// derecha no entran y los últimos niveles quedan fuera de la pantalla, sin forma de llegar a ellos: ahí se abren
// hacia la izquierda. La decisión se toma al pasar el mouse por la categoría, midiendo dónde quedó su desplegable.
describe('NavbarCategoryBarComponent: hacia qué lado se abren los menús', () => {
  const anchoOriginal = window.innerWidth;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: anchoOriginal });
  });

  /** Pasa el mouse por la categoría de la rama profunda, con el desplegable a `izquierdaDelDesplegable` px. */
  function conElMousePorLaCategoria(izquierdaDelDesplegable: number, anchoDePantalla: number): HTMLElement {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: anchoDePantalla });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: izquierdaDelDesplegable } as DOMRect);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NavbarCategoryBarComponent);
    fixture.componentRef.setInput('categories', [cadenaAnidada()]);
    fixture.componentRef.setInput('activeCategoryIds', new Set<number>());
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector('.group')?.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    return raiz;
  }

  it('los abre hacia la izquierda cuando a la derecha no hay lugar', () => {
    const menus = Array.from(conElMousePorLaCategoria(953, 1440).querySelectorAll('.navbar-subdropdown'));

    expect(menus.length).toBe(3);
    expect(menus.map((m) => m.classList.contains('navbar-subdropdown-izquierda'))).toEqual([true, true, true]);
  });

  it('los deja hacia la derecha cuando hay lugar', () => {
    const menus = Array.from(conElMousePorLaCategoria(60, 1440).querySelectorAll('.navbar-subdropdown'));

    expect(menus.length).toBe(3);
    expect(menus.map((m) => m.classList.contains('navbar-subdropdown-izquierda'))).toEqual([false, false, false]);
  });

  it('antes de pasar el mouse, abren hacia la derecha (lo de siempre)', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NavbarCategoryBarComponent);
    fixture.componentRef.setInput('categories', [cadenaAnidada()]);
    fixture.componentRef.setInput('activeCategoryIds', new Set<number>());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.navbar-subdropdown-izquierda')).toBeNull();
  });
});

// Los menús laterales se cerraban apenas el puntero salía de la fila del ítem. Al ir en diagonal de "Computación" a un
// ítem de su menú lateral, el puntero cruzaba la fila vecina y el menú se cerraba antes de llegar. Ahora se espera un
// momento antes de cerrar o de pasar de un ítem al vecino, y si el mouse vuelve al menú en ese lapso, no pasa nada.
describe('NavbarCategoryBarComponent: demora al cerrar los menús laterales', () => {
  const DEMORA = DEMORA_MENU_LATERAL_MS;

  /** Raíz con tres ítems en su desplegable: A y B tienen menú lateral, C no. */
  const arbol = (): IApiCategory => ({
    ...categoria(1, 'Raíz'),
    children: [
      { ...categoria(2, 'A', 1), children: [categoria(21, 'A1', 2)] },
      { ...categoria(3, 'B', 1), children: [categoria(31, 'B1', 3)] },
      categoria(4, 'C', 1),
    ],
  });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function armar() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NavbarCategoryBarComponent);
    fixture.componentRef.setInput('categories', [arbol()]);
    fixture.componentRef.setInput('activeCategoryIds', new Set<number>());
    fixture.detectChanges();
    const [a, b, c] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.navbar-dropdown-container > div'));
    const mouse = {
      entra: (el: HTMLElement) => { el.dispatchEvent(new Event('mouseenter')); fixture.detectChanges(); },
      sale: (el: HTMLElement) => { el.dispatchEvent(new Event('mouseleave')); fixture.detectChanges(); },
      pasan: (ms: number) => { vi.advanceTimersByTime(ms); fixture.detectChanges(); },
    };
    const abierto = (el: HTMLElement) => el.querySelector(':scope > .navbar-subdropdown')?.classList.contains('navbar-subdropdown-abierto') ?? false;
    return { fixture, a, b, c, mouse, abierto };
  }

  it('pasar por ítems sin menú lateral antes de llegar a uno con menú lateral no demora su apertura', () => {
    // Al ir en diagonal desde la categoría se cruzan los ítems de arriba (sin menú lateral). No hay nada abierto que
    // proteger, así que no tiene sentido esperar: el menú lateral tiene que abrirse enseguida.
    const { a, c, mouse, abierto } = armar();

    mouse.entra(c);
    mouse.sale(c);
    mouse.entra(a);

    expect(abierto(a)).toBe(true);
  });

  it('abre el menú lateral enseguida cuando no hay otro abierto', () => {
    const { a, b, mouse, abierto } = armar();

    mouse.entra(a);

    expect(abierto(a)).toBe(true);
    expect(abierto(b)).toBe(false);
  });

  it('al salir del ítem lo cierra recién pasada la demora', () => {
    const { a, mouse, abierto } = armar();

    mouse.entra(a);
    mouse.sale(a);
    mouse.pasan(DEMORA - 1);
    expect(abierto(a)).toBe(true);

    mouse.pasan(1);
    expect(abierto(a)).toBe(false);
  });

  it('si el mouse vuelve antes de la demora, sigue abierto', () => {
    const { a, mouse, abierto } = armar();

    mouse.entra(a);
    mouse.sale(a);
    mouse.pasan(200);
    mouse.entra(a);
    mouse.pasan(5000);

    expect(abierto(a)).toBe(true);
  });

  it('pasar a un ítem vecino tarda la demora: mientras tanto sigue abierto el anterior', () => {
    const { a, b, mouse, abierto } = armar();

    mouse.entra(a);
    mouse.sale(a);
    mouse.entra(b);
    mouse.pasan(100);
    expect(abierto(a)).toBe(true);
    expect(abierto(b)).toBe(false);

    mouse.pasan(DEMORA - 100);
    expect(abierto(a)).toBe(false);
    expect(abierto(b)).toBe(true);
  });

  it('cruzar la fila vecina en diagonal y volver al menú lateral no lo cierra (el caso que fallaba)', () => {
    const { a, b, mouse, abierto } = armar();

    mouse.entra(a); // el mouse está en "Computación" y su menú lateral está abierto
    mouse.sale(a); // baja en diagonal: sale de la fila...
    mouse.entra(b); // ...cruza la fila de abajo...
    mouse.pasan(100);
    mouse.sale(b);
    mouse.entra(a); // ...y entra al menú lateral, que es parte del ítem A
    mouse.pasan(5000);

    expect(abierto(a)).toBe(true);
    expect(abierto(b)).toBe(false);
  });

  it('si el mouse se va del menú por completo, se cierra todo pasada la demora', () => {
    const { a, b, mouse, abierto } = armar();

    mouse.entra(a);
    mouse.sale(a);
    mouse.entra(b);
    mouse.sale(b);
    mouse.pasan(DEMORA - 1);
    expect(abierto(a)).toBe(true);

    mouse.pasan(1);
    expect(abierto(a)).toBe(false);
    expect(abierto(b)).toBe(false);
  });

  it('entrar a un ítem sin menú lateral cierra el del ítem anterior pasada la demora', () => {
    const { a, c, mouse, abierto } = armar();

    mouse.entra(a);
    expect(abierto(a)).toBe(true); // sin esto, la prueba pasaría aunque el menú nunca se abriera

    mouse.sale(a);
    mouse.entra(c);
    mouse.pasan(DEMORA - 1);
    expect(abierto(a)).toBe(true);

    mouse.pasan(1);
    expect(abierto(a)).toBe(false);
  });

  it('al destruirse no deja temporizadores pendientes', () => {
    const { fixture, a, mouse } = armar();

    mouse.entra(a);
    mouse.sale(a);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    fixture.destroy();

    expect(vi.getTimerCount()).toBe(0);
  });
});
