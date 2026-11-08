import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { FooterComponent } from './footer.component';

function pie(): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(FooterComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

// Google exige que la política de privacidad esté enlazada desde el inicio, y la Disp. 954/2025
// que el botón de arrepentimiento se encuentre fácil (además del que está arriba, en el inicio).
describe('FooterComponent: enlaces legales', () => {
  function enlaces(): string[] {
    return Array.from(pie().querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
  }

  it('enlaza la Política de Privacidad y los Términos', () => {
    const hrefs = enlaces();

    expect(hrefs).toContain('/privacidad');
    expect(hrefs).toContain('/terminos');
  });

  // PROVISIONAL-2026-11-08 (arrepentimiento): el link del pie está comentado
  it('no enlaza el botón de arrepentimiento mientras esté comentado (PROVISIONAL-2026-11-08)', () => {
    expect(enlaces()).not.toContain('/arrepentimiento');
  });

  // PROVISIONAL-2026-11-08 (arrepentimiento): prueba ORIGINAL, comentada junto con el link
  // it('enlaza la Política de Privacidad, los Términos y el botón de arrepentimiento', () => {
  //   const hrefs = enlaces();
  //
  //   expect(hrefs).toContain('/privacidad');
  //   expect(hrefs).toContain('/terminos');
  //   expect(hrefs).toContain('/arrepentimiento');
  // });
});

// Disp. 954/2025, art. 6: el sitio informa el horario de atención, un canal para consultas y el
// área responsable de atenderlas.
describe('FooterComponent: atención de consultas y reclamos', () => {
  function texto(elemento: HTMLElement): string {
    return (elemento.textContent ?? '').replace(/\s+/g, ' ');
  }

  it('indica el área responsable de consultas y reclamos', () => {
    expect(texto(pie())).toContain('Consultas y reclamos: Atención al Cliente');
  });

  it('informa los horarios de atención y un canal de contacto (WhatsApp)', () => {
    const elemento = pie();
    const hrefs = Array.from(elemento.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');

    expect(texto(elemento)).toContain('Lunes a Viernes: 8:00 a 17:00');
    expect(texto(elemento)).toContain('Sábados: 9:00 a 13:00');
    expect(hrefs.some((href) => href.startsWith('https://wa.me/'))).toBe(true);
  });
});
