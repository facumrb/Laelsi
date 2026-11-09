import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from '@services/alert.service';
import { AuthService } from '@services/auth.service';
import { CartService } from '@services/cart.service';
import { IApiProduct, ProductState } from '@models/product.model';
import { AddToCartControlComponent } from './add-to-cart-control.component';

describe('AddToCartControlComponent', () => {
  const producto = (state: ProductState): IApiProduct =>
    ({
      id: 1,
      name: 'Cuaderno',
      state,
      stock: 5,
      category: { state: 'Activo' },
      prices: [{ id: 1, amount: 100, currency: 'ARS', validFrom: '', isCurrent: true }],
    }) as unknown as IApiProduct;

  const alerta = { modal: vi.fn() };

  function crear(esAdmin: boolean, prod: IApiProduct) {
    localStorage.clear();
    alerta.modal.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAdmin: () => esAdmin } },
        { provide: AlertService, useValue: alerta },
      ],
    });
    const fixture = TestBed.createComponent(AddToCartControlComponent);
    fixture.componentRef.setInput('product', prod);
    fixture.detectChanges();
    const boton = (fixture.nativeElement as HTMLElement).querySelector('button.elsi-add-initial-btn') as HTMLButtonElement;
    return { fixture, boton, carrito: TestBed.inject(CartService) };
  }

  beforeEach(() => TestBed.resetTestingModule());

  describe('un cliente', () => {
    it('agrega al carrito un producto activo', () => {
      const { boton, carrito } = crear(false, producto(ProductState.Activo));

      boton.click();

      expect(carrito.items().length).toBe(1);
      expect(alerta.modal).not.toHaveBeenCalled();
    });

    it('no puede agregar un producto pausado: el botón queda deshabilitado y dice que no está disponible', () => {
      const { boton, carrito } = crear(false, producto(ProductState.Pausado));

      expect(boton.disabled).toBe(true);
      expect(boton.getAttribute('aria-label')).toBe('No disponible por ahora');
      boton.click();
      expect(carrito.items().length).toBe(0);
    });
  });

  // PROVISIONAL-2026-11-09 (ID 68 de docs/requerimientos/discusiones.md)
  describe('un administrador', () => {
    it('no agrega nada al carrito: ve el aviso "MODO ADMIN: carrito no habilitado"', () => {
      const { boton, carrito } = crear(true, producto(ProductState.Activo));

      boton.click();

      expect(carrito.items().length).toBe(0);
      expect(alerta.modal).toHaveBeenCalledTimes(1);
      expect(alerta.modal.mock.calls[0][0]).toBe('MODO ADMIN: carrito no habilitado');
    });
  });
});
