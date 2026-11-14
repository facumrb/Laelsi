import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from 'src/environments/environment';
import { PETICION_PUBLICA } from '../../interceptors/peticion-publica';
import { ApiProductService } from './api-product.service';

describe('ApiProductService', () => {
  const url = `${environment.apiUrl}/products`;
  let servicio: ApiProductService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ApiProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ID 70 de docs/requerimientos/discusiones.md (mejora 2 de rendimiento-investigacion-2026-11-09.md): la portada
  // hacía 8 llamadas en dos tandas; ahora pide todo junto.
  describe('getHome', () => {
    it('pide la portada completa con una sola llamada a /products/home', () => {
      let recibido: unknown;
      servicio.getHome().subscribe((home) => (recibido = home));

      const peticion = http.expectOne(`${url}/home`);
      expect(peticion.request.method).toBe('GET');
      peticion.flush({ message: 'Portada encontrada', data: { bestSellers: [{ id: 1 }], categories: [] } });

      expect(recibido).toEqual({ bestSellers: [{ id: 1 }], categories: [] });
    });
  });

  // ID 54: el carrito consulta el estado actual de varios productos juntos
  describe('getAvailability', () => {
    it('pide el estado de todos los ids juntos', () => {
      servicio.getAvailability([3, 7]).subscribe();

      const peticion = http.expectOne((req) => req.url === `${url}/availability`);
      expect(peticion.request.params.get('ids')).toBe('3,7');
      peticion.flush({ message: 'ok', data: { 3: 'Activo', 7: 'Pausado' } });
    });
  });

  // Los pedidos del catálogo que no dependen de la sesión salen sin apikey ni Authorization (ver auth.interceptor.ts)
  describe('marca de petición pública', () => {
    const marca = (matcher: (req: { url: string }) => boolean) => {
      const peticion = http.expectOne(matcher);
      const valor = peticion.request.context.get(PETICION_PUBLICA);
      peticion.flush({ message: 'ok', data: {} });
      return valor;
    };

    const publicos: [string, string, () => void][] = [
      ['getHome', `${url}/home`, () => servicio.getHome().subscribe()],
      ['getAvailability', `${url}/availability`, () => servicio.getAvailability([1]).subscribe()],
      ['getActiveProducts', `${url}/active`, () => servicio.getActiveProducts().subscribe()],
      ['searchProducts', `${url}/search`, () => servicio.searchProducts('x').subscribe()],
      [
        'getActiveProductsByCategory',
        `${url}/active/category/4`,
        () => servicio.getActiveProductsByCategory(4).subscribe(),
      ],
      ['getBestSellers', `${url}/best-sellers`, () => servicio.getBestSellers().subscribe()],
      [
        'getBestSellersByCategory',
        `${url}/best-sellers/category/4`,
        () => servicio.getBestSellersByCategory(4).subscribe(),
      ],
      ['getProductById (tienda)', `${url}/9`, () => servicio.getProductById(9, true).subscribe()],
    ];

    for (const [nombre, ruta, llamar] of publicos) {
      it(`${nombre} lleva la marca`, () => {
        llamar();
        expect(marca((req) => req.url === ruta)).toBe(true);
      });
    }

    const privados: [string, string, () => void][] = [
      ['getProductById (panel)', `${url}/9`, () => servicio.getProductById(9).subscribe()],
      ['getAllProducts', url, () => servicio.getAllProducts().subscribe()],
      ['getProductsByCategory', `${url}/category/4`, () => servicio.getProductsByCategory(4).subscribe()],
      ['getBulkHistory', `${environment.apiUrl}/bulk-prices/history`, () => servicio.getBulkHistory().subscribe()],
    ];

    for (const [nombre, ruta, llamar] of privados) {
      it(`${nombre} no lleva la marca`, () => {
        llamar();
        expect(marca((req) => req.url === ruta)).toBe(false);
      });
    }
  });
});
