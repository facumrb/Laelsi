import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from 'src/environments/environment';
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
});
