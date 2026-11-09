import { describe, expect, it } from 'vitest';
import { hayTelefono, validarTelefono } from './telefono';

// Mismas reglas que el formulario del perfil (FormUtils.phonePattern y largo de 7 a 20): solo números,
// espacios, guiones y un + inicial.
describe('validarTelefono', () => {
  it.each(['3415550000', '341 555-0000', '+54 9 341 555-0000', '1234567'])('acepta %s', (telefono) => {
    expect(validarTelefono(telefono)).toBeNull();
  });

  it('pide un teléfono si está vacío o son solo espacios', () => {
    expect(validarTelefono('')).toBe('Ingresá un teléfono de contacto');
    expect(validarTelefono('   ')).toBe('Ingresá un teléfono de contacto');
  });

  it('rechaza letras y símbolos', () => {
    expect(validarTelefono('341abc5550')).toBe('Solo se permiten números, espacios, guiones (-) y el signo más (+).');
    expect(validarTelefono('(341) 5550000')).toBe('Solo se permiten números, espacios, guiones (-) y el signo más (+).');
  });

  it('rechaza uno demasiado corto', () => {
    expect(validarTelefono('123456')).toBe('El teléfono debe tener al menos 7 caracteres');
  });

  it('rechaza uno demasiado largo', () => {
    expect(validarTelefono('1'.repeat(21))).toBe('El teléfono puede tener como máximo 20 caracteres');
    expect(validarTelefono('1'.repeat(20))).toBeNull();
  });

  it('ignora los espacios de los bordes', () => {
    expect(validarTelefono('  3415550000  ')).toBeNull();
  });
});

describe('hayTelefono', () => {
  it('es verdadero si hay un teléfono cargado', () => {
    expect(hayTelefono('3415550000')).toBe(true);
  });

  it('es falso si falta: null, indefinido, vacío o solo espacios', () => {
    expect(hayTelefono(null)).toBe(false);
    expect(hayTelefono(undefined)).toBe(false);
    expect(hayTelefono('')).toBe(false);
    expect(hayTelefono('   ')).toBe(false);
  });
});
