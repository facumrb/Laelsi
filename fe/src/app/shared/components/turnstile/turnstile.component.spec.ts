import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elegirTamanoDelWidget, TurnstileComponent } from './turnstile.component';

// ID 64 (hallazgo 6): el widget de Cloudflare se dibujaba siempre en tamaño `normal` (300×65 px). En un celular de 320
// o 360 px el contenido de la tarjeta mide 222 o 262 px: el widget sobresalía. Según la documentación de Cloudflare:
// `normal` 300×65, `flexible` 100 % con mínimo 300 px (no arregla nada acá) y `compact` 150×140. El tamaño se pasa al
// dibujar el widget (no se documenta cambiarlo después), así que se decide con el ancho de la ventana en ese momento.
describe('elegirTamanoDelWidget', () => {
  it('por debajo de 400 px usa el compacto, que mide 150 px de ancho', () => {
    expect(elegirTamanoDelWidget(320)).toBe('compact');
    expect(elegirTamanoDelWidget(360)).toBe('compact');
    expect(elegirTamanoDelWidget(399)).toBe('compact');
  });

  it('desde 400 px usa el normal', () => {
    expect(elegirTamanoDelWidget(400)).toBe('normal');
    expect(elegirTamanoDelWidget(768)).toBe('normal');
    expect(elegirTamanoDelWidget(1366)).toBe('normal');
  });
});

describe('TurnstileComponent: tamaño con el que dibuja el widget', () => {
  const anchoOriginal = window.innerWidth;
  const render = vi.fn(() => 'widget-1');

  beforeEach(() => {
    render.mockClear();
    // El script de Cloudflare no se descarga en la prueba: se instala una API de mentira
    window.turnstile = { render, reset: vi.fn(), remove: vi.fn() };
  });

  afterEach(() => {
    delete window.turnstile;
    Object.defineProperty(window, 'innerWidth', { value: anchoOriginal, configurable: true });
  });

  async function dibujarConUnAncho(ancho: number) {
    Object.defineProperty(window, 'innerWidth', { value: ancho, configurable: true });
    const fixture = TestBed.createComponent(TurnstileComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return render.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>];
  }

  it('en un celular de 360 px lo dibuja compacto', async () => {
    const [, opciones] = await dibujarConUnAncho(360);

    expect(opciones['size']).toBe('compact');
  });

  it('en una pantalla de 768 px lo dibuja normal', async () => {
    const [, opciones] = await dibujarConUnAncho(768);

    expect(opciones['size']).toBe('normal');
  });

  // ID 64: `app-turnstile` es un elemento personalizado, en línea por defecto: el margen que le da `space-y-4` a sus
  // hermanos no se aplica en vertical y el widget quedaba pegado al botón "Crear Cuenta". Como bloque, el espacio vale.
  it('el elemento del componente es un bloque, para que el espacio entre hermanos se aplique', async () => {
    await dibujarConUnAncho(360);
    const fixture = TestBed.createComponent(TurnstileComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).classList.contains('block')).toBe(true);
  });

  it('sigue pasando la clave y los avisos de token', async () => {
    const [, opciones] = await dibujarConUnAncho(360);

    expect(typeof opciones['sitekey']).toBe('string');
    expect((opciones['sitekey'] as string).length).toBeGreaterThan(0);
    expect(typeof opciones['callback']).toBe('function');
    expect(typeof opciones['expired-callback']).toBe('function');
    expect(typeof opciones['error-callback']).toBe('function');
  });
});
