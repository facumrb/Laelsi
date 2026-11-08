import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { cadenaAnidada } from '@shared/testing/categorias';
import { NavbarCategoryBarComponent } from './navbar-category-bar.component';

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
