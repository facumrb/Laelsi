/*
Reglas del teléfono de contacto: solo números, espacios, guiones y un + inicial, de 7 a 20 caracteres.
Es la única fuente de esas reglas. Las usan el diálogo que pide el teléfono al comprar (AlertService.askPhone)
y los formularios reactivos (FormUtils.phonePattern y los largos de cada formulario).
Lógica pura, para poder probarla sola.
*/

// Caracteres permitidos: números, espacios, guiones y un + al principio
export const PATRON_TELEFONO = /^[+]?[0-9\-\s]*$/;
export const LARGO_MINIMO_TELEFONO = 7;
export const LARGO_MAXIMO_TELEFONO = 20;
// Mensaje de error cuando el teléfono tiene caracteres no permitidos
export const MENSAJE_FORMATO_TELEFONO =
  'Solo se permiten números, espacios, guiones (-) y el signo más (+).';

// Deja solo números, espacios y guiones, y un + únicamente si es el primer carácter
export function filtrarTelefono(valor: string): string {
  return valor.replace(/[^0-9\-\s]/g, (c, i: number) =>
    c === '+' && i === 0 ? c : '',
  );
}

// Devuelve el mensaje de error de un teléfono, o null si es válido
export function validarTelefono(valor: string): string | null {
  const telefono = valor.trim();
  if (telefono === '') return 'Ingresá un teléfono de contacto';
  if (!PATRON_TELEFONO.test(telefono)) return MENSAJE_FORMATO_TELEFONO;
  if (telefono.length < LARGO_MINIMO_TELEFONO) {
    return `El teléfono debe tener al menos ${LARGO_MINIMO_TELEFONO} caracteres`;
  }
  if (telefono.length > LARGO_MAXIMO_TELEFONO) {
    return `El teléfono puede tener como máximo ${LARGO_MAXIMO_TELEFONO} caracteres`;
  }
  return null;
}

// Hay un teléfono cargado: no es null, ni vacío, ni de solo espacios
export function hayTelefono(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}
