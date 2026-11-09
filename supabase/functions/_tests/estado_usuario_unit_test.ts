// ============================================================================
// Estado Activo / Inactivo de clientes y administradores: reglas puras
// ============================================================================
// Discusión del ID 65 (docs/requerimientos/discusiones.md): por ahora NO hay eliminación física de
// clientes ni de administradores, solo desactivación lógica. Desactivar a un administrador tiene
// dos protecciones de seguridad para que nadie quede sin acceso al panel.
//
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/
// ============================================================================
import assert from 'node:assert/strict';
import {
  ESTADOS_USUARIO,
  esEstadoUsuario,
  leerFiltroDeEstado,
  mensajeDeCuentaInactiva,
  validarCambioDeEstado,
  type CambioDeEstado,
} from '../_shared/estado-usuario.ts';

const base: CambioDeEstado = {
  solicitanteId: 1,
  objetivoId: 2,
  objetivoRol: 'Admin',
  objetivoEstadoActual: 'Activo',
  nuevoEstado: 'Inactivo',
  administradoresActivos: 3,
};

// ─── Estados válidos ─────────────────────────────────────────────────────────

Deno.test('los estados de usuario son Activo e Inactivo', () => {
  assert.deepEqual([...ESTADOS_USUARIO], ['Activo', 'Inactivo']);
});

Deno.test('esEstadoUsuario acepta los dos estados y rechaza cualquier otra cosa', () => {
  assert.equal(esEstadoUsuario('Activo'), true);
  assert.equal(esEstadoUsuario('Inactivo'), true);
  assert.equal(esEstadoUsuario('Borrado'), false);
  assert.equal(esEstadoUsuario('activo'), false);
  assert.equal(esEstadoUsuario(undefined), false);
  assert.equal(esEstadoUsuario(null), false);
  assert.equal(esEstadoUsuario(1), false);
});

// ─── Filtro de los listados ──────────────────────────────────────────────────

Deno.test('leerFiltroDeEstado: sin valor no filtra', () => {
  assert.equal(leerFiltroDeEstado(undefined), undefined);
  assert.equal(leerFiltroDeEstado(''), undefined);
});

Deno.test('leerFiltroDeEstado: devuelve el estado pedido', () => {
  assert.equal(leerFiltroDeEstado('Activo'), 'Activo');
  assert.equal(leerFiltroDeEstado('Inactivo'), 'Inactivo');
});

Deno.test('leerFiltroDeEstado: un valor inválido es un error y no se ignora en silencio', () => {
  assert.throws(() => leerFiltroDeEstado('Borrado'), /estado/i);
});

// ─── Desactivar a un administrador ───────────────────────────────────────────

Deno.test('desactivar a otro administrador con más administradores activos se permite', () => {
  assert.equal(validarCambioDeEstado(base), null);
});

Deno.test('un administrador no puede desactivar su propia cuenta', () => {
  const error = validarCambioDeEstado({ ...base, objetivoId: 1 });
  assert.match(error ?? '', /propia cuenta/);
});

Deno.test('no se puede desactivar al último administrador activo', () => {
  const error = validarCambioDeEstado({ ...base, administradoresActivos: 1 });
  assert.match(error ?? '', /último administrador/);
});

Deno.test('con dos administradores activos sí se puede desactivar a uno (compañera de la anterior)', () => {
  assert.equal(validarCambioDeEstado({ ...base, administradoresActivos: 2 }), null);
});

Deno.test('desactivar a un administrador que ya está inactivo no cuenta como último activo', () => {
  assert.equal(
    validarCambioDeEstado({ ...base, objetivoEstadoActual: 'Inactivo', administradoresActivos: 1 }),
    null,
  );
});

Deno.test('reactivar a un administrador siempre se permite', () => {
  assert.equal(
    validarCambioDeEstado({ ...base, objetivoEstadoActual: 'Inactivo', nuevoEstado: 'Activo', administradoresActivos: 1 }),
    null,
  );
});

// ─── Clientes ────────────────────────────────────────────────────────────────

Deno.test('desactivar a un cliente se permite aunque no queden administradores activos que mirar', () => {
  assert.equal(validarCambioDeEstado({ ...base, objetivoRol: 'Client', administradoresActivos: 1 }), null);
});

Deno.test('el cliente no se puede desactivar a sí mismo desde el panel (el solicitante es administrador)', () => {
  // Un administrador y un cliente nunca comparten ID de perfil, pero la regla "propia cuenta" solo
  // protege a los administradores: no debe bloquear a un cliente por una coincidencia de números
  assert.equal(validarCambioDeEstado({ ...base, objetivoRol: 'Client', objetivoId: 1 }), null);
});

// ─── Mensaje ─────────────────────────────────────────────────────────────────

Deno.test('mensajeDeCuentaInactiva habla de la cuenta y distingue a administradores y clientes', () => {
  assert.match(mensajeDeCuentaInactiva('Admin'), /administrador/i);
  assert.match(mensajeDeCuentaInactiva('Client'), /cuenta/i);
  assert.notEqual(mensajeDeCuentaInactiva('Admin'), mensajeDeCuentaInactiva('Client'));
});
