// ============================================================================
// Detector de problemas de accesibilidad en las plantillas (lógica pura)
// ============================================================================
// Lo usa interfaz_accesible_test.ts. No reemplaza una auditoría con teclado y lector de pantalla: solo impide que
// vuelvan los errores mecánicos que ya se corrigieron (imágenes sin texto alternativo, botones de ícono sin nombre,
// elementos clicables que el teclado no alcanza, diálogos sin rol, nombres accesibles que no dicen lo que se ve).
// Auditoría y criterios: docs/requerimientos/accesibilidad-auditoria-2026-11-09.md
// ============================================================================

export type Regla =
  | 'imagen-sin-alt'
  | 'boton-sin-nombre'
  | 'dialogo-sin-rol'
  | 'clic-sin-teclado'
  | 'opcion-sin-lista'
  | 'nombre-sin-texto-visible'
  | 'campo-sin-etiqueta';

export interface Hallazgo {
  regla: Regla;
  linea: number;
  detalle: string;
}

const lineaDe = (html: string, indice: number) => html.slice(0, indice).split('\n').length;
const compacto = (texto: string, max = 80) => texto.replace(/\s+/g, ' ').trim().slice(0, max);

/** Texto que ve una persona dentro de un fragmento de plantilla (sin etiquetas, bloques de control ni ocultos). */
const INTERPOLACION = ''; // marca de un {{ valor }}: es texto, pero no se sabe cuál

function textoVisible(fragmento: string): string {
  return fragmento
    .replace(/\{\{[\s\S]*?\}\}/g, INTERPOLACION)
    .replace(/<span[^>]*\bsr-only\b[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(/<ng-icon[\s\S]*?<\/ng-icon>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/@(if|else|for|empty|switch|case|default)\b[^{]*\{/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quita los comentarios HTML para no analizar código apagado. */
const sinComentarios = (html: string) => html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));

export function encontrarProblemas(plantilla: string): Hallazgo[] {
  const html = sinComentarios(plantilla);
  const hallazgos: Hallazgo[] = [];

  // 1. Imágenes sin texto alternativo
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt\b|\[alt\]|\[attr\.alt\]/.test(m[0])) {
      hallazgos.push({ regla: 'imagen-sin-alt', linea: lineaDe(html, m.index!), detalle: compacto(m[0]) });
    }
  }

  // 2. Botones que solo tienen un ícono y ningún nombre accesible
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    const abre = m[0].slice(0, m[0].indexOf('>') + 1);
    const nombrado = /aria-label|\[attr\.aria-label\]|aria-labelledby|\btitle=|\[title\]|\[attr\.title\]/.test(abre);
    const tieneTexto = textoVisible(m[1]).length > 0 || /sr-only/.test(m[1]);
    if (!nombrado && !tieneTexto) {
      hallazgos.push({ regla: 'boton-sin-nombre', linea: lineaDe(html, m.index!), detalle: compacto(abre) });
    }
  }

  // 3. Una región con foco atrapado es un diálogo: tiene que decirlo
  const trampa = html.search(/cdkTrapFocus\b/);
  if (trampa >= 0 && !/role="(alert)?dialog"/.test(html)) {
    hallazgos.push({
      regla: 'dialogo-sin-rol',
      linea: lineaDe(html, trampa),
      detalle: 'cdkTrapFocus sin role="dialog" ni role="alertdialog" en la plantilla',
    });
  }

  // 4. Elementos que no son botón ni enlace pero reaccionan al clic, sin forma de usarlos con el teclado.
  //    No cuentan los fondos de los modales (inset-0) ni los contenedores que solo frenan la propagación.
  for (const m of html.matchAll(/<(div|span|li|td|tr|p|label|h[1-6]|section|article)\b[^>]*\(click\)[^>]*>/g)) {
    const t = m[0];
    const conTeclado = /appActivable|role=|tabindex|\(keydown|\(keyup|\(keypress/.test(t);
    const esFondoOContenedor = /inset-0|stopPropagation/.test(t);
    if (!conTeclado && !esFondoOContenedor) {
      hallazgos.push({ regla: 'clic-sin-teclado', linea: lineaDe(html, m.index!), detalle: compacto(t) });
    }
  }

  // 5. Opciones de una lista: la lista tiene que manejar el teclado
  const opcion = html.search(/role="option"/);
  if (opcion >= 0 && !/appListbox/.test(html)) {
    hallazgos.push({
      regla: 'opcion-sin-lista',
      linea: lineaDe(html, opcion),
      detalle: 'role="option" en una plantilla sin appListbox (las flechas, Enter y Escape no funcionarían)',
    });
  }

  // 6. El nombre accesible tiene que contener el texto que se ve (WCAG 2.5.3)
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const etiqueta = m[2].match(/\baria-label="([^"]+)"/)?.[1];
    if (!etiqueta) continue;
    const visible = textoVisible(m[3]);
    // Sin texto fijo (solo un ícono o un valor que cambia, como el contador del carrito) no hay nada que comparar
    if (visible.length === 0 || visible.includes(INTERPOLACION)) continue;
    if (!etiqueta.toLowerCase().includes(visible.toLowerCase())) {
      hallazgos.push({
        regla: 'nombre-sin-texto-visible',
        linea: lineaDe(html, m.index!),
        detalle: `aria-label="${etiqueta}" no contiene el texto visible "${compacto(visible, 40)}"`,
      });
    }
  }

  // 7. Campos sin etiqueta (los ocultos no cuentan: el lector de pantalla no los ve)
  for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
    const t = m[0];
    if (/\bhidden\b|type="hidden"/.test(t)) continue;
    if (/type="(checkbox|radio)"/.test(t) && /sr-only|peer/.test(t)) continue;
    const id = t.match(/\bid="([^"]+)"/)?.[1];
    const etiquetado =
      /aria-label|\[attr\.aria-label\]|aria-labelledby|placeholder=/.test(t) ||
      (id !== undefined && new RegExp(`for="${id}"|\\[for\\]="'${id}'"`).test(html));
    if (!etiquetado) {
      hallazgos.push({ regla: 'campo-sin-etiqueta', linea: lineaDe(html, m.index!), detalle: compacto(t) });
    }
  }

  return hallazgos;
}
