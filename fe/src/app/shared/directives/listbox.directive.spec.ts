import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ListboxDirective } from './listbox.directive';

// Teclado de los desplegables hechos a mano: foco en la opción elegida, flechas, Enter y Espacio, Escape, y devolver el
// foco al botón que abrió la lista. Antes las opciones eran <li> con clic: con teclado no se podían elegir.
@Component({
  imports: [ListboxDirective],
  template: `
    <button id="disparador" type="button" (click)="abierta.set(true)">Abrir</button>
    <input id="otro" />
    @if (abierta()) {
      <ul appListbox (closed)="cerrada.set(cerrada() + 1)">
        @for (o of opciones; track o) {
          <li
            role="option"
            tabindex="-1"
            [attr.aria-selected]="o === elegida"
            (click)="clics.push(o)"
          >
            {{ o }}
          </li>
        }
      </ul>
    }
  `,
})
class AnfitrionComponent {
  abierta = signal(false);
  cerrada = signal(0);
  opciones = ['Activo', 'Pausado', 'Inactivo'];
  elegida: string | null = null;
  clics: string[] = [];
}

describe('ListboxDirective', () => {
  function abrir(elegida: string | null = null) {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.componentInstance.elegida = elegida;
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const disparador = raiz.querySelector<HTMLButtonElement>('#disparador')!;
    disparador.focus();
    fixture.componentInstance.abierta.set(true);
    fixture.detectChanges();
    return { fixture, raiz, disparador, anfitrion: fixture.componentInstance };
  }

  const opciones = (raiz: HTMLElement) => Array.from(raiz.querySelectorAll<HTMLElement>('[role=option]'));
  const tecla = (el: Element, key: string) => {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    el.dispatchEvent(evento);
    return evento;
  };

  it('la lista tiene rol de lista de opciones', () => {
    const { raiz } = abrir();

    expect(raiz.querySelector('ul')?.getAttribute('role')).toBe('listbox');
  });

  it('al abrirse, el foco va a la primera opción', () => {
    const { raiz } = abrir();

    expect(document.activeElement).toBe(opciones(raiz)[0]);
  });

  it('al abrirse, el foco va a la opción elegida si la hay', () => {
    const { raiz } = abrir('Pausado');

    expect(document.activeElement).toBe(opciones(raiz)[1]);
  });

  it('las flechas mueven el foco y no se pasan de los extremos', () => {
    const { raiz } = abrir();
    const [a, b, c] = opciones(raiz);

    tecla(a, 'ArrowDown');
    expect(document.activeElement).toBe(b);
    tecla(b, 'ArrowDown');
    expect(document.activeElement).toBe(c);
    tecla(c, 'ArrowDown');
    expect(document.activeElement).toBe(c);
    tecla(c, 'ArrowUp');
    expect(document.activeElement).toBe(b);
    tecla(b, 'ArrowUp');
    tecla(a, 'ArrowUp');
    expect(document.activeElement).toBe(a);
  });

  it('Inicio y Fin saltan a la primera y a la última opción', () => {
    const { raiz } = abrir();
    const [a, , c] = opciones(raiz);

    tecla(a, 'End');
    expect(document.activeElement).toBe(c);
    tecla(c, 'Home');
    expect(document.activeElement).toBe(a);
  });

  it('Enter elige la opción con foco (dispara su clic)', () => {
    const { raiz, anfitrion } = abrir();
    const [, b] = opciones(raiz);
    b.focus();

    tecla(b, 'Enter');

    expect(anfitrion.clics).toEqual(['Pausado']);
  });

  it('Espacio también elige, y no hace scroll de la página', () => {
    const { raiz, anfitrion } = abrir();
    const [a] = opciones(raiz);

    const evento = tecla(a, ' ');

    expect(anfitrion.clics).toEqual(['Activo']);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('Enter o Espacio con el foco fuera de las opciones (por ejemplo, en un botón) no se cancelan', () => {
    const { raiz, anfitrion } = abrir();
    const lista = raiz.querySelector('ul')!;

    const enter = tecla(lista, 'Enter');
    const espacio = tecla(lista, ' ');

    expect(enter.defaultPrevented).toBe(false);
    expect(espacio.defaultPrevented).toBe(false);
    expect(anfitrion.clics).toEqual([]);
  });

  it('Escape pide cerrar la lista', () => {
    const { raiz, anfitrion } = abrir();

    tecla(opciones(raiz)[0], 'Escape');

    expect(anfitrion.cerrada()).toBe(1);
  });

  it('Tab también pide cerrar la lista', () => {
    const { raiz, anfitrion } = abrir();

    tecla(opciones(raiz)[0], 'Tab');

    expect(anfitrion.cerrada()).toBe(1);
  });

  it('otras teclas no hacen nada', () => {
    const { raiz, anfitrion } = abrir();

    tecla(opciones(raiz)[0], 'a');

    expect(anfitrion.cerrada()).toBe(0);
    expect(anfitrion.clics).toEqual([]);
  });

  it('al cerrarse con el foco adentro, el foco vuelve al botón que la abrió', () => {
    const { fixture, disparador, anfitrion } = abrir();

    anfitrion.abierta.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(disparador);
  });

  it('al cerrarse con el foco en otro lado (por ejemplo, un clic afuera), no le roba el foco', () => {
    const { fixture, raiz, anfitrion } = abrir();
    raiz.querySelector<HTMLInputElement>('#otro')!.focus();

    anfitrion.abierta.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(raiz.querySelector('#otro'));
  });
});
