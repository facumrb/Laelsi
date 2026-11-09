import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryMethod, IApiOrder, OrderState, PaymentMethod } from '@models/order.model';
import { supabase } from '@services/supabase.client';
import { OrderDetailModalComponent } from './order-detail-modal.component';

function crearOrden(telefono: string | null): IApiOrder {
  return {
    id: 15,
    status: OrderState.Pending,
    deliveryMethod: DeliveryMethod.RetiroSucursal,
    paymentMethod: PaymentMethod.Transferencia,
    totalAmount: 200,
    dateTime: '2026-10-20T15:00:00Z',
    createdAt: '2026-10-20T15:00:00Z',
    updatedAt: '2026-10-20T15:00:00Z',
    client: { id: 3, name: 'Ana', lastName: 'Pérez', email: 'ana@example.com', phone: telefono },
    items: [{ id: 1, quantity: 2, price: 100, product: { id: 9, name: 'Cuaderno', brand: 'Rivadavia', photos: [] } }],
  };
}

// Los clientes del registro rápido y los que entran con Google no cargan teléfono (la columna
// admite null). Antes el detalle de su orden fallaba al intentar armar el enlace de WhatsApp.
describe('OrderDetailModalComponent: contacto del cliente', () => {
  beforeEach(() => {
    // No se le habla al Supabase real
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: () => undefined } },
    } as never);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderizar(telefono: string | null): HTMLElement {
    const fixture = TestBed.createComponent(OrderDetailModalComponent);
    fixture.componentRef.setInput('order', crearOrden(telefono));
    fixture.componentRef.setInput('showClientInfo', true);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con teléfono: el enlace de WhatsApp lleva solo los dígitos', () => {
    const html = renderizar('+54 9 341-555-1234');

    const enlace = html.querySelector<HTMLAnchorElement>('a[title="Enviar WhatsApp"]');
    expect(enlace?.getAttribute('href')).toContain('https://wa.me/5493415551234?text=');
    expect(enlace?.textContent).toContain('+54 9 341-555-1234');
  });

  it('se anuncia como diálogo modal y su nombre es el número de pedido', () => {
    const html = renderizar('+54 9 341-555-1234');

    const dialogo = html.querySelector('[role="dialog"]')!;

    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    const titulo = html.querySelector(`#${dialogo.getAttribute('aria-labelledby')}`);
    expect(titulo?.textContent?.replace(/\s+/g, ' ').trim()).toBe('ID de Pedido: #15');
  });

  it('sin teléfono: el detalle se muestra igual, sin enlace de WhatsApp', () => {
    const html = renderizar(null);

    expect(html.querySelector('a[title="Enviar WhatsApp"]')).toBeNull();
    expect(html.textContent).toContain('Sin teléfono');
    expect(html.textContent).toContain('Cuaderno'); // el resto del modal se renderizó
  });

  it('con un teléfono sin dígitos tampoco arma un enlace roto', () => {
    const html = renderizar('---');

    expect(html.querySelector('a[title="Enviar WhatsApp"]')).toBeNull();
    expect(html.textContent).toContain('Sin teléfono');
  });
});
