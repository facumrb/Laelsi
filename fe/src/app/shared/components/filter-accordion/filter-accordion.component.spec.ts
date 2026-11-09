import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FilterAccordionComponent } from './filter-accordion.component';

// El desplegable de filtros (estado, rol, etc.) de las listas del panel: sus opciones eran <div> con clic, sin foco,
// y con teclado no se podía elegir ninguna.
describe('FilterAccordionComponent: teclado', () => {
  const OPCIONES = [
    { value: 'all', label: 'Todos' },
    { value: 'Activo', label: 'Activo' },
    { value: 'Pausado', label: 'Pausado' },
  ];

  function crear(elegida = 'all') {
    const fixture = TestBed.createComponent(FilterAccordionComponent);
    fixture.componentRef.setInput('label', 'Filtrar por Estado');
    fixture.componentRef.setInput('options', OPCIONES);
    fixture.componentRef.setInput('selected', elegida);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    document.body.appendChild(raiz); // el foco real solo existe con el elemento dentro del documento
    const disparador = raiz.querySelector<HTMLButtonElement>('button')!;
    return { fixture, raiz, disparador };
  }

  const abrir = (c: ReturnType<typeof crear>) => {
    c.disparador.focus();
    c.disparador.click();
    c.fixture.detectChanges();
  };
  const opciones = (raiz: HTMLElement) => Array.from(raiz.querySelectorAll<HTMLElement>('[role=option]'));
  const tecla = (el: Element, key: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  it('el botón avisa que abre una lista de opciones y si está abierta', () => {
    const c = crear();

    expect(c.disparador.getAttribute('aria-haspopup')).toBe('listbox');
    expect(c.disparador.getAttribute('aria-expanded')).toBe('false');

    abrir(c);

    expect(c.disparador.getAttribute('aria-expanded')).toBe('true');
    c.raiz.remove();
  });

  it('al abrir, el foco va a la opción elegida y las demás se alcanzan con las flechas, no con Tab', () => {
    const c = crear('Activo');

    abrir(c);

    const lista = opciones(c.raiz);
    expect(lista.map((o) => o.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1']);
    expect(document.activeElement).toBe(lista[1]);
    c.raiz.remove();
  });

  it('flecha abajo mueve el foco y Enter elige: el valor cambia y la lista se cierra', () => {
    const c = crear('all');
    abrir(c);

    tecla(document.activeElement!, 'ArrowDown');
    tecla(document.activeElement!, 'ArrowDown');
    tecla(document.activeElement!, 'Enter');
    c.fixture.detectChanges();

    expect(c.fixture.componentInstance.selected()).toBe('Pausado');
    expect(c.raiz.querySelector('[role=listbox]')).toBeNull();
    expect(c.disparador.getAttribute('aria-expanded')).toBe('false');
    c.raiz.remove();
  });

  it('Escape cierra sin cambiar el valor y devuelve el foco al botón', () => {
    const c = crear('Activo');
    abrir(c);

    tecla(document.activeElement!, 'Escape');
    c.fixture.detectChanges();

    expect(c.fixture.componentInstance.selected()).toBe('Activo');
    expect(c.raiz.querySelector('[role=listbox]')).toBeNull();
    expect(document.activeElement).toBe(c.disparador);
    c.raiz.remove();
  });
});
