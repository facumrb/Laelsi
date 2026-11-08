import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutUsPageComponent } from './about-us-page/about-us-page.component';
import { FaqPageComponent } from './faq-page/faq-page.component';
import { LEGAL_INFO } from './legal-info';
import { PrivacyPageComponent } from './privacy-page/privacy-page.component';
import { TermsPageComponent } from './terms-page/terms-page.component';

function renderizar(componente: Type<unknown>): { texto: string; enlaces: string[] } {
  const fixture = TestBed.createComponent(componente);
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  return {
    texto: raiz.textContent ?? '',
    enlaces: Array.from(raiz.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? ''),
  };
}

describe('Páginas legales', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    // jsdom no implementa scrollTo
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Política de Privacidad', () => {
    it('muestra el título y la versión vigente', () => {
      const { texto } = renderizar(PrivacyPageComponent);

      expect(texto).toContain('Política de Privacidad');
      expect(texto).toContain(`Última actualización: ${LEGAL_INFO.lastUpdate}`);
    });

    it('explica qué datos recibe de Google y cumple con el Uso Limitado', () => {
      const { texto, enlaces } = renderizar(PrivacyPageComponent);

      expect(texto).toContain('Inicio de sesión con Google');
      expect(texto).toMatch(/openid.*email.*profile/s);
      expect(texto).toContain('Uso Limitado');
      expect(enlaces).toContain('https://developers.google.com/terms/api-services-user-data-policy');
    });

    it('incluye las dos leyendas que exige la Disposición 10/2008 sobre datos personales', () => {
      const { texto } = renderizar(PrivacyPageComponent);

      expect(texto).toContain('intervalos no inferiores a seis meses');
      expect(texto).toContain('Agencia de Acceso a la Información Pública');
    });

    it('declara los datos de la aceptación de los Términos', () => {
      const { texto } = renderizar(PrivacyPageComponent);

      expect(texto).toContain('casilla de aceptación');
    });

    // PROVISIONAL-2026-11-08 (arrepentimiento): sus datos y su tratamiento están comentados en la política
    it('no menciona el botón de arrepentimiento mientras esté comentado (PROVISIONAL-2026-11-08)', () => {
      const { texto } = renderizar(PrivacyPageComponent);

      expect(texto).toContain('Política de Privacidad');
      expect(texto).not.toMatch(/arrepentimiento/i);
    });

    // PROVISIONAL-2026-11-08 (arrepentimiento): prueba ORIGINAL, comentada junto con el texto
    // it('declara los datos del botón de arrepentimiento y de la aceptación de los Términos', () => {
    //   const { texto } = renderizar(PrivacyPageComponent);
    //
    //   expect(texto).toContain('Botón de arrepentimiento');
    //   expect(texto).toContain('casilla de aceptación');
    // });

    it('lleva a los Términos y Condiciones', () => {
      expect(renderizar(PrivacyPageComponent).enlaces).toContain('/terminos');
    });

    it('explica que con Google se acepta la primera vez que se entra y que queda constancia', () => {
      const { texto } = renderizar(PrivacyPageComponent);

      expect(texto).toContain('la primera vez que entrás con Google');
      expect(texto).toContain('guardamos la constancia (fecha y versión)');
    });

    it('identifica al responsable y su contacto', () => {
      const { texto } = renderizar(PrivacyPageComponent);

      expect(texto).toContain(LEGAL_INFO.address);
      expect(texto).toContain(LEGAL_INFO.whatsappLabel);
    });
  });

  describe('Términos y Condiciones', () => {
    it('muestra el título y la versión vigente', () => {
      const { texto } = renderizar(TermsPageComponent);

      expect(texto).toContain('Términos y Condiciones');
      expect(texto).toContain(`Última actualización: ${LEGAL_INFO.lastUpdate}`);
    });

    it('dice lo que hace el checkout: solo retiro en sucursal y sin cobro en línea', () => {
      const { texto } = renderizar(TermsPageComponent);

      expect(texto).toContain('Retiro en sucursal');
      expect(texto).toContain('por el momento no hacemos envíos');
      expect(texto).toContain('no procesa pagos');
    });

    // PROVISIONAL-2026-11-08 (arrepentimiento): el derecho de revocación existe por ley con o sin botón, así que
    // el texto sigue; solo se comentó la instrucción de usar el botón y el link. Queda el canal de
    // WhatsApp y el local que el propio texto ya ofrecía.
    it('informa el derecho de revocación y cómo pedirlo, sin llevar al botón (PROVISIONAL-2026-11-08)', () => {
      const { texto, enlaces } = renderizar(TermsPageComponent);

      expect(texto).toContain('10 días corridos');
      expect(texto).toContain('art. 34 de la Ley N° 24.240');
      expect(texto).toContain('pedirlo por WhatsApp o en el local');
      expect(texto).not.toContain('Botón de arrepentimiento');
      expect(enlaces).not.toContain('/arrepentimiento');
    });

    // PROVISIONAL-2026-11-08 (arrepentimiento): prueba ORIGINAL, comentada junto con el link
    // it('informa el derecho de revocación y lleva al botón de arrepentimiento', () => {
    //   const { texto, enlaces } = renderizar(TermsPageComponent);
    //
    //   expect(texto).toContain('10 días corridos');
    //   expect(texto).toContain('art. 34 de la Ley N° 24.240');
    //   expect(enlaces).toContain('/arrepentimiento');
    // });

    it('lleva a la Política de Privacidad', () => {
      expect(renderizar(TermsPageComponent).enlaces).toContain('/privacidad');
    });

    it('explica cómo se aceptan los Términos con el formulario y con Google', () => {
      const { texto } = renderizar(TermsPageComponent);

      expect(texto).toContain('tildando una casilla');
      expect(texto).toContain('si entrás con Google, la primera vez te pedimos que los aceptes');
    });
  });

  // Se pre-renderizan en el build, que corre en Node: sin localStorage, sessionStorage ni window propio.
  // Si alguien les agrega una dependencia del navegador, el build fallaría en Vercel; acá se detecta antes.
  describe('requisito del pre-renderizado', () => {
    it.each([
      ['la Política de Privacidad', PrivacyPageComponent],
      ['los Términos y Condiciones', TermsPageComponent],
    ])('%s se puede renderizar sin localStorage ni sessionStorage', (_nombre, componente) => {
      vi.stubGlobal('localStorage', undefined);
      vi.stubGlobal('sessionStorage', undefined);

      expect(() => renderizar(componente)).not.toThrow();
    });
  });

  // El FAQ y "¿Quiénes somos?" no pueden prometer lo que el checkout no hace (Ley 24.240, publicidad)
  describe('coherencia con el checkout', () => {
    const promesasFalsas = [/todo el pa[ií]s/i, /invitado/i, /recibir[aá]s un email/i, /entorno seguro/i];

    it('el FAQ no promete envíos nacionales, compra como invitado ni un email de confirmación', () => {
      const respuestas = TestBed.createComponent(FaqPageComponent)
        .componentInstance.faqs.map((faq) => `${faq.question} ${faq.answer}`)
        .join(' ');

      for (const promesa of promesasFalsas) expect(respuestas).not.toMatch(promesa);
    });

    // PROVISIONAL-2026-11-08 (arrepentimiento): el FAQ sigue informando el plazo, pero ya no manda al botón
    it('el FAQ informa que no hay envíos y el plazo de arrepentimiento, sin mandar al botón (PROVISIONAL-2026-11-08)', () => {
      const respuestas = TestBed.createComponent(FaqPageComponent)
        .componentInstance.faqs.map((faq) => faq.answer)
        .join(' ');

      expect(respuestas).toContain('no hacemos envíos');
      expect(respuestas).toContain('10 días corridos');
      expect(respuestas).not.toContain('Botón de arrepentimiento');
    });

    // PROVISIONAL-2026-11-08 (arrepentimiento): prueba ORIGINAL, comentada junto con la respuesta
    // it('el FAQ informa que no hay envíos y menciona el botón de arrepentimiento', () => {
    //   const respuestas = TestBed.createComponent(FaqPageComponent)
    //     .componentInstance.faqs.map((faq) => faq.answer)
    //     .join(' ');
    //
    //   expect(respuestas).toContain('no hacemos envíos');
    //   expect(respuestas).toContain('Botón de arrepentimiento');
    // });

    it('"¿Quiénes somos?" no promete envíos a todo el país', () => {
      const { texto } = renderizar(AboutUsPageComponent);

      for (const promesa of promesasFalsas) expect(texto).not.toMatch(promesa);
    });
  });
});
