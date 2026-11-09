import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { describe, expect, it } from 'vitest';
import { TableActionsComponent } from './table-actions.component';

// El ícono tiene que decir lo que hace el botón: el tacho es para BORRAR; desactivar y reactivar a una persona
// tienen los suyos (ID 65 de docs/requerimientos/discusiones.md).
describe('TableActionsComponent: íconos', () => {
  function crear(entradas: Record<string, unknown>) {
    const fixture = TestBed.createComponent(TableActionsComponent<unknown>);
    fixture.componentRef.setInput('item', {});
    for (const [nombre, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
    return fixture;
  }

  const nombreDe = (d: { componentInstance: NgIconComponent }) => {
    const n = (d.componentInstance as unknown as { name: unknown }).name;
    return typeof n === 'function' ? (n as () => string)() : (n as string);
  };

  const iconosDe = (fixture: ReturnType<typeof crear>) =>
    fixture.debugElement.queryAll(By.directive(NgIconComponent)).map(nombreDe);

  it('por defecto: lápiz para editar y tacho para eliminar', () => {
    expect(iconosDe(crear({}))).toEqual(['bootstrapPencilSquare', 'bootstrapTrash']);
  });

  it('con otro ícono de baja, el botón de baja lo usa y el tacho desaparece', () => {
    const iconos = iconosDe(crear({ deleteIcon: 'bootstrapPersonSlash' }));

    expect(iconos).toEqual(['bootstrapPencilSquare', 'bootstrapPersonSlash']);
    expect(iconos).not.toContain('bootstrapTrash');
  });

  it('reactivar usa su propio ícono, configurable', () => {
    const fixture = crear({ canReactivate: true, canDelete: false, reactivateIcon: 'bootstrapPersonCheck' });

    expect(iconosDe(fixture)).toEqual(['bootstrapPencilSquare', 'bootstrapPersonCheck']);
  });

  it('el ícono de reactivar por defecto no es el de deshacer', () => {
    const fixture = crear({ canReactivate: true, canDelete: false });

    expect(iconosDe(fixture)).not.toContain('bootstrapArrowCounterclockwise');
  });
});

// ID 64 (hallazgo 8): los botones de ícono medían 20×20 px, por debajo de los 24×24 que pide WCAG 2.2 (criterio 2.5.8) y
// muy lejos de lo cómodo en un celular. Con `p-2` alrededor del ícono de 20 px el botón mide 36×36 px.
describe('TableActionsComponent: tamaño de los botones', () => {
  function botones(entradas: Record<string, unknown>) {
    const fixture = TestBed.createComponent(TableActionsComponent<unknown>);
    fixture.componentRef.setInput('item', {});
    for (const [nombre, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
  }

  it('cada botón tiene relleno alrededor del ícono, para que se pueda tocar', () => {
    const lista = botones({ canReactivate: true });

    expect(lista.length).toBe(3); // editar, reactivar y eliminar
    for (const boton of lista) {
      expect(boton.classList.contains('p-2'), boton.getAttribute('aria-label') ?? '').toBe(true);
    }
  });

  it('el relleno no cambia qué botones hay ni sus nombres', () => {
    const nombres = botones({ canReactivate: true, canDelete: false }).map((b) => b.getAttribute('aria-label'));

    expect(nombres).toEqual(['Editar', 'Reactivar']);
  });
});
