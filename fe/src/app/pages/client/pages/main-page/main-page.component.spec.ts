import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from 'src/environments/environment';
import { IApiProduct } from '@models/product.model';
import { MainPageComponent } from './main-page.component';

// Los pedidos de productos nunca se responden: la home queda cargando y el cartel tiene que verse igual
function inicio(): HTMLElement {
  const fixture = TestBed.createComponent(MainPageComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    ],
  });
});

// ID 70 de docs/requerimientos/discusiones.md (mejora 2 de rendimiento-investigacion-2026-11-09.md): la portada
// hacía 8 llamadas a la API en dos tandas (más vendidos, categorías y, recién después, los más vendidos de cada
// una de las 5 primeras). Ahora pide todo con una sola llamada a /products/home.
describe('MainPageComponent: portada con una sola llamada', () => {
  const producto = (id: number, nombre: string) =>
    ({
      id,
      name: nombre,
      brand: 'Marca',
      state: 'Activo',
      stock: 5,
      photos: [],
      prices: [{ id, amount: 100, currency: 'ARS', validFrom: '', isCurrent: true }],
      category: { id: 1, name: 'Útiles', state: 'Activo' },
    }) as unknown as IApiProduct;

  // Las consultas se disparan en la tarea siguiente: se deja pasar antes de mirar los pedidos
  const dejarPasar = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const urlHome = `${environment.apiUrl}/products/home`;

  it('hace un solo pedido: el de la portada, sin los de más vendidos ni categorías', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MainPageComponent);
    fixture.detectChanges();
    await dejarPasar();

    const pedidos = http.match(() => true);

    expect(pedidos.map((p) => p.request.url)).toEqual([urlHome]);
  });

  it('muestra los más vendidos y el carrusel de cada categoría que llegan juntos', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MainPageComponent);
    fixture.detectChanges();
    await dejarPasar();

    http.expectOne(urlHome).flush({
      message: 'Portada encontrada',
      data: {
        bestSellers: [producto(1, 'Cuaderno rayado')],
        categories: [{ category: { id: 1, name: 'Útiles' }, products: [producto(2, 'Lapicera azul')] }],
      },
    });

    // TanStack Query publica el resultado en una tarea posterior: se espera hasta que aparezca
    await vi.waitFor(() => {
      fixture.detectChanges();
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('Cuaderno rayado');
      expect(texto).toContain('Útiles - Más Populares');
      expect(texto).toContain('Lapicera azul');
    });
  });
});

// PROVISIONAL-2026-11-08 (cartel): rediseño de urgencia del "Bienvenidos a Laelsi". El diseño
// definitivo del inicio llega con la etapa E2a (docs/hoja-de-ruta-etapas-2026-11-07.md) y reemplaza
// a este cartel. Estas pruebas fijan lo mínimo que el negocio necesita hoy: el saludo con el logo, lo
// que vende, y que las formas decorativas no estorben a quien usa un lector de pantalla.
describe('MainPageComponent: cartel de bienvenida', () => {
  it('saluda con un único título que dice "Bienvenidos a" y lleva el logo de Laelsi', () => {
    const titulos = inicio().querySelectorAll('h1');

    expect(titulos.length).toBe(1);
    expect(titulos[0].textContent).toContain('Bienvenidos a');
    expect(titulos[0].querySelector('img')?.getAttribute('alt')).toBe('Laelsi');
  });

  it('mantiene la bajada que cuenta qué vende el negocio', () => {
    expect(inicio().textContent).toContain('Todo en librería, juguetería y tecnología');
  });

  it('les esconde a los lectores de pantalla las formas decorativas del cartel', () => {
    const decorativas = Array.from(inicio().querySelectorAll('header [aria-hidden="true"]'));

    expect(decorativas.length).toBeGreaterThan(0);
    for (const forma of decorativas) expect(forma.textContent?.trim()).toBe('');
  });
});

// PROVISIONAL-2026-11-08 (arrepentimiento): el botón, su franja y su ruta están COMENTADOS en el
// frontend. El backend (función `revocations`) y la base NO se tocaron. Para reactivarlo, buscá
// `PROVISIONAL-2026-11-08` y descomentá cada bloque marcado (arrepentimiento), también las pruebas de
// abajo y las de footer.component.spec.ts y legal-pages.spec.ts.
describe('MainPageComponent: botón de arrepentimiento (PROVISIONAL-2026-11-08)', () => {
  it('no se ofrece mientras esté comentado: ni el link, ni la franja, ni su texto', () => {
    const raiz = inicio();

    expect(raiz.querySelector('a[href="/arrepentimiento"]')).toBeNull();
    expect(raiz.querySelector('section[aria-label="Botón de arrepentimiento"]')).toBeNull();
    expect(raiz.textContent).not.toContain('Te arrepentiste');
  });
});

// PROVISIONAL-2026-11-08 (arrepentimiento): pruebas ORIGINALES, comentadas junto con el botón.
// Disp. 954/2025, art. 1: el link "Botón de arrepentimiento" tiene que estar a simple vista, en lugar
// destacado y en el primer acceso. No pide un banner ni explicar el plazo: eso se cuenta en
// /arrepentimiento, y a quien ya compró en sus pedidos. En el inicio lo ve cualquier visitante.
//
// describe('MainPageComponent: botón de arrepentimiento', () => {
//   it('ofrece el link a /arrepentimiento aunque los productos todavía estén cargando', () => {
//     const enlace = inicio().querySelector<HTMLAnchorElement>('a[href="/arrepentimiento"]');
//
//     expect(enlace?.textContent?.trim()).toBe('Botón de arrepentimiento');
//   });
//
//   it('no le habla de plazos ni de cuentas a quien solo está mirando la tienda', () => {
//     const aviso = inicio().querySelector('section[aria-label="Botón de arrepentimiento"]');
//
//     expect(aviso?.textContent).toContain('Botón de arrepentimiento');
//     expect(aviso?.textContent).not.toMatch(/10 d[ií]as|sesi[oó]n|cuenta/i);
//   });
//
//   it('aparece antes que el mensaje de bienvenida: en el primer acceso, sin tener que bajar', () => {
//     const raiz = inicio();
//     const enlace = raiz.querySelector('a[href="/arrepentimiento"]');
//     const bienvenida = raiz.querySelector('h1');
//
//     expect(enlace?.compareDocumentPosition(bienvenida as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
//   });
// });
