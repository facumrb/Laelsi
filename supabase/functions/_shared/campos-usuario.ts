// ============================================================================
// Campos que se piden al dar de alta un usuario (reglas puras)
// ============================================================================
// ID 71 de docs/requerimientos/discusiones.md: el alta de un cliente desde el panel pedía más datos que
// el registro propio y que la base de datos. El mínimo es el que ya acepta la base ("user"): nombre de
// usuario y correo son NOT NULL, y la contraseña vive en Supabase Auth. Nombre, apellido, teléfono y DNI
// son opcionales para un cliente (la base los guarda como NULL).
// Comparativa completa: docs/requerimientos/campos-de-clientes-comparativa-2026-11-09.md
//
// Este archivo no toca la base ni la red, para poder probarlo solo (ver _tests/campos_usuario_unit_test.ts).
// ============================================================================

/**
 * Qué datos se piden al dar de alta:
 *   minimo    nombre de usuario, correo y contraseña (clientes, tanto en el registro propio como en el panel)
 *   completo  además nombre, apellido, teléfono y DNI (administradores)
 */
export type PerfilRequerido = 'minimo' | 'completo';

const CAMPOS_MINIMOS = ['email', 'password', 'username'] as const;
const CAMPOS_COMPLETOS = ['email', 'password', 'name', 'lastName', 'phone', 'username', 'dni'] as const;

/** Campos de texto de un cliente que pueden quedar vacíos (la base los guarda como NULL). */
export const CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO: readonly string[] = ['name', 'lastName', 'phone', 'dni'];

function estaVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

/** Campos que se piden en ese perfil y no vinieron (o vinieron vacíos o de solo espacios). */
export function camposFaltantes(input: Record<string, unknown>, perfil: PerfilRequerido): string[] {
  const pedidos: readonly string[] = perfil === 'completo' ? CAMPOS_COMPLETOS : CAMPOS_MINIMOS;
  return pedidos.filter((campo) => estaVacio(input[campo]));
}

/** Mensaje para el usuario cuando faltan campos obligatorios. */
export function mensajeDeCamposFaltantes(perfil: PerfilRequerido): string {
  return perfil === 'completo'
    ? 'Todos los campos obligatorios deben ser proporcionados (email, contraseña, nombre, apellido, teléfono, nombre de usuario, DNI)'
    : 'El email, el nombre de usuario y la contraseña son obligatorios';
}

/**
 * Copia de `input` donde los textos vacíos (o de solo espacios) de los campos indicados pasan a null.
 * Un DNI vacío ('') guardado tal cual chocaría con el de otro cliente: el índice único trata '' como un
 * valor, a diferencia de NULL, que se puede repetir. No modifica el objeto original.
 */
export function textosVaciosANulos(
  input: Record<string, unknown>,
  campos: readonly string[],
): Record<string, unknown> {
  const resultado: Record<string, unknown> = { ...input };
  for (const campo of campos) {
    const valor = resultado[campo];
    if (typeof valor === 'string' && valor.trim() === '') resultado[campo] = null;
  }
  return resultado;
}
