// ============================================================================
// Detector de problemas de diseño adaptable en las plantillas (lógica pura)
// ============================================================================
// Lo usa interfaz_adaptable_test.ts. No reemplaza mirar la pantalla en varios tamaños: solo impide que vuelvan los
// errores mecánicos que la revisión del ID 64 encontró y se corrigieron.
// Diagnóstico y criterios: docs/requerimientos/revision-diseno-adaptable-id64-2026-11-09.md
// ============================================================================

export interface HallazgoDiseno {
  regla: string;
  linea: number;
  detalle: string;
}

const lineaDe = (html: string, indice: number) => html.slice(0, indice).split('\n').length;
const compacto = (texto: string, max = 90) => texto.replace(/\s+/g, ' ').trim().slice(0, max);
const sinComentarios = (html: string) => html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));

// Una etiqueta de apertura, con valores entre comillas que pueden tener ">" adentro
const ETIQUETA = /<[a-z][\w-]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;

// Lo que le pone un tope al alto de un diálogo: un alto máximo o fijo en vh, o ser un panel lateral de punta a punta
const TOPE_DE_ALTO = /(?:^|\s)(?:max-h-\S+|h-\[\d+(?:\.\d+)?d?vh\]|h-screen|h-dvh|inset-y-0)(?=\s|$)/;

export function encontrarProblemasDeDiseno(plantilla: string): HallazgoDiseno[] {
  const html = sinComentarios(plantilla);
  const hallazgos: HallazgoDiseno[] = [];
  const agregar = (regla: string, indice: number, detalle: string) =>
    hallazgos.push({ regla, linea: lineaDe(html, indice), detalle: compacto(detalle) });

  // 1) Un diálogo sin alto máximo ni scroll interno se sale de la pantalla en una ventana baja (un celular apaisado:
  //    360 px de alto) y no hay forma de llegar a sus botones. El panel lleva `cdkTrapFocus`.
  const tieneScrollInterno = /overflow-y-auto|overflow-auto/.test(html);
  for (const m of html.matchAll(ETIQUETA)) {
    const etiqueta = m[0];
    if (!/\bcdkTrapFocus\b/.test(etiqueta)) continue;
    const clases = etiqueta.match(/\bclass="([^"]*)"/)?.[1] ?? '';
    if (/\belsi-modal-overlay\b/.test(clases)) continue; // su tope está en styles.css (lo comprueba otra prueba)
    if (!TOPE_DE_ALTO.test(clases)) {
      agregar('dialogo-sin-alto-maximo', m.index!, etiqueta);
    } else if (!/\binset-y-0\b/.test(clases) && !tieneScrollInterno) {
      agregar('dialogo-sin-scroll-interno', m.index!, etiqueta);
    }
  }

  return hallazgos;
}
