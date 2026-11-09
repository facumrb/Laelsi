import { describe, expect, it } from 'vitest';
import { ProductState } from '@models/product.model';
import {
  AVISO_INACTIVO,
  AVISO_PAUSADO,
  disponibilidadEnCarrito,
  esComprable,
  esVisibleEnTienda,
  mensajeDeConsultaPorWhatsApp,
} from './disponibilidad-producto';

// Mismas reglas que el servidor (supabase/functions/_shared/publicacion.ts). Discusión del ID 54:
//   Activo   se ve en la tienda y se puede comprar.
//   Pausado  SE VE como "no disponible por ahora"; no se puede comprar. El stock no cambia.
//   Inactivo NO aparece en la tienda.
describe('disponibilidadEnCarrito', () => {
  it('un producto Activo está disponible y no lleva aviso', () => {
    expect(disponibilidadEnCarrito(ProductState.Activo)).toEqual({
      disponible: true,
      motivo: null,
      mensaje: null,
    });
  });

  it('un producto Pausado avisa que la publicación está en pausa', () => {
    expect(disponibilidadEnCarrito(ProductState.Pausado)).toEqual({
      disponible: false,
      motivo: 'pausado',
      mensaje: 'La publicación está en pausa hasta nuevo aviso.',
    });
  });

  it('un producto Inactivo avisa que el negocio ya no trabaja con él', () => {
    expect(disponibilidadEnCarrito(ProductState.Inactivo)).toEqual({
      disponible: false,
      motivo: 'inactivo',
      mensaje: 'El negocio no está trabajando actualmente con este producto.',
    });
  });

  it('mientras no se sabe el estado actual no se avisa nada (no se asusta al cliente antes de preguntar)', () => {
    expect(disponibilidadEnCarrito(undefined).disponible).toBe(true);
    expect(disponibilidadEnCarrito(null).mensaje).toBeNull();
  });

  it('los avisos de pausado e inactivo son distintos', () => {
    expect(AVISO_PAUSADO).not.toBe(AVISO_INACTIVO);
  });
});

describe('esComprable y esVisibleEnTienda', () => {
  it('solo un producto Activo se puede comprar', () => {
    expect(esComprable(ProductState.Activo)).toBe(true);
    expect(esComprable(ProductState.Pausado)).toBe(false);
    expect(esComprable(ProductState.Inactivo)).toBe(false);
  });

  it('un producto Pausado se sigue viendo en la tienda; uno Inactivo no', () => {
    expect(esVisibleEnTienda(ProductState.Activo)).toBe(true);
    expect(esVisibleEnTienda(ProductState.Pausado)).toBe(true);
    expect(esVisibleEnTienda(ProductState.Inactivo)).toBe(false);
  });
});

describe('mensajeDeConsultaPorWhatsApp', () => {
  it('pregunta cuándo vuelve el producto, con su nombre', () => {
    expect(mensajeDeConsultaPorWhatsApp('Cuaderno A4')).toBe('Hola, quería consultar cuándo vuelve «Cuaderno A4».');
  });

  it('con otro nombre arma otro mensaje', () => {
    expect(mensajeDeConsultaPorWhatsApp('Lapicera azul')).toContain('«Lapicera azul»');
  });
});
