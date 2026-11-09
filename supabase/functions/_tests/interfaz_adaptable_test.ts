// ============================================================================
// La interfaz se adapta a pantallas chicas y bajas (ID 64 de docs/requerimientos/discusiones.md)
// ============================================================================
// La revisión del ID 64 encontró errores mecánicos que se repiten cuando se copia una pantalla: un diálogo sin alto
// máximo queda fuera de la ventana en un celular apaisado y sus botones no se alcanzan. Esta prueba revisa TODAS las
// plantillas de `fe/src/app` y falla si vuelve alguno. No reemplaza mirar las pantallas en varios tamaños.
//
// Diagnóstico y criterios: docs/requerimientos/revision-diseno-adaptable-id64-2026-11-09.md
// Se ejecuta con: deno test --allow-read supabase/functions/_tests/interfaz_adaptable_test.ts
// ============================================================================
import assert from 'node:assert/strict';
import { encontrarProblemasDeDiseno } from './diseno_adaptable.ts';

const reglas = (html: string) => encontrarProblemasDeDiseno(html).map((h) => h.regla);

// ─── El detector (lógica pura) ───────────────────────────────────────────────

Deno.test('diálogo: sin alto máximo es un problema; con alto máximo y scroll interno, no', () => {
  assert.deepEqual(reglas('<div cdkTrapFocus class="bg-white rounded-2xl flex flex-col">…</div>'), ['dialogo-sin-alto-maximo']);
  assert.deepEqual(
    reglas('<div cdkTrapFocus class="bg-white max-h-[90vh] flex flex-col"><div class="overflow-y-auto">…</div></div>'),
    [],
  );
});

Deno.test('diálogo: con alto máximo pero sin ningún scroll interno es un problema', () => {
  assert.deepEqual(reglas('<div cdkTrapFocus class="max-h-[85vh] flex flex-col"><p>Texto</p></div>'), ['dialogo-sin-scroll-interno']);
});

Deno.test('diálogo: cualquier forma de topar el alto vale (max-h, alto fijo en vh, pantalla completa)', () => {
  const conScroll = '<div class="overflow-y-auto"></div>';
  assert.deepEqual(reglas(`<div cdkTrapFocus class="h-[95vh]">${conScroll}</div>`), []);
  assert.deepEqual(reglas(`<div cdkTrapFocus class="max-h-screen">${conScroll}</div>`), []);
  assert.deepEqual(reglas(`<div cdkTrapFocus class="max-h-[90dvh]">${conScroll}</div>`), []);
  assert.deepEqual(reglas('<div cdkTrapFocus class="rounded h-80">…</div>'), ['dialogo-sin-alto-maximo']);
});

Deno.test('diálogo: un panel lateral de punta a punta (inset-y-0) no necesita tope, y [cdkTrapFocus] enlazado también cuenta', () => {
  assert.deepEqual(reglas('<div [cdkTrapFocus]="abierto()" class="fixed inset-y-0 left-0 w-64">…</div>'), []);
  assert.deepEqual(reglas('<div [cdkTrapFocus]="abierto()" class="fixed w-64">…</div>'), ['dialogo-sin-alto-maximo']);
});

Deno.test('diálogo: etiquetas en varias líneas o con ">" en un valor se leen bien; sin cdkTrapFocus no hay nada que revisar', () => {
  const enVariasLineas = `<div
    cdkTrapFocus
    cdkTrapFocusAutoCapture
    (clickOutside)="a > b ? cerrar() : nada()"
    class="bg-white flex flex-col"
  >…</div>`;
  assert.deepEqual(reglas(enVariasLineas), ['dialogo-sin-alto-maximo']);
  assert.deepEqual(reglas('<div class="bg-white">sin foco atrapado</div>'), []);
  assert.deepEqual(reglas('<div cdkTrapFocusAutoCapture class="x">solo la captura automática</div>'), []);
});

Deno.test('diálogo: el modal compartido elsi-modal-overlay se exceptúa porque su tope vive en styles.css', () => {
  assert.deepEqual(reglas('<div cdkTrapFocus cdkTrapFocusAutoCapture class="elsi-modal-overlay">…</div>'), []);
});

Deno.test('los comentarios HTML no cuentan, y cada hallazgo dice en qué línea está', () => {
  assert.deepEqual(reglas('<!-- <div cdkTrapFocus class="x"></div> -->'), []);
  const hallazgos = encontrarProblemasDeDiseno('<p>uno</p>\n<p>dos</p>\n<div cdkTrapFocus class="x">…</div>');
  assert.equal(hallazgos[0].linea, 3);
});

// ─── Las plantillas y la hoja de estilos de la aplicación ────────────────────

const RAIZ = new URL('../../../fe/src/app/', import.meta.url);

async function plantillas(dir: URL, acumulado: URL[] = []): Promise<URL[]> {
  for await (const entrada of Deno.readDir(dir)) {
    const ruta = new URL(entrada.name + (entrada.isDirectory ? '/' : ''), dir);
    if (entrada.isDirectory) await plantillas(ruta, acumulado);
    else if (entrada.name.endsWith('.html')) acumulado.push(ruta);
  }
  return acumulado;
}

Deno.test('ninguna plantilla de la interfaz tiene un problema de diseño adaptable mecánico', async () => {
  const archivos = await plantillas(RAIZ);
  assert.ok(archivos.length > 50, `Se esperaban muchas plantillas y se encontraron ${archivos.length}`);

  const problemas: string[] = [];
  for (const archivo of archivos) {
    const html = await Deno.readTextFile(archivo);
    for (const h of encontrarProblemasDeDiseno(html)) {
      problemas.push(`${archivo.href.split('/fe/src/app/')[1]}:${h.linea}  [${h.regla}]  ${h.detalle}`);
    }
  }

  assert.deepEqual(
    problemas,
    [],
    `Problemas de diseño adaptable en las plantillas (criterios en docs/requerimientos/revision-diseno-adaptable-id64-2026-11-09.md):\n${problemas.join('\n')}`,
  );
});

Deno.test('el modal compartido de styles.css (elsi-modal-card) topa su alto y scrollea por dentro', async () => {
  const css = await Deno.readTextFile(new URL('../../../fe/src/styles.css', import.meta.url));
  const regla = css.match(/\.elsi-modal-card\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.match(regla, /max-h-\[\d+d?vh\]/, 'elsi-modal-card necesita un alto máximo en vh');
  assert.match(regla, /overflow-y-auto/, 'elsi-modal-card necesita scroll interno');
});
