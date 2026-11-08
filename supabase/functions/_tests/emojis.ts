// ============================================================================
// Detector de emojis (lógica pura)
// ============================================================================
// Lo usa interfaz_sin_emojis_test.ts. Va en _tests/ y no en _shared/ porque no es código de las
// funciones: solo sirve para revisar el repositorio (igual que secretos.ts).
// ============================================================================

export interface HallazgoEmoji {
  /** Número de línea, contando desde 1. */
  linea: number;
  emoji: string;
}

/**
 * Emojis y símbolos pictográficos, salvo ©, ® y ™: esos tres son texto corriente de un pie de
 * página o de una marca, aunque Unicode los marque como emoji posibles.
 */
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/gu;

/** Cambia cada carácter por un espacio y conserva los saltos de línea, para no mover el número de línea. */
const enBlanco = (trozo: string): string => trozo.replace(/[^\n]/g, ' ');

/** Saca los comentarios (sin correr las líneas) para que un emoji escrito en uno no cuente. */
function sinComentarios(texto: string, tipo: 'ts' | 'html'): string {
  if (tipo === 'html') return texto.replace(/<!--[\s\S]*?-->/g, enBlanco);
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, enBlanco)
    // `//` solo abre un comentario si no viene después de `:`, para no cortar las direcciones (http://...)
    .replace(/(^|[^:])(\/\/.*$)/gm, (_coincidencia, antes: string, comentario: string) => antes + enBlanco(comentario));
}

/** Los emojis que hay en el código de `texto`, sin contar los de sus comentarios. */
export function encontrarEmojis(texto: string, tipo: 'ts' | 'html'): HallazgoEmoji[] {
  const hallazgos: HallazgoEmoji[] = [];
  sinComentarios(texto, tipo)
    .split('\n')
    .forEach((contenido, indice) => {
      for (const [emoji] of contenido.matchAll(EMOJI)) hallazgos.push({ linea: indice + 1, emoji });
    });
  return hallazgos;
}
