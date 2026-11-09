import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ActivableDirective } from './activable.directive';

// Un elemento que no es un botón pero se usa como uno (el nombre de un cliente que abre su ficha, una fila que abre el
// detalle) tiene que poder alcanzarse y activarse con el teclado.
@Component({
  imports: [ActivableDirective],
  template: `<div appActivable (click)="clics = clics + 1">Ana Pérez</div>`,
})
class AnfitrionComponent {
  clics = 0;
}

describe('ActivableDirective', () => {
  function crear() {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('div')!;
    return { fixture, el };
  }
  const tecla = (el: Element, key: string) => {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    el.dispatchEvent(evento);
    return evento;
  };

  it('se anuncia como botón y entra en el orden del teclado', () => {
    const { el } = crear();

    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('Enter lo activa (dispara su clic)', () => {
    const { fixture, el } = crear();

    tecla(el, 'Enter');

    expect(fixture.componentInstance.clics).toBe(1);
  });

  it('Espacio lo activa y no hace scroll', () => {
    const { fixture, el } = crear();

    const evento = tecla(el, ' ');

    expect(fixture.componentInstance.clics).toBe(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('otras teclas no lo activan', () => {
    const { fixture, el } = crear();

    tecla(el, 'a');
    tecla(el, 'Tab');

    expect(fixture.componentInstance.clics).toBe(0);
  });

  it('un clic común sigue funcionando', () => {
    const { fixture, el } = crear();

    el.click();

    expect(fixture.componentInstance.clics).toBe(1);
  });
});
