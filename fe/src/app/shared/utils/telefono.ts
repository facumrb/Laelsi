// Reglas del teléfono de contacto de un cliente. Son las mismas que valida el formulario del perfil
// (FormUtils.phonePattern y el largo de 7 a 20): solo números, espacios, guiones y un + inicial.
// Lógica pura, para poder probarla sola.

const PATRON_TELEFONO = /^[+]?[0-9\-\s]*$/;
const LARGO_MINIMO = 7;
const LARGO_MAXIMO = 20;

/** Devuelve el mensaje de error de un teléfono, o null si es válido. */
export function validarTelefono(valor: string): string | null {
  const telefono = valor.trim();
  if (telefono === '') return 'Ingresá un teléfono de contacto';
  if (!PATRON_TELEFONO.test(telefono)) {
    return 'Solo se permiten números, espacios, guiones (-) y el signo más (+).';
  }
  if (telefono.length < LARGO_MINIMO) return `El teléfono debe tener al menos ${LARGO_MINIMO} caracteres`;
  if (telefono.length > LARGO_MAXIMO) return `El teléfono puede tener como máximo ${LARGO_MAXIMO} caracteres`;
  return null;
}

/** Hay un teléfono cargado: no es null, ni vacío, ni de solo espacios. */
export function hayTelefono(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}
