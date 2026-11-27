import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { FormActionsComponent } from './form-actions.component';

// Pie de los formularios del panel: inputs (textos, deshabilitado, ruta) y output (cancelClick)
describe('FormActionsComponent', () => {
  function crear(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(FormActionsComponent);
    for (const [nombre, valor] of Object.entries(inputs)) {
      fixture.componentRef.setInput(nombre, valor);
    }
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [cancelar, enviar] = Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
    return { fixture, cancelar, enviar };
  }

  it('muestra los textos recibidos por input', () => {
    const { cancelar, enviar } = crear({ submitLabel: 'Guardar', cancelLabel: 'Volver' });

    expect(enviar.textContent?.trim()).toBe('Guardar');
    expect(enviar.type).toBe('submit');
    expect(cancelar.textContent?.trim()).toBe('Volver');
  });

  it('deshabilita el botón de envío con submitDisabled', () => {
    const { enviar } = crear({ submitLabel: 'Guardar', submitDisabled: true });

    expect(enviar.disabled).toBe(true);
  });

  it('sin cancelUrl, el clic en Cancelar emite cancelClick', () => {
    const { fixture, cancelar } = crear({ submitLabel: 'Guardar' });
    const emitido = vi.fn();
    fixture.componentInstance.cancelClick.subscribe(emitido);

    cancelar.click();

    expect(emitido).toHaveBeenCalledTimes(1);
  });

  it('con cancelUrl, el clic en Cancelar navega y no emite', () => {
    const { fixture, cancelar } = crear({ submitLabel: 'Guardar', cancelUrl: '/admin/products' });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const emitido = vi.fn();
    fixture.componentInstance.cancelClick.subscribe(emitido);

    cancelar.click();

    expect(navegar).toHaveBeenCalledWith('/admin/products');
    expect(emitido).not.toHaveBeenCalled();
  });
});
