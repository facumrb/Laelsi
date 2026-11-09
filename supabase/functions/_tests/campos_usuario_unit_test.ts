// ============================================================================
// Campos que se piden al dar de alta un usuario (reglas puras)
// ============================================================================
// ID 71 de docs/requerimientos/discusiones.md: el alta de un cliente desde el panel pedía más datos que
// el registro propio y que la base de datos. El mínimo es el que ya acepta la base: nombre de usuario,
// correo y contraseña. Nombre, apellido, teléfono y DNI son opcionales para un cliente.
// Comparativa completa: docs/requerimientos/campos-de-clientes-comparativa-2026-11-09.md
//
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/
// ============================================================================
import assert from 'node:assert/strict';
import {
  CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO,
  camposFaltantes,
  mensajeDeCamposFaltantes,
  textosVaciosANulos,
} from '../_shared/campos-usuario.ts';

const MINIMO = { email: 'ana@example.com', password: 'Clave1234', username: 'ana' };
const COMPLETO = { ...MINIMO, name: 'Ana', lastName: 'Pérez', phone: '3415550000', dni: '30123456' };

Deno.test('perfil mínimo: alcanzan correo, contraseña y nombre de usuario', () => {
  assert.deepEqual(camposFaltantes(MINIMO, 'minimo'), []);
});

Deno.test('perfil mínimo: informa cuáles de los tres faltan', () => {
  assert.deepEqual(camposFaltantes({}, 'minimo'), ['email', 'password', 'username']);
  assert.deepEqual(camposFaltantes({ email: 'a@b.com' }, 'minimo'), ['password', 'username']);
  assert.deepEqual(camposFaltantes({ ...MINIMO, username: undefined }, 'minimo'), ['username']);
});

Deno.test('perfil mínimo: no exige nombre, apellido, teléfono ni DNI', () => {
  const faltantes = camposFaltantes(MINIMO, 'minimo');
  for (const campo of ['name', 'lastName', 'phone', 'dni']) {
    assert.equal(faltantes.includes(campo), false, `no debería pedir ${campo}`);
  }
});

Deno.test('perfil completo (administradores): pide los siete campos', () => {
  assert.deepEqual(camposFaltantes(COMPLETO, 'completo'), []);
  assert.deepEqual(camposFaltantes({}, 'completo').sort(), [
    'dni',
    'email',
    'lastName',
    'name',
    'password',
    'phone',
    'username',
  ]);
});

Deno.test('perfil completo: con solo lo mínimo faltan nombre, apellido, teléfono y DNI', () => {
  assert.deepEqual(camposFaltantes(MINIMO, 'completo').sort(), ['dni', 'lastName', 'name', 'phone']);
});

Deno.test('un valor de solo espacios o vacío cuenta como faltante', () => {
  assert.deepEqual(camposFaltantes({ ...MINIMO, email: '   ' }, 'minimo'), ['email']);
  assert.deepEqual(camposFaltantes({ ...MINIMO, username: '' }, 'minimo'), ['username']);
  assert.deepEqual(camposFaltantes({ ...MINIMO, password: null }, 'minimo'), ['password']);
});

Deno.test('mensajeDeCamposFaltantes: nombra los campos que se piden en cada perfil', () => {
  assert.match(mensajeDeCamposFaltantes('minimo'), /email/i);
  assert.match(mensajeDeCamposFaltantes('minimo'), /usuario/i);
  assert.match(mensajeDeCamposFaltantes('minimo'), /contraseña/i);
  assert.doesNotMatch(mensajeDeCamposFaltantes('minimo'), /DNI/);
  assert.match(mensajeDeCamposFaltantes('completo'), /DNI/);
  assert.match(mensajeDeCamposFaltantes('completo'), /teléfono/i);
});

// Un DNI vacío ('') guardado tal cual chocaría con el de otro cliente: el índice único trata '' como un
// valor (a diferencia de NULL, que se puede repetir). Por eso los textos vacíos pasan a null.
Deno.test('textosVaciosANulos: un texto vacío o de solo espacios pasa a null', () => {
  const resultado = textosVaciosANulos({ dni: '', phone: '   ', name: 'Ana' }, ['dni', 'phone', 'name']);
  assert.deepEqual(resultado, { dni: null, phone: null, name: 'Ana' });
});

Deno.test('textosVaciosANulos: no toca los campos que no se le indican ni los que no son texto', () => {
  const entrada = { dni: '', username: '', streetNumber: 0, city: undefined };
  const resultado = textosVaciosANulos(entrada, ['dni']);
  assert.deepEqual(resultado, { dni: null, username: '', streetNumber: 0, city: undefined });
});

Deno.test('textosVaciosANulos: no modifica el objeto original', () => {
  const entrada = { dni: '' };
  textosVaciosANulos(entrada, ['dni']);
  assert.deepEqual(entrada, { dni: '' });
});

Deno.test('los campos opcionales de un cliente son nombre, apellido, teléfono y DNI', () => {
  assert.deepEqual([...CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO].sort(), ['dni', 'lastName', 'name', 'phone']);
});
