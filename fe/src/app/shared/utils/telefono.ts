// Reglas del teléfono de contacto: solo números, espacios, guiones y un + inicial, de 7 a 20 caracteres.
// Las comparten el diálogo del teléfono (AlertService.askPhone) y los formularios del perfil
// (FormUtils.phonePattern y el largo de 7 a 20). Lógica pura, para poder probarla sola.

const PATRON_TELEFONO = /^[+]?[0-9\-\s]*$/;
const LARGO_MINIMO = 7;
export const LARGO_MAXIMO_TELEFONO = 20;

/** Deja solo números, espacios y guiones, y un + únicamente si es el primer carácter. */
export function filtrarTelefono(valor: string): string {
  return valor.replace(/[^0-9\-\s]/g, (c, i: number) => (c === '+' && i === 0 ? c : ''));
}

/** Devuelve el mensaje de error de un teléfono, o null si es válido. */
export function validarTelefono(valor: string): string | null {
  const telefono = valor.trim();
  if (telefono === '') return 'Ingresá un teléfono de contacto';
  if (!PATRON_TELEFONO.test(telefono)) {
    return 'Solo se permiten números, espacios, guiones (-) y el signo más (+).';
  }
  if (telefono.length < LARGO_MINIMO) return `El teléfono debe tener al menos ${LARGO_MINIMO} caracteres`;
  if (telefono.length > LARGO_MAXIMO_TELEFONO) {
    return `El teléfono puede tener como máximo ${LARGO_MAXIMO_TELEFONO} caracteres`;
  }
  return null;
}

/** Hay un teléfono cargado: no es null, ni vacío, ni de solo espacios. */
export function hayTelefono(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}
