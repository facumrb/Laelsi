import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
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

@Component({
  selector: 'app-navbar-category-bar',
  imports: [RouterLink, RouterLinkActive, NgIconComponent, NgTemplateOutlet],
  viewProviders: [provideIcons({ bootstrapChevronDown })],
  templateUrl: './navbar-category-bar.component.html',
})
export class NavbarCategoryBarComponent {
  categories = input.required<IApiCategory[]>();
  activeCategoryIds = input.required<Set<number>>();

  private ventana = inject(DOCUMENT).defaultView;

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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pendientes.forEach((temporizador) => clearTimeout(temporizador)));
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
