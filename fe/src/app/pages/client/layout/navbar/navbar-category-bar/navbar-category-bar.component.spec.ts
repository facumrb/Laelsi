import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

// Antes el menú solo se abría con el mouse (con :hover de CSS): quien navega con teclado no podía abrirlo ni ver las
// subcategorías, y no había forma de cerrarlo sin mover el puntero (WCAG 1.4.13: el contenido que aparece al pasar el
// mouse o al enfocar tiene que poder descartarse con Esc). Ahora mouse y foco comparten el mismo estado: el menú abre
// al entrar el mouse o el foco, cierra al salir, y Esc lo descarta sin mover nada.
describe('NavbarCategoryBarComponent: teclado y descarte', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Raíz con tres ítems en su desplegable: A y B tienen menú lateral, C no. */
  const arbol = (): IApiCategory => ({
    ...categoria(1, 'Raíz'),
    children: [
      { ...categoria(2, 'A', 1), children: [categoria(21, 'A1', 2)] },
      { ...categoria(3, 'B', 1), children: [categoria(31, 'B1', 3)] },
      categoria(4, 'C', 1),
    ],
  });

  function armar(categorias: IApiCategory[] = [arbol()]) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NavbarCategoryBarComponent);
    fixture.componentRef.setInput('categories', categorias);
    fixture.componentRef.setInput('activeCategoryIds', new Set<number>());
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const grupo = raiz.querySelector<HTMLElement>('.group') as HTMLElement;
    const enlaceRaiz = grupo.querySelector<HTMLAnchorElement>('a.navbar-link') as HTMLAnchorElement;
    const [a, b, c] = Array.from(raiz.querySelectorAll<HTMLElement>('.navbar-dropdown-container > div'));
    const enlace = (item: HTMLElement) => item.querySelector(':scope > a') as HTMLAnchorElement;
    const desplegableAbierto = () => grupo.querySelector('.navbar-dropdown')?.classList.contains('navbar-dropdown-abierto') ?? false;
    const lateralAbierto = (item: HTMLElement) => item.querySelector(':scope > .navbar-subdropdown')?.classList.contains('navbar-subdropdown-abierto') ?? false;
    const actuar = {
      mouseEntra: (el: HTMLElement) => { el.dispatchEvent(new Event('mouseenter')); fixture.detectChanges(); },
      mouseSale: (el: HTMLElement) => { el.dispatchEvent(new Event('mouseleave')); fixture.detectChanges(); },
      focoEntra: (el: HTMLElement) => { el.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); fixture.detectChanges(); },
      focoSale: (el: HTMLElement, haciaDonde: Element | null) => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: haciaDonde })); fixture.detectChanges(); },
      esc: (en: HTMLElement) => { en.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges(); },
    };
    return { fixture, grupo, enlaceRaiz, a, b, c, enlace, desplegableAbierto, lateralAbierto, actuar };
  }

  it('el mouse abre el desplegable al entrar y lo cierra al salir, pasada la demora', () => {
    const { fixture, grupo, desplegableAbierto, actuar } = armar();
    expect(desplegableAbierto()).toBe(false);

    actuar.mouseEntra(grupo);
    expect(desplegableAbierto()).toBe(true);

    actuar.mouseSale(grupo);
    vi.advanceTimersByTime(DEMORA_MENU_LATERAL_MS - 1);
    fixture.detectChanges();
    expect(desplegableAbierto()).toBe(true); // todavía no: la demora protege al puntero que roza el borde

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(desplegableAbierto()).toBe(false);
  });

  // Una diagonal apurada hacia un menú lateral lejano puede salir un instante del menú y volver a entrar. Antes de este
  // cambio el desplegable se cerraba con :hover y su transición de 200 ms le daba margen; al pasar a depender del
  // estado del componente, se cerraba en el acto y se olvidaba de los menús laterales abiertos (en el navegador, una
  // diagonal apurada llegaba a 3 de los 5 niveles).
  it('si el mouse sale del menú y vuelve antes de la demora, sigue abierto con su menú lateral', () => {
    const { fixture, grupo, a, desplegableAbierto, lateralAbierto, actuar } = armar();
    actuar.mouseEntra(grupo);
    actuar.mouseEntra(a);
    expect(lateralAbierto(a)).toBe(true);

    actuar.mouseSale(a);
    actuar.mouseSale(grupo);
    vi.advanceTimersByTime(DEMORA_MENU_LATERAL_MS - 50);
    fixture.detectChanges();
    // Durante la excursión el menú tiene que seguir en pantalla: si desaparece, el puntero no tiene adónde volver
    expect(desplegableAbierto()).toBe(true);
    expect(lateralAbierto(a)).toBe(true);

    actuar.mouseEntra(grupo); // el puntero vuelve al menú: entra al grupo y, dentro, al ítem
    actuar.mouseEntra(a);
    vi.advanceTimersByTime(DEMORA_MENU_LATERAL_MS * 2);
    fixture.detectChanges();

    expect(desplegableAbierto()).toBe(true);
    expect(lateralAbierto(a)).toBe(true);
  });

  it('al pasar de una categoría a la de al lado, la primera se cierra y la segunda queda abierta', () => {
    const otra: IApiCategory = { ...categoria(5, 'Otra'), children: [categoria(51, 'O1', 5)] };
    const { fixture, grupo, desplegableAbierto, actuar } = armar([arbol(), otra]);
    const segundoGrupo = fixture.nativeElement.querySelectorAll('.group')[1] as HTMLElement;
    const desplegableDelSegundo = () =>
      segundoGrupo.querySelector('.navbar-dropdown')?.classList.contains('navbar-dropdown-abierto') ?? false;

    actuar.mouseEntra(grupo);
    actuar.mouseSale(grupo);
    actuar.mouseEntra(segundoGrupo);
    vi.advanceTimersByTime(DEMORA_MENU_LATERAL_MS * 2);
    fixture.detectChanges();

    expect(desplegableDelSegundo()).toBe(true); // el cierre pendiente de la primera no se lleva a la segunda
    expect(desplegableAbierto()).toBe(false);
  });

  it('el foco en la categoría abre el desplegable y lo marca como expandido para los lectores de pantalla', () => {
    const { enlaceRaiz, desplegableAbierto, actuar } = armar();
    expect(enlaceRaiz.getAttribute('aria-expanded')).toBe('false');

    actuar.focoEntra(enlaceRaiz);

    expect(desplegableAbierto()).toBe(true);
    expect(enlaceRaiz.getAttribute('aria-expanded')).toBe('true');
    expect(enlaceRaiz.getAttribute('aria-haspopup')).toBe('true');
  });

  it('si el foco sale del grupo cierra el desplegable; si pasa a algo de adentro, no', () => {
    const { enlaceRaiz, a, enlace, desplegableAbierto, actuar } = armar();
    actuar.focoEntra(enlaceRaiz);

    actuar.focoSale(enlaceRaiz, enlace(a)); // pasa al primer ítem del desplegable: sigue adentro
    expect(desplegableAbierto()).toBe(true);

    actuar.focoSale(enlace(a), document.body); // se va a otra parte de la página
    expect(desplegableAbierto()).toBe(false);
  });

  it('el foco en un ítem con menú lateral lo abre enseguida, sin esperar', () => {
    const { enlaceRaiz, a, enlace, lateralAbierto, actuar } = armar();
    actuar.focoEntra(enlaceRaiz);

    actuar.focoEntra(enlace(a));

    expect(lateralAbierto(a)).toBe(true);
  });

  it('el foco en un ítem sin menú lateral cierra enseguida el que estaba abierto', () => {
    const { enlaceRaiz, a, c, enlace, lateralAbierto, actuar } = armar();
    actuar.focoEntra(enlaceRaiz);
    actuar.focoEntra(enlace(a));
    expect(lateralAbierto(a)).toBe(true);

    actuar.focoEntra(enlace(c));

    expect(lateralAbierto(a)).toBe(false);
  });

  it('Esc descarta el desplegable y los menús laterales sin mover el mouse ni el foco', () => {
    const { grupo, a, desplegableAbierto, lateralAbierto, actuar } = armar();
    actuar.mouseEntra(grupo);
    actuar.mouseEntra(a);
    expect(desplegableAbierto()).toBe(true);
    expect(lateralAbierto(a)).toBe(true);

    actuar.esc(grupo);

    expect(desplegableAbierto()).toBe(false);
    expect(lateralAbierto(a)).toBe(false);
  });

  it('Esc devuelve el foco a la categoría cuando estaba adentro del menú', () => {
    const { enlaceRaiz, a, enlace, desplegableAbierto, actuar } = armar();
    actuar.focoEntra(enlaceRaiz);
    enlace(a).focus();
    expect(document.activeElement).toBe(enlace(a));

    actuar.esc(enlace(a));
    vi.runAllTimers();

    expect(document.activeElement).toBe(enlaceRaiz);
    expect(desplegableAbierto()).toBe(false); // y devolver el foco no lo vuelve a abrir
  });

  // ClickOutsideDirective (shared/directives), que usan los menús y modales de la tienda, escucha Esc en el documento y
  // le hace blur() al elemento activo. El Esc llega primero a la barra y después al documento: si la barra devolvía el
  // foco en el acto, esa directiva se lo sacaba enseguida y el foco quedaba en el body (se vio en una prueba con
  // teclado en el navegador: los menús cerraban pero el foco se perdía).
  it('Esc devuelve el foco a la categoría aunque otro componente le suelte el foco al mismo Esc', () => {
    const { enlaceRaiz, a, enlace, actuar } = armar();
    const sueltaElFoco = () => (document.activeElement as HTMLElement | null)?.blur();
    document.addEventListener('keydown', sueltaElFoco);
    try {
      actuar.focoEntra(enlaceRaiz);
      enlace(a).focus();

      actuar.esc(enlace(a));
      vi.runAllTimers();

      expect(document.activeElement).toBe(enlaceRaiz);
    } finally {
      document.removeEventListener('keydown', sueltaElFoco);
    }
  });

  it('después de Esc, con el mouse todavía encima, no se reabre solo hasta que vuelva a entrar', () => {
    const { grupo, desplegableAbierto, actuar } = armar();
    actuar.mouseEntra(grupo);
    actuar.esc(grupo);

    expect(desplegableAbierto()).toBe(false);

    actuar.mouseSale(grupo);
    actuar.mouseEntra(grupo);
    expect(desplegableAbierto()).toBe(true);
  });

  it('al cerrarse se olvidan los menús laterales que estaban abiertos', () => {
    const { fixture, grupo, a, lateralAbierto, actuar } = armar();
    actuar.mouseEntra(grupo);
    actuar.mouseEntra(a);
    expect(lateralAbierto(a)).toBe(true);

    actuar.mouseSale(grupo);
    vi.advanceTimersByTime(DEMORA_MENU_LATERAL_MS);
    fixture.detectChanges();
    actuar.mouseEntra(grupo);

    expect(lateralAbierto(a)).toBe(false);
  });

  // Un portátil con pantalla táctil y mouse muestra esta barra (su entrada principal tiene hover y puntero fino), pero
  // quien toca con el dedo no puede "pasar el mouse": el toque navegaba directo a la categoría y el menú quedaba
  // inalcanzable, el mismo problema que tenían las tablets. El primer toque en una categoría con menú lo abre y el
  // segundo navega. Con mouse, y en las categorías sin menú, nada cambia.
  describe('toque con el dedo', () => {
    /**
     * Un toque como lo manda el navegador: pointerdown (con el tipo de puntero), después el mouse emulado entra al
     * elemento (mouseenter, que abre el menú) y recién al final llega el click. Devuelve cuántas veces se navegó.
     */
    function tocar(
      enlace: HTMLElement,
      entrada: HTMLElement,
      actuar: { mouseEntra: (el: HTMLElement) => void },
      tipo: 'touch' | 'mouse' = 'touch',
    ): void {
      const bajar = new Event('pointerdown', { bubbles: true, cancelable: true });
      Object.defineProperty(bajar, 'pointerType', { value: tipo });
      enlace.dispatchEvent(bajar);
      actuar.mouseEntra(entrada);
      enlace.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    it('el primer toque en una categoría con menú lo abre y no navega; el segundo navega', () => {
      const { grupo, enlaceRaiz, desplegableAbierto, actuar } = armar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      tocar(enlaceRaiz, grupo, actuar);
      expect(desplegableAbierto()).toBe(true);
      expect(navegar).not.toHaveBeenCalled();

      tocar(enlaceRaiz, grupo, actuar);
      expect(navegar).toHaveBeenCalledTimes(1);
    });

    it('con mouse el clic navega enseguida, como siempre', () => {
      const { grupo, enlaceRaiz, actuar } = armar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      tocar(enlaceRaiz, grupo, actuar, 'mouse');

      expect(navegar).toHaveBeenCalledTimes(1);
    });

    it('una categoría sin menú navega en el primer toque', () => {
      const hoja = categoria(9, 'Sin hijas');
      const { fixture, actuar } = armar([arbol(), hoja]);
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const grupoDeLaHoja = fixture.nativeElement.querySelectorAll('.group')[1] as HTMLElement;
      const enlaceDeLaHoja = grupoDeLaHoja.querySelector('a.navbar-link') as HTMLElement;

      tocar(enlaceDeLaHoja, grupoDeLaHoja, actuar);

      expect(navegar).toHaveBeenCalledTimes(1);
    });

    it('en el menú, el primer toque en un ítem con menú lateral lo abre y no navega; el segundo navega', () => {
      const { grupo, a, enlace, lateralAbierto, actuar } = armar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      actuar.mouseEntra(grupo); // el menú ya está abierto

      tocar(enlace(a), a, actuar);
      expect(lateralAbierto(a)).toBe(true);
      expect(navegar).not.toHaveBeenCalled();

      tocar(enlace(a), a, actuar);
      expect(navegar).toHaveBeenCalledTimes(1);
    });

    it('en el menú, un ítem sin menú lateral navega en el primer toque', () => {
      const { grupo, c, enlace, actuar } = armar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      actuar.mouseEntra(grupo);

      tocar(enlace(c), c, actuar);

      expect(navegar).toHaveBeenCalledTimes(1);
    });
  });

  // Después de Esc el foco queda en la categoría y el menú cerrado: sin otra tecla, la única forma de volver a verlo era
  // salir y volver a entrar. Flecha abajo lo abre y entra al primer ítem, como en los menús de las aplicaciones.
  describe('flecha abajo', () => {
    it('abre el menú y lleva el foco al primer ítem, aunque se lo haya descartado antes con Esc', () => {
      const { fixture, grupo, enlaceRaiz, a, enlace, desplegableAbierto, actuar } = armar();
      actuar.mouseEntra(grupo);
      actuar.esc(grupo);
      vi.runAllTimers();
      expect(desplegableAbierto()).toBe(false);

      const tecla = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      enlaceRaiz.dispatchEvent(tecla);
      fixture.detectChanges();
      TestBed.tick(); // corre lo que se programó para después de dibujar

      expect(desplegableAbierto()).toBe(true);
      expect(document.activeElement).toBe(enlace(a));
      expect(tecla.defaultPrevented).toBe(true); // y la página no baja con la flecha
    });

    it('en una categoría sin menú no hace nada y deja que la página baje', () => {
      const hoja = categoria(9, 'Sin hijas');
      const { fixture } = armar([hoja]);
      const enlaceDeLaHoja = fixture.nativeElement.querySelector('a.navbar-link') as HTMLElement;

      const tecla = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      enlaceDeLaHoja.dispatchEvent(tecla);

      expect(tecla.defaultPrevented).toBe(false);
    });
  });

  it('Esc sin nada abierto no hace nada ni le roba el foco a otro elemento', () => {
    const { fixture, grupo, desplegableAbierto, actuar } = armar();
    const otro = document.createElement('button');
    document.body.appendChild(otro);
    otro.focus();

    actuar.esc(grupo);

    expect(desplegableAbierto()).toBe(false);
    expect(document.activeElement).toBe(otro);
    otro.remove();
    fixture.destroy();
  });
});
