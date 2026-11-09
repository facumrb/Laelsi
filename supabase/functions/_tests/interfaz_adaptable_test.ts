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
import { encontrarFuentesChicas, encontrarProblemasDeDiseno } from './diseno_adaptable.ts';

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

Deno.test('fuente: menos de 12 px es un problema; 12 px o más, y las clases estándar, no', () => {
  assert.deepEqual(encontrarFuentesChicas('<p class="text-[10px] font-bold">x</p>').map((h) => h.regla), ['fuente-menor-a-12px']);
  assert.deepEqual(encontrarFuentesChicas('<p class="text-[11px]">x</p>').length, 1);
  assert.deepEqual(encontrarFuentesChicas('<p class="text-[0.7rem]">x</p>').length, 1); // 11,2 px
  assert.deepEqual(encontrarFuentesChicas('<p class="text-[9px] text-[10.5px]">x</p>').length, 2);

  assert.deepEqual(encontrarFuentesChicas('<p class="text-[12px]">x</p>'), []);
  assert.deepEqual(encontrarFuentesChicas('<p class="text-[0.75rem] text-[13px] text-xs text-sm">x</p>'), []);
  assert.deepEqual(encontrarFuentesChicas('<!-- <p class="text-[10px]">x</p> -->'), []);
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

// Ninguna plantilla de la aplicación (panel, acceso, catálogo público y lo compartido) usa fuentes de menos de 12 px
// (ID 64, hallazgo 10; el catálogo público se sumó el mismo día, con el mismo criterio).
Deno.test('ninguna plantilla de la interfaz usa fuentes de menos de 12 px', async () => {
  const problemas: string[] = [];
  for (const archivo of await plantillas(RAIZ)) {
    const ruta = archivo.href.split('/fe/src/app/')[1];
    for (const h of encontrarFuentesChicas(await Deno.readTextFile(archivo))) {
      problemas.push(`${ruta}:${h.linea}  [${h.regla}]  ${h.detalle}`);
    }
  }

  assert.deepEqual(problemas, [], `Fuentes de menos de 12 px (usá text-xs o más):\n${problemas.join('\n')}`);
});

// ID 64 (hallazgos 4 y 5): por debajo de lg las listas del panel se ven como tarjetas. Eran una sola columna de
// 215 a 537 px de alto por tarjeta, igual a 360 que a 768 px de ancho, con los datos en un tercio del ancho. Ahora la
// fila es una grilla de dos columnas: la primera y la última celda (nombre y acciones) ocupan las dos, el resto una
// (o las dos, según la plantilla, cuando el contenido es largo o quedaría solo). Desde lg vuelve a ser una tabla.
const clasesDe = (css: string, selector: string) => {
  const bloque = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  const aplicadas = [...bloque.matchAll(/@apply\s+([^;]+);/g)].map((m) => m[1]).join(' ');
  return new Set(aplicadas.split(/\s+/).filter(Boolean));
};

Deno.test('las tarjetas del panel son una grilla de dos columnas por debajo de lg y una tabla desde lg', async () => {
  const css = await Deno.readTextFile(new URL('../../../fe/src/styles.css', import.meta.url));
  const fila = clasesDe(css, 'admin-table-row');
  const primera = clasesDe(css, 'admin-table-cell-first');
  const celda = clasesDe(css, 'admin-table-cell');
  const ultima = clasesDe(css, 'admin-table-cell-last');

  assert.ok(fila.has('grid') && fila.has('grid-cols-2'), 'la fila de la tarjeta tiene que ser una grilla de dos columnas');
  assert.ok(!fila.has('flex-col'), 'la fila ya no es una columna de flex (nunca aplicaba sm:col-span-2)');
  assert.ok(fila.has('lg:table-row'), 'desde lg la fila vuelve a ser una fila de tabla');

  for (const [nombre, clases] of [['primera', primera], ['última', ultima]] as const) {
    assert.ok(clases.has('col-span-2'), `la celda ${nombre} ocupa las dos columnas`);
    assert.ok(clases.has('lg:col-span-1'), `la celda ${nombre} vuelve a una columna desde lg`);
    assert.ok(!clases.has('sm:col-span-2'), `la celda ${nombre} no usa el sm:col-span-2 viejo`);
  }
  assert.ok(celda.has('col-span-1') && celda.has('min-w-0'), 'la celda común ocupa una columna y puede encogerse (min-w-0)');
});

// ID 64 (hallazgos 7, 11, 12 y 13): formularios en dos columnas desde sm, pie de formulario que envuelve, diálogos largos
// que scrollean enteros en ventanas bajas y encabezado que no parte "Ver Tienda" en dos líneas.
const leer = (ruta: string) => Deno.readTextFile(new URL('../../../fe/src/' + ruta, import.meta.url));

Deno.test('los formularios usan dos columnas desde sm y el pie de formulario envuelve', async () => {
  const css = await leer('styles.css');
  const grilla = clasesDe(css, 'form-grid-2');
  const pie = clasesDe(css, 'form-footer');

  assert.ok(grilla.has('grid-cols-1') && grilla.has('sm:grid-cols-2'), 'form-grid-2: una columna y dos desde sm');
  assert.ok(!grilla.has('md:grid-cols-2'), 'form-grid-2 ya no espera hasta md');
  assert.ok(pie.has('flex-wrap'), 'form-footer envuelve: en 320 px dos botones no entran en una fila');
});

Deno.test('el registro pone sus campos en dos columnas desde sm', async () => {
  const html = await leer('app/pages/auth/pages/register-page/register-page.component.html');

  assert.match(html, /grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-12/);
  assert.ok(!/grid grid-cols-1 lg:grid-cols-2/.test(html), 'el registro ya no espera hasta lg');
});

Deno.test('el detalle del pedido y reordenar categorías scrollean enteros en ventanas bajas (alto máximo 480 px)', async () => {
  for (const ruta of [
    'app/shared/components/modals/order-detail-modal/order-detail-modal.component.html',
    'app/pages/admin/pages/categories-page/categories-toolbar/components/categories-order-modal/categories-order-modal.component.html',
  ]) {
    const html = await leer(ruta);
    assert.ok(html.includes('[@media(max-height:480px)]:overflow-y-auto'), `${ruta}: el panel scrollea entero en ventanas bajas`);
    assert.ok(html.includes('[@media(max-height:480px)]:overflow-visible'), `${ruta}: el cuerpo no scrollea aparte en ventanas bajas`);
  }
});

Deno.test('el encabezado del panel muestra solo el ícono de "Ver Tienda" por debajo de 400 px, con nombre accesible', async () => {
  const html = await leer('app/pages/admin/layout/navbar/navbar.component.html');

  // El nombre accesible contiene el texto visible ("Ver Tienda"): si no, quien dicta "clic en Ver Tienda" no lo alcanza
  assert.match(html, /aria-label="Ver Tienda[^"]*"/);
  assert.match(html, /<span class="hidden min-\[400px\]:inline[^"]*">\s*Ver Tienda\s*<\/span>/);
});

// El contador del carrito era un círculo de 20 px fijos: con texto de 12 px, un número de tres dígitos se salía.
Deno.test('el contador del carrito crece con el número en vez de tener un ancho fijo', async () => {
  const html = await leer('app/pages/client/layout/navbar/navbar-top-bar/navbar-top-bar.component.html');
  const contador = html.match(/<span\s+class="([^"]*)"\s*>\s*\{\{ cartCount\(\) \}\}/)?.[1] ?? '';

  assert.ok(contador.length > 0, 'no se encontró el contador del carrito');
  assert.ok(/(^|\s)min-w-5(\s|$)/.test(contador), 'el contador tiene un ancho mínimo de 20 px (min-w-5)');
  assert.ok(/(^|\s)h-5(\s|$)/.test(contador), 'el contador tiene un alto fijo de 20 px (h-5)');
  assert.ok(!/(^|\s)w-5(\s|$)/.test(contador), 'el contador no tiene un ancho fijo de 20 px (w-5)');
});

Deno.test('el modal compartido de styles.css (elsi-modal-card) topa su alto y scrollea por dentro', async () => {
  const css = await Deno.readTextFile(new URL('../../../fe/src/styles.css', import.meta.url));
  const regla = css.match(/\.elsi-modal-card\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.match(regla, /max-h-\[\d+d?vh\]/, 'elsi-modal-card necesita un alto máximo en vh');
  assert.match(regla, /overflow-y-auto/, 'elsi-modal-card necesita scroll interno');
});
