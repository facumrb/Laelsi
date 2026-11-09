// ============================================================================
// Estado Activo / Inactivo de clientes y administradores (reglas puras)
// ============================================================================
// Discusión del ID 65 (docs/requerimientos/discusiones.md): por ahora NO se elimina físicamente a
// ningún cliente ni administrador; se los DESACTIVA. Borrar a un cliente borraba en cascada sus
// Pedidos y perdía el historial de ventas.
//
// Un usuario inactivo conserva todos sus datos y su historial, pero no puede operar: sus pedidos al
// servidor se rechazan con 403 (ver requireUser en auth.ts). Se lo puede reactivar en cualquier momento.
//
// Este archivo no toca la base ni la red, para poder probarlo solo (ver _tests/estado_usuario_unit_test.ts).
// ============================================================================

export type EstadoUsuario = 'Activo' | 'Inactivo';

export const ESTADOS_USUARIO: readonly EstadoUsuario[] = ['Activo', 'Inactivo'];

export function esEstadoUsuario(valor: unknown): valor is EstadoUsuario {
  return typeof valor === 'string' && (ESTADOS_USUARIO as readonly string[]).includes(valor);
}

/**
 * Lee el filtro `state` de un listado. Sin valor, no se filtra.
 * Un valor inválido lanza un error en vez de ignorarse: así un filtro mal escrito no muestra
 * "todos" sin que nadie se dé cuenta.
 */
export function leerFiltroDeEstado(valor: string | undefined): EstadoUsuario | undefined {
  if (valor === undefined || valor === '') return undefined;
  if (!esEstadoUsuario(valor)) {
    throw new RangeError('El filtro de estado debe ser Activo o Inactivo');
  }
  return valor;
}

export interface CambioDeEstado {
  /** ID del administrador que pide el cambio */
  solicitanteId: number;
  objetivoId: number;
  objetivoRol: 'Admin' | 'Client';
  objetivoEstadoActual: EstadoUsuario;
  nuevoEstado: EstadoUsuario;
  /** Cantidad de administradores activos AHORA (incluye al objetivo si está activo) */
  administradoresActivos: number;
}

/**
 * Devuelve el motivo por el que el cambio NO se puede hacer, o null si se puede.
 *
 * Dos protecciones para que nadie quede sin acceso al panel:
 *   - un administrador no puede desactivar su propia cuenta;
 *   - no se puede desactivar al último administrador activo.
 * Reactivar siempre se permite, y desactivar a un cliente no tiene restricciones.
 */
export function validarCambioDeEstado(cambio: CambioDeEstado): string | null {
  if (cambio.objetivoRol !== 'Admin' || cambio.nuevoEstado !== 'Inactivo') return null;

  if (cambio.solicitanteId === cambio.objetivoId) {
    return 'No podés desactivar tu propia cuenta de administrador';
  }
  if (cambio.objetivoEstadoActual === 'Activo' && cambio.administradoresActivos <= 1) {
    return 'No se puede desactivar al último administrador activo';
  }
  return null;
}

/** Mensaje que ve quien intenta usar una cuenta inactiva. */
export function mensajeDeCuentaInactiva(rol: 'Admin' | 'Client'): string {
  return rol === 'Admin'
    ? 'Tu cuenta de administrador está inactiva. Consultá con otro administrador.'
    : 'Tu cuenta está inactiva. Escribinos si querés reactivarla.';
}
