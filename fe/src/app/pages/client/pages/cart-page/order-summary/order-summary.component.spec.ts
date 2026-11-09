import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IApiProduct, ProductState } from '@models/product.model';
import { AlertService } from '@services/alert.service';
import { ApiClientService } from '@services/api-services/api-client.service';
import { ApiOrderService } from '@services/api-services/api-order.service';
import { AuthService } from '@services/auth.service';
import { CartService } from '@services/cart.service';
import { OrderSummaryComponent } from './order-summary.component';

// ID 71 de docs/requerimientos/discusiones.md (pregunta 2 de la comparativa): el teléfono es el único dato que el
// negocio necesita de verdad para coordinar el retiro y el pago, y es el único momento en que hace falta: al
// confirmar un pedido. Si el cliente no lo tiene cargado, se le pide ahí y se guarda en su perfil.
describe('OrderSummaryComponent: teléfono de contacto al confirmar el pedido', () => {
  const producto = {
    id: 1,
    name: 'Cuaderno',
    state: ProductState.Activo,
    stock: 10,
    prices: [{ id: 1, amount: 100, currency: 'ARS', validFrom: '', isCurrent: true }],
  } as unknown as IApiProduct;

  const alerta = {
    modal: vi.fn(),
    confirmAction: vi.fn(),
    askPhone: vi.fn(),
    success: vi.fn(),
  };
  const clientes = { getAccountInfoById: vi.fn(), updateClient: vi.fn() };
  const pedidos = { createOrder: vi.fn() };
  const router = { navigate: vi.fn() };

  function crear() {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(new QueryClient()),
        { provide: AlertService, useValue: alerta },
        { provide: ApiClientService, useValue: clientes },
        { provide: ApiOrderService, useValue: pedidos },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 5 }) } },
        { provide: Router, useValue: router },
      ],
    });
    TestBed.inject(CartService).addToCart(producto, 2);
    const fixture = TestBed.createComponent(OrderSummaryComponent);
    // La verificación anti-bots no es lo que se prueba acá
    fixture.componentInstance.turnstileToken.set('token-de-prueba');
    return fixture.componentInstance;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    alerta.confirmAction.mockResolvedValue(false);
    pedidos.createOrder.mockReturnValue(of({}));
    clientes.updateClient.mockReturnValue(of({}));
  });

  it('con teléfono cargado no lo pide y sigue con la confirmación', async () => {
    clientes.getAccountInfoById.mockReturnValue(of({ id: 5, phone: '3415550000' }));
    const resumen = crear();

    await resumen.checkout();

    expect(alerta.askPhone).not.toHaveBeenCalled();
    expect(clientes.updateClient).not.toHaveBeenCalled();
    expect(alerta.confirmAction).toHaveBeenCalledTimes(1);
  });

  it('sin teléfono lo pide, lo guarda en el perfil y sigue con la confirmación', async () => {
    clientes.getAccountInfoById.mockReturnValue(of({ id: 5, phone: null }));
    alerta.askPhone.mockResolvedValue('341 555-0000');
    const resumen = crear();

    await resumen.checkout();

    expect(alerta.askPhone).toHaveBeenCalledTimes(1);
    expect(clientes.updateClient).toHaveBeenCalledWith(5, { phone: '341 555-0000' });
    expect(alerta.confirmAction).toHaveBeenCalledTimes(1);
  });

  it('un teléfono de solo espacios cuenta como faltante', async () => {
    clientes.getAccountInfoById.mockReturnValue(of({ id: 5, phone: '   ' }));
    alerta.askPhone.mockResolvedValue('3415550000');
    const resumen = crear();

    await resumen.checkout();

    expect(alerta.askPhone).toHaveBeenCalledTimes(1);
  });

  it('si la persona cancela el pedido del teléfono, no se confirma ni se guarda nada', async () => {
    clientes.getAccountInfoById.mockReturnValue(of({ id: 5, phone: null }));
    alerta.askPhone.mockResolvedValue(null);
    const resumen = crear();

    await resumen.checkout();

    expect(clientes.updateClient).not.toHaveBeenCalled();
    expect(alerta.confirmAction).not.toHaveBeenCalled();
    expect(pedidos.createOrder).not.toHaveBeenCalled();
  });

  it('si no se puede consultar la cuenta, no se confirma el pedido', async () => {
    clientes.getAccountInfoById.mockReturnValue(throwError(() => new Error('sin conexión')));
    const resumen = crear();

    await resumen.checkout();

    expect(alerta.confirmAction).not.toHaveBeenCalled();
    expect(pedidos.createOrder).not.toHaveBeenCalled();
  });

  it('con teléfono y confirmación, el pedido se crea con los productos del carrito', async () => {
    clientes.getAccountInfoById.mockReturnValue(of({ id: 5, phone: '3415550000' }));
    alerta.confirmAction.mockResolvedValue(true);
    const resumen = crear();

    await resumen.checkout();

    expect(pedidos.createOrder).toHaveBeenCalledTimes(1);
    expect(pedidos.createOrder.mock.calls[0][0].items).toEqual([{ productId: 1, quantity: 2 }]);
  });
});
