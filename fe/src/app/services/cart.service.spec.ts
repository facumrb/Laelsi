import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from 'src/environments/environment';
import { IApiProduct, ProductState } from '@models/product.model';
import { CartService } from './cart.service';

// El carrito guarda una COPIA del producto, así que su estado puede estar vencido: un producto se pausa o
// se desactiva después de agregarlo. Discusión del ID 54 (docs/requerimientos/discusiones.md): el producto
// sigue en el carrito con su aviso, no deja sumar unidades y no cuenta en el total.
describe('CartService: productos pausados o inactivos', () => {
  const urlDisponibilidad = `${environment.apiUrl}/products/availability`;

  function producto(id: number, precio: number, state: ProductState = ProductState.Activo): IApiProduct {
    return {
      id,
      name: `Producto ${id}`,
      state,
      stock: 10,
      prices: [{ id, amount: precio, currency: 'ARS', validFrom: '', isCurrent: true }],
    } as IApiProduct;
  }

  let carrito: CartService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    carrito = TestBed.inject(CartService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('refreshAvailability', () => {
    it('pregunta por todos los productos del carrito en una sola petición', () => {
      carrito.addToCart(producto(1, 100));
      carrito.addToCart(producto(2, 50));

      carrito.refreshAvailability();

      const peticion = http.expectOne((req) => req.url === urlDisponibilidad);
      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.get('ids')).toBe('1,2');
      peticion.flush({ message: 'ok', data: { 1: 'Activo', 2: 'Activo' } });
    });

    it('un producto pausado queda con el aviso de pausa y uno activo sin aviso', () => {
      carrito.addToCart(producto(1, 100));
      carrito.addToCart(producto(2, 50));

      carrito.refreshAvailability();
      http.expectOne((req) => req.url === urlDisponibilidad).flush({ message: 'ok', data: { 1: 'Pausado', 2: 'Activo' } });

      expect(carrito.availabilityOf(1).motivo).toBe('pausado');
      expect(carrito.availabilityOf(1).mensaje).toBe('La publicación está en pausa hasta nuevo aviso.');
      expect(carrito.availabilityOf(2).disponible).toBe(true);
      expect(carrito.hasUnavailable()).toBe(true);
    });

    it('un producto inactivo (o que ya no existe) queda con el aviso de que el negocio no trabaja con él', () => {
      carrito.addToCart(producto(7, 100));

      carrito.refreshAvailability();
      http.expectOne((req) => req.url === urlDisponibilidad).flush({ message: 'ok', data: { 7: 'Inactivo' } });

      expect(carrito.availabilityOf(7).motivo).toBe('inactivo');
    });

    it('si todo está activo no hay productos no disponibles', () => {
      carrito.addToCart(producto(1, 100));

      carrito.refreshAvailability();
      http.expectOne((req) => req.url === urlDisponibilidad).flush({ message: 'ok', data: { 1: 'Activo' } });

      expect(carrito.hasUnavailable()).toBe(false);
    });

    it('con el carrito vacío no hace ninguna petición', () => {
      carrito.refreshAvailability();

      http.expectNone((req) => req.url === urlDisponibilidad);
    });

    it('si la consulta falla no se avisa nada de lo que no se sabe (el servidor igual rechaza al confirmar)', () => {
      carrito.addToCart(producto(1, 100));

      carrito.refreshAvailability();
      http.expectOne((req) => req.url === urlDisponibilidad).flush('error', { status: 500, statusText: 'Error' });

      expect(carrito.availabilityOf(1).disponible).toBe(true);
      expect(carrito.hasUnavailable()).toBe(false);
    });
  });

  describe('total', () => {
    it('un producto no disponible no cuenta en el total, pero sigue en el carrito', () => {
      carrito.addToCart(producto(1, 100), 2); // pausado: 200 que no se cobran
      carrito.addToCart(producto(2, 50), 1);

      carrito.refreshAvailability();
      http.expectOne((req) => req.url === urlDisponibilidad).flush({ message: 'ok', data: { 1: 'Pausado', 2: 'Activo' } });

      expect(carrito.totalAmount()).toBe(50);
      expect(carrito.items().length).toBe(2);
      expect(carrito.totalItems()).toBe(3);
    });

    it('sin productos no disponibles el total es la suma de todos', () => {
      carrito.addToCart(producto(1, 100), 2);
      carrito.addToCart(producto(2, 50), 1);

      expect(carrito.totalAmount()).toBe(250);
    });
  });

  describe('cantidades', () => {
    function pausarElProducto1() {
      carrito.addToCart(producto(1, 100), 2);
      carrito.refreshAvailability();
      http.expectOne((req) => req.url === urlDisponibilidad).flush({ message: 'ok', data: { 1: 'Pausado' } });
    }

    it('no deja aumentar la cantidad de un producto no disponible', () => {
      pausarElProducto1();

      carrito.updateQuantity(1, 3);

      expect(carrito.items()[0].quantity).toBe(2);
    });

    it('sí deja bajar la cantidad y quitarlo', () => {
      pausarElProducto1();

      carrito.updateQuantity(1, 1);
      expect(carrito.items()[0].quantity).toBe(1);

      carrito.removeFromCart(1);
      expect(carrito.items().length).toBe(0);
    });

    it('un producto disponible sigue permitiendo aumentar la cantidad', () => {
      carrito.addToCart(producto(2, 50), 1);

      carrito.updateQuantity(2, 4);

      expect(carrito.items()[0].quantity).toBe(4);
    });
  });

  describe('addToCart', () => {
    it('no agrega un producto pausado ni uno inactivo', () => {
      expect(carrito.addToCart(producto(1, 100, ProductState.Pausado))).toBe(false);
      expect(carrito.addToCart(producto(2, 100, ProductState.Inactivo))).toBe(false);

      expect(carrito.items().length).toBe(0);
    });

    it('agrega un producto activo', () => {
      expect(carrito.addToCart(producto(3, 100, ProductState.Activo))).toBe(true);

      expect(carrito.items().length).toBe(1);
    });
  });
});
