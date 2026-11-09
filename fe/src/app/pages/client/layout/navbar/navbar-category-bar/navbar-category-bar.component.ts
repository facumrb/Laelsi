import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IApiCategory } from '@models/category.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapChevronDown } from '@ng-icons/bootstrap-icons';
import { DireccionMenus, direccionDeLosMenus, menusLateralesDeLaRama } from './direccion-menus';

/**
 * Cuántos milisegundos se espera antes de cerrar un menú lateral o de pasar de un ítem al vecino. Sin demora, el
 * menú se cerraba apenas el puntero salía de la fila del ítem: al ir en diagonal hacia el menú lateral se cruzaba
 * la fila de al lado y se perdía. Con demasiada, el menú se siente lento. No hay un valor estándar: las fuentes
 * hablan de 100 a 300 ms. La solución más fina es una "zona segura" triangular (la usa Amazon), que queda como
 * mejora para el rediseño del menú.
 */
export const DEMORA_MENU_LATERAL_MS = 250;

/**
 * Clave del cierre pendiente del desplegable raíz en `pendientes`. Las demás claves son ids de categoría (siempre
 * positivos), así que -1 no choca con ninguna.
 */
const CLAVE_DE_LA_RAIZ = -1;

@Component({
  selector: 'app-navbar-category-bar',
  imports: [RouterLink, RouterLinkActive, NgIconComponent, NgTemplateOutlet],
  viewProviders: [provideIcons({ bootstrapChevronDown })],
  templateUrl: './navbar-category-bar.component.html',
})
export class NavbarCategoryBarComponent {
  categories = input.required<IApiCategory[]>();
  activeCategoryIds = input.required<Set<number>>();

  private documento = inject(DOCUMENT);
  private ventana = this.documento.defaultView;

  /**
   * Id de la categoría raíz cuyo desplegable está abierto (a lo sumo una). Lo comparten el mouse y el foco del teclado:
   * antes se abría con :hover de CSS, así que con teclado no se podía abrir ni cerrar sin mover el puntero.
   */
  raizAbierta = signal<number | null>(null);

  /** Mientras se le devuelve el foco a la categoría tras un Esc, el foco no tiene que volver a abrir el menú. */
  private devolviendoElFoco = false;

  /**
   * Hacia qué lado abre los menús laterales cada categoría raíz (por su id). Se decide al pasar el mouse por la
   * categoría (ver medirDireccion); hasta entonces, a la derecha, como siempre.
   */
  direcciones = signal<Record<number, DireccionMenus>>({});

  /**
   * Qué menú lateral está abierto en cada menú. La clave es el id de la categoría que contiene el menú (la raíz usa
   * su propio id) y el valor es el id del ítem cuyo menú lateral está abierto. A lo sumo uno por menú.
   */
  abiertos = signal<Record<number, number>>({});

  /** Acción pendiente de cada menú (cerrar el menú lateral abierto o pasar a otro ítem), por id de la categoría. */
  private pendientes = new Map<number, ReturnType<typeof setTimeout>>();

  private anfitrion = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private injector = inject(Injector);

  /**
   * Verdadero entre el toque con el dedo y su click cuando el toque cayó sobre un enlace cuyo menú todavía estaba
   * cerrado: ese click abre el menú (lo hace el mouse emulado) pero no tiene que navegar.
   */
  private toqueQueSoloAbre = false;

  constructor() {
    // Portátil con pantalla táctil y mouse: la barra se muestra (su entrada principal tiene hover), pero con el dedo no
    // hay forma de "pasar el mouse": el toque navegaba directo y el menú quedaba inalcanzable. El primer toque en una
    // categoría o ítem con menú lo abre y el segundo navega. Se escucha en fase de captura porque RouterLink navega en
    // el click sin mirar si el evento fue cancelado: hay que frenarlo antes de que llegue al enlace.
    const alTocar = (evento: Event) => {
      this.toqueQueSoloAbre = (evento as PointerEvent).pointerType === 'touch' && this.tieneMenuCerrado(evento.target);
    };
    const alHacerClic = (evento: Event) => {
      if (!this.toqueQueSoloAbre) return;
      this.toqueQueSoloAbre = false;
      evento.preventDefault();
      evento.stopPropagation();
    };
    this.anfitrion.addEventListener('pointerdown', alTocar, true);
    this.anfitrion.addEventListener('click', alHacerClic, true);

    inject(DestroyRef).onDestroy(() => {
      this.anfitrion.removeEventListener('pointerdown', alTocar, true);
      this.anfitrion.removeEventListener('click', alHacerClic, true);
      this.pendientes.forEach((temporizador) => clearTimeout(temporizador));
    });
  }

  /** ¿El destino es un enlace con menú (de la barra o de un ítem) que todavía no está abierto? */
  private tieneMenuCerrado(destino: EventTarget | null): boolean {
    const enlace = (destino as HTMLElement | null)?.closest?.('a');
    if (!enlace) return false;
    if (enlace.classList.contains('navbar-link')) {
      const grupo = enlace.closest('.group');
      return !!grupo?.querySelector('.navbar-dropdown') && !grupo.classList.contains('navbar-grupo-abierto');
    }
    if (enlace.classList.contains('navbar-dropdown-item')) {
      const lateral = enlace.parentElement?.querySelector(':scope > .navbar-subdropdown');
      return !!lateral && !lateral.classList.contains('navbar-subdropdown-abierto');
    }
    return false;
  }

  isCategoryActive(categoryId: number): boolean {
    return this.activeCategoryIds().has(categoryId);
  }

  /**
   * Al pasar el mouse por una categoría raíz, decide hacia qué lado abrir sus menús laterales, según dónde quedó
   * su desplegable y cuántos niveles tiene su rama. Con cinco niveles los menús laterales ocupan unos 550 px: si la
   * categoría está del lado derecho de la barra, a la derecha no entran y los últimos niveles quedarían fuera de la
   * pantalla, sin forma de llegar a ellos.
   */
  medirDireccion(categoria: IApiCategory, grupo: HTMLElement): void {
    const desplegable = grupo.querySelector('.navbar-dropdown');
    if (!desplegable || !this.ventana) return;

    const direccion = direccionDeLosMenus({
      izquierdaDelDesplegable: desplegable.getBoundingClientRect().left,
      anchoDePantalla: this.ventana.innerWidth,
      menusLaterales: menusLateralesDeLaRama(categoria),
    });
    if (this.direcciones()[categoria.id] !== direccion) {
      this.direcciones.update((actuales) => ({ ...actuales, [categoria.id]: direccion }));
    }
  }

  /**
   * El mouse o el foco entran a una categoría raíz: se abre su desplegable. Si había otra raíz abierta (el puntero pasó
   * de una categoría a la de al lado), esa se cierra y se olvida de sus menús laterales.
   */
  abrirRaiz(categoria: IApiCategory, grupo: HTMLElement): void {
    this.cancelarPendiente(CLAVE_DE_LA_RAIZ);
    const abierta = this.raizAbierta();
    if (abierta !== null && abierta !== categoria.id) this.cerrarRaiz();
    this.medirDireccion(categoria, grupo);
    this.raizAbierta.set(categoria.id);
  }

  /**
   * El mouse sale de una categoría raíz (de su enlace, de su desplegable y de todos sus menús laterales). El cierre
   * espera la misma demora que los menús laterales: con :hover, el desplegable tenía de hecho unos 200 ms de gracia por
   * su transición, y una diagonal apurada hacia un menú lateral lejano puede salir un instante del menú y volver. Si
   * el mouse vuelve antes, `abrirRaiz` cancela el cierre y todo sigue como estaba.
   */
  salirDeLaRaiz(categoria: IApiCategory): void {
    this.programar(CLAVE_DE_LA_RAIZ, () => {
      if (this.raizAbierta() === categoria.id) this.cerrarRaiz();
    });
  }

  /**
   * Flecha abajo en una categoría con menú: lo abre y lleva el foco a su primer ítem. Sirve para volver al menú después
   * de descartarlo con Esc, cuando el foco sigue en la categoría y el menú está cerrado. En una categoría sin menú no
   * hace nada, para que la página baje como siempre.
   */
  abrirConFlecha(evento: Event, categoria: IApiCategory, grupo: HTMLElement): void {
    if (!categoria.children?.length) return;
    evento.preventDefault();
    this.abrirRaiz(categoria, grupo);
    // El ítem recién se puede enfocar cuando el menú ya se dibujó como abierto
    afterNextRender(() => grupo.querySelector<HTMLElement>('.navbar-dropdown .navbar-dropdown-item')?.focus(), {
      injector: this.injector,
    });
  }

  /** Lo mismo cuando entra el foco, salvo que sea el que se devuelve tras un Esc. */
  abrirPorFoco(categoria: IApiCategory, grupo: HTMLElement): void {
    if (!this.devolviendoElFoco) this.abrirRaiz(categoria, grupo);
  }

  /** Cierra el desplegable y se olvida de los menús laterales que estaban abiertos. */
  cerrarRaiz(): void {
    this.raizAbierta.set(null);
    this.pendientes.forEach((temporizador) => clearTimeout(temporizador));
    this.pendientes.clear();
    this.abiertos.set({});
  }

  /** El foco sale de una categoría: se cierra solo si pasa a algo que no está dentro de ella. */
  perderFoco(evento: FocusEvent, grupo: HTMLElement): void {
    const destino = evento.relatedTarget as Node | null;
    if (!destino || !grupo.contains(destino)) this.cerrarRaiz();
  }

  /**
   * Esc descarta el menú sin mover el mouse ni el foco (WCAG 1.4.13). Si el foco estaba dentro del menú, vuelve a la
   * categoría para no perderlo. Con el mouse todavía encima, el menú no se reabre solo: hace falta que el puntero salga
   * y vuelva a entrar.
   *
   * El foco se devuelve en el ciclo siguiente y no en el acto: ClickOutsideDirective (shared/directives) escucha Esc en
   * el documento y le hace blur() al elemento activo, y ese Esc llega a la barra antes que al documento. Si se devolvía
   * en el acto, la directiva se lo sacaba enseguida y el foco quedaba en el body.
   */
  descartar(evento: Event): void {
    if (this.raizAbierta() === null) return;
    const grupo = (evento.target as HTMLElement).closest<HTMLElement>('.group');
    const teniaElFoco = !!grupo && grupo.contains(this.documento.activeElement);
    this.cerrarRaiz();
    if (!teniaElFoco || !grupo) return;
    setTimeout(() => {
      this.devolviendoElFoco = true;
      grupo.querySelector<HTMLElement>('a.navbar-link')?.focus();
      this.devolviendoElFoco = false;
    });
  }

  /**
   * El foco entra a un ítem del menú `madre`. Con teclado no hay puntero que cruce filas vecinas, así que no hace
   * falta esperar: si el ítem tiene menú lateral se abre enseguida y si no, se cierra el que estaba abierto.
   */
  enfocar(madre: number, id: number, tieneMenuLateral: boolean): void {
    this.cancelarPendiente(madre);
    if (tieneMenuLateral) this.abrir(madre, id);
    else if (this.abiertos()[madre] !== undefined) this.cerrar(madre);
  }

  /**
   * El mouse entra a un ítem del menú `madre`. La demora solo existe para proteger un menú lateral que está abierto:
   * - Si el ítem tiene menú lateral y no hay otro abierto en ese menú (o ya es el suyo), se abre enseguida. Si hay otro
   *   abierto, se espera antes de pasar a este: el puntero puede estar cruzando la fila vecina de camino al menú
   *   lateral, que es parte del ítem anterior.
   * - Si el ítem no tiene menú lateral, no abre nada (y nunca queda registrado como abierto: si no, la demora se
   *   aplicaría también cuando no hay nada visible que proteger). Si hay un menú lateral abierto, se cierra pasada la
   *   demora, salvo que el mouse vuelva a él antes.
   */
  entrar(madre: number, id: number, tieneMenuLateral: boolean): void {
    this.cancelarPendiente(madre);
    const abierto = this.abiertos()[madre];
    if (tieneMenuLateral) {
      if (abierto === undefined || abierto === id) this.abrir(madre, id);
      else this.programar(madre, () => this.abrir(madre, id));
    } else if (abierto !== undefined) {
      this.programar(madre, () => this.cerrar(madre));
    }
  }

  /**
   * El mouse sale de un ítem del menú `madre` (de la fila y de su menú lateral: ir de la fila a su propio menú lateral
   * no cuenta como salir, porque el menú lateral está dentro del ítem). Si hay un menú lateral abierto, se cierra
   * pasada la demora, salvo que el mouse vuelva antes: `entrar` lo cancela.
   */
  salir(madre: number): void {
    if (this.abiertos()[madre] !== undefined) this.programar(madre, () => this.cerrar(madre));
  }

  private abrir(madre: number, id: number): void {
    this.pendientes.delete(madre);
    if (this.abiertos()[madre] !== id) this.abiertos.update((actuales) => ({ ...actuales, [madre]: id }));
  }

  private cerrar(madre: number): void {
    this.pendientes.delete(madre);
    this.abiertos.update((actuales) => {
      const resto = { ...actuales };
      delete resto[madre];
      return resto;
    });
  }

  private programar(madre: number, accion: () => void): void {
    this.cancelarPendiente(madre);
    this.pendientes.set(madre, setTimeout(accion, DEMORA_MENU_LATERAL_MS));
  }

  private cancelarPendiente(madre: number): void {
    clearTimeout(this.pendientes.get(madre));
    this.pendientes.delete(madre);
  }
}
