import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LogoComponent } from './logo.component';

// ID 70 de docs/requerimientos/discusiones.md (rendimiento): el logo del cartel de bienvenida es el elemento que mide el
// LCP de la portada. El archivo original mide 996 px de ancho y pesa 40 kB, pero se muestra a unos 250 px: ahora hay una
// variante de 500 px (20 kB) y el navegador elige la que le alcanza.
describe('LogoComponent: imagen según el tamaño', () => {
  function renderizar(entradas: { width: number; height: number; priority?: 'high' }): HTMLImageElement {
    const fixture = TestBed.createComponent(LogoComponent);
    for (const [nombre, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('img')!;
  }

  it('ofrece la variante de 500 px y el original, y el original queda como respaldo en src', () => {
    const img = renderizar({ width: 240, height: 125 });

    expect(img.getAttribute('srcset')).toBe('assets/Webp/Logo-500.webp 500w, assets/Webp/Logo.webp 996w');
    expect(img.getAttribute('src')).toBe('assets/Webp/Logo.webp');
  });

  it('le dice al navegador cuánto ancho ocupa: el ancho que pide cada pantalla', () => {
    expect(renderizar({ width: 240, height: 125 }).getAttribute('sizes')).toBe('240px');
    expect(renderizar({ width: 128, height: 48 }).getAttribute('sizes')).toBe('128px');
  });

  it('con prioridad alta, avisa al navegador que la baje antes que lo demás; sin pedirla, no dice nada', () => {
    expect(renderizar({ width: 240, height: 125, priority: 'high' }).getAttribute('fetchpriority')).toBe('high');
    expect(renderizar({ width: 240, height: 125 }).hasAttribute('fetchpriority')).toBe(false);
  });
});
