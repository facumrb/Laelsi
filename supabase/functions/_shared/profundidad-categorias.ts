// ============================================================================
// Niveles de la jerarquía de categorías (lógica pura, sin base de datos)
// ============================================================================
// Una categoría raíz es el nivel 1 (profundidad 0); su hija, el nivel 2 (profundidad 1), y así. Un
// negocio puede crear hasta 5 niveles. Es un TECHO, no la profundidad aconsejada: las guías de usabilidad
// recomiendan que quien compra recorra 3 o 4 niveles como máximo y dejar el resto a los filtros.
//
// El número vive en tres lugares que no pueden compartir código, y una prueba comprueba que concuerden
// (supabase/functions/_tests/profundidad_categorias_unit_test.ts):
//   1. ESTE archivo: la política que aplican las funciones.
//   2. fe/src/app/models/category.model.ts (MAX_CATEGORY_DEPTH): lo que ofrecen los selectores y menús.
//   3. La restricción category_depth_check de la base: un tope de cordura, a propósito MÁS ALTO que esta
//      política (0 a 9), para que subir el límite no obligue a tocar la base en producción.
//
// Por ahora vale para todos los negocios. Si más adelante pasa a ser un ajuste de cada negocio o de su plan
// (docs/hoja-de-ruta-etapas-2026-11-07.md, etapa E1), se cambia solo acá y en el frontend.
// ============================================================================

/** Profundidad del último nivel permitido (la raíz es 0). */
export const PROFUNDIDAD_MAXIMA = 4;

/** Cuántos niveles puede tener una rama, contando la raíz. */
export const NIVELES_MAXIMOS = PROFUNDIDAD_MAXIMA + 1;

/** Una categoría en esa profundidad ya no se puede crear ni mover ahí. */
export function excedeElLimite(profundidad: number): boolean {
  return profundidad > PROFUNDIDAD_MAXIMA;
}

export const MENSAJE_LIMITE_NIVELES = `Se ha excedido el límite máximo de profundidad (${NIVELES_MAXIMOS} niveles)`;

export const MENSAJE_LIMITE_NIVELES_SUBARBOL =
  `La operación resultaría en una profundidad mayor a ${NIVELES_MAXIMOS} niveles para algunas subcategorías`;
