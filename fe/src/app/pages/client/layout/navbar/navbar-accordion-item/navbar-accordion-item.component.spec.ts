import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { cadenaAnidada } from '@shared/testing/categorias';
import { NavbarAccordionItemComponent } from './navbar-accordion-item.component';

// El acordeón del menú móvil se arma a sí mismo (cada categoría dibuja a sus hijas). Tiene que llegar hasta el
// quinto nivel, que es el máximo de profundidad que pueden crear los negocios.
describe('NavbarAccordionItemComponent: niveles', () => {
  it('muestra los cinco niveles de una rama activa, que se expanden solos', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NavbarAccordionItemComponent);
    fixture.componentRef.setInput('category', cadenaAnidada());
    fixture.componentRef.setInput('activeCategoryIds', new Set([1, 2, 3, 4, 5]));
    // Cada nivel se expande en su propio ciclo de detección: hace falta uno por nivel
    for (let ciclo = 0; ciclo < 8; ciclo++) fixture.detectChanges();

    const enlaces = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(enlaces).toEqual(['/category/1', '/category/2', '/category/3', '/category/4', '/category/5']);
  });

  it('una categoría sin hijas no ofrece el botón para expandir', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NavbarAccordionItemComponent);
    const hoja = { ...cadenaAnidada().children![0].children![0].children![0].children![0], children: [] };
    fixture.componentRef.setInput('category', hoja);
    fixture.componentRef.setInput('activeCategoryIds', new Set<number>());
    fixture.componentRef.setInput('depth', 4);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Inalámbricos');
  });
});
