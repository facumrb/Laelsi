import { describe, expect, it } from 'vitest';
import { NombrePersonaPipe } from './nombre-persona.pipe';

// ID 71 de docs/requerimientos/discusiones.md: nombre y apellido de un cliente son opcionales. Donde se
// muestra el nombre de quien hizo un pedido, un cliente sin nombre no puede aparecer como "null null" ni
// en blanco: se muestra su correo.
describe('NombrePersonaPipe', () => {
  const pipe = new NombrePersonaPipe();

  it('une nombre y apellido', () => {
    expect(pipe.transform({ name: 'Ana', lastName: 'Pérez' }, 'ana@example.com')).toBe('Ana Pérez');
  });

  it('con solo el nombre, muestra el nombre', () => {
    expect(pipe.transform({ name: 'Ana', lastName: null }, 'ana@example.com')).toBe('Ana');
  });

  it('con solo el apellido, muestra el apellido', () => {
    expect(pipe.transform({ name: '', lastName: 'Pérez' }, 'ana@example.com')).toBe('Pérez');
  });

  it('sin nombre ni apellido, muestra el respaldo (el correo)', () => {
    expect(pipe.transform({ name: null, lastName: null }, 'ana@example.com')).toBe('ana@example.com');
    expect(pipe.transform({ name: undefined, lastName: undefined }, 'otra@example.com')).toBe('otra@example.com');
  });

  it('un nombre de solo espacios cuenta como vacío', () => {
    expect(pipe.transform({ name: '   ', lastName: ' ' }, 'ana@example.com')).toBe('ana@example.com');
  });

  it('quita los espacios de los bordes', () => {
    expect(pipe.transform({ name: ' Ana ', lastName: ' Pérez ' }, 'x')).toBe('Ana Pérez');
  });

  it('sin persona (todavía no cargó), muestra el respaldo', () => {
    expect(pipe.transform(null, 'ana@example.com')).toBe('ana@example.com');
    expect(pipe.transform(undefined, 'ana@example.com')).toBe('ana@example.com');
  });
});
