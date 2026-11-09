// ============================================================================
// La interfaz mantiene sus mínimos de accesibilidad
// ============================================================================
// Un nombre que el lector de pantalla no puede leer, una opción que el teclado no alcanza o un diálogo que no se
// anuncia dejan afuera a quien usa esas herramientas, y vuelven sin que nadie lo note cuando se copia una pantalla.
// Esta prueba revisa TODAS las plantillas de `fe/src/app` y falla si vuelve alguno de los errores mecánicos que ya
// se corrigieron. No reemplaza la pasada manual con teclado y lector de pantalla.
//
// Auditoría y criterios: docs/requerimientos/accesibilidad-auditoria-2026-11-09.md
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/interfaz_accesible_test.ts
// ============================================================================
import assert from 'node:assert/strict';
import { encontrarProblemas } from './accesibilidad.ts';

const reglas = (html: string) => encontrarProblemas(html).map((h) => h.regla);

// ─── El detector (lógica pura) ───────────────────────────────────────────────

Deno.test('imagen: sin alt es un problema; con alt, vacío o enlazado, no', () => {
  assert.deepEqual(reglas('<img src="a.png">'), ['imagen-sin-alt']);
  assert.deepEqual(reglas('<img src="a.png" alt="Logo">'), []);
  assert.deepEqual(reglas('<img src="a.png" alt="">'), []);
  assert.deepEqual(reglas('<img [src]="u" [alt]="nombre">'), []);
});

Deno.test('botón: solo con ícono y sin nombre es un problema; con texto, aria-label, title o sr-only, no', () => {
  assert.deepEqual(reglas('<button type="button"><ng-icon name="x"></ng-icon></button>'), ['boton-sin-nombre']);
  assert.deepEqual(reglas('<button><ng-icon name="x"></ng-icon> Cerrar</button>'), []);
  assert.deepEqual(reglas('<button aria-label="Cerrar"><ng-icon name="x"></ng-icon></button>'), []);
  assert.deepEqual(reglas('<button title="Cerrar"><ng-icon name="x"></ng-icon></button>'), []);
  assert.deepEqual(reglas('<button><ng-icon name="x"></ng-icon><span class="sr-only">Cerrar</span></button>'), []);
  assert.deepEqual(reglas('<button>{{ texto }}</button>'), []);
});

Deno.test('diálogo: cdkTrapFocus sin role="dialog" es un problema; con el rol, no', () => {
  assert.deepEqual(reglas('<div cdkTrapFocus>…</div>'), ['dialogo-sin-rol']);
  assert.deepEqual(reglas('<div role="dialog" aria-modal="true" cdkTrapFocus>…</div>'), []);
  assert.deepEqual(reglas('<div role="alertdialog" cdkTrapFocus>…</div>'), []);
  assert.deepEqual(reglas('<div>sin foco atrapado</div>'), []);
});

Deno.test('clic: un div, span o li con (click) y sin teclado es un problema', () => {
  assert.deepEqual(reglas('<div (click)="abrir()">Ana</div>'), ['clic-sin-teclado']);
  assert.deepEqual(reglas('<li (click)="elegir()">Uno</li>'), ['clic-sin-teclado']);
  assert.deepEqual(reglas('<span class="cursor-pointer" (click)="abrir()">#1</span>'), ['clic-sin-teclado']);
});

Deno.test('clic: con appActivable, con rol y foco, o con teclas, no es un problema', () => {
  assert.deepEqual(reglas('<div appActivable (click)="abrir()">Ana</div>'), []);
  assert.deepEqual(reglas('<div role="button" tabindex="0" (click)="abrir()">Ana</div>'), []);
  assert.deepEqual(reglas('<div tabindex="0" (keydown.enter)="abrir()" (click)="abrir()">Ana</div>'), []);
});

Deno.test('clic: un botón o un enlace nunca es problema, y el fondo de un modal tampoco', () => {
  assert.deepEqual(reglas('<button (click)="abrir()">Abrir</button>'), []);
  assert.deepEqual(reglas('<a (click)="abrir()" href="/x">Abrir</a>'), []);
  assert.deepEqual(reglas('<div class="fixed inset-0 bg-black/50" (click)="cerrar()"></div>'), []);
  assert.deepEqual(reglas('<div class="modal" (click)="$event.stopPropagation()">…</div>'), []);
});

Deno.test('opción: role="option" sin appListbox es un problema; con él, no', () => {
  assert.deepEqual(reglas('<ul><li role="option" tabindex="-1">Uno</li></ul>'), ['opcion-sin-lista']);
  assert.deepEqual(reglas('<ul appListbox><li role="option" tabindex="-1">Uno</li></ul>'), []);
});

Deno.test('nombre: el aria-label tiene que contener el texto visible', () => {
  assert.deepEqual(reglas('<a aria-label="Contactanos por WhatsApp"><span>+54 9 341 712-1860</span></a>'), [
    'nombre-sin-texto-visible',
  ]);
  assert.deepEqual(reglas('<a aria-label="+54 9 341 712-1860, contactanos por WhatsApp">+54 9 341 712-1860</a>'), []);
  assert.deepEqual(reglas('<button aria-label="Mostrar opciones"><span>Filtros</span></button>'), [
    'nombre-sin-texto-visible',
  ]);
  assert.deepEqual(reglas('<button aria-label="Cerrar"><ng-icon name="x"></ng-icon></button>'), []);
  assert.deepEqual(reglas('<button aria-label="Quitar {{ nombre }}">{{ nombre }}</button>'), []);
  // Un contador (el del carrito) es texto que cambia: no hay un texto fijo con qué comparar
  assert.deepEqual(
    reglas('<a aria-label="Ver carrito"><ng-icon name="c"></ng-icon>@if (n() > 0) {<span>{{ n() }}</span>}</a>'),
    [],
  );
});

Deno.test('campo: sin etiqueta es un problema; con label asociada, aria-label o placeholder, no; oculto, tampoco', () => {
  assert.deepEqual(reglas('<input type="text" id="a">'), ['campo-sin-etiqueta']);
  assert.deepEqual(reglas('<label for="a">A</label><input type="text" id="a">'), []);
  assert.deepEqual(reglas('<input type="text" aria-label="Buscar">'), []);
  assert.deepEqual(reglas('<input type="text" placeholder="Buscar">'), []);
  assert.deepEqual(reglas('<input type="text" name="username" hidden readonly>'), []);
});

Deno.test('los comentarios HTML no cuentan', () => {
  assert.deepEqual(reglas('<!-- <img src="a.png"> -->'), []);
});

Deno.test('cada hallazgo dice en qué línea está', () => {
  const hallazgos = encontrarProblemas('<p>uno</p>\n<p>dos</p>\n<img src="a.png">');

  assert.equal(hallazgos[0].linea, 3);
});

// ─── Las plantillas de la aplicación ─────────────────────────────────────────

const RAIZ = new URL('../../../fe/src/app/', import.meta.url);

async function plantillas(dir: URL, acumulado: URL[] = []): Promise<URL[]> {
  for await (const entrada of Deno.readDir(dir)) {
    const ruta = new URL(entrada.name + (entrada.isDirectory ? '/' : ''), dir);
    if (entrada.isDirectory) await plantillas(ruta, acumulado);
    else if (entrada.name.endsWith('.html')) acumulado.push(ruta);
  }
  return acumulado;
}

Deno.test('ninguna plantilla de la interfaz tiene un problema de accesibilidad mecánico', async () => {
  const archivos = await plantillas(RAIZ);
  assert.ok(archivos.length > 50, `Se esperaban muchas plantillas y se encontraron ${archivos.length}`);

  const problemas: string[] = [];
  for (const archivo of archivos) {
    const html = await Deno.readTextFile(archivo);
    for (const h of encontrarProblemas(html)) {
      problemas.push(`${archivo.href.split('/fe/src/app/')[1]}:${h.linea}  [${h.regla}]  ${h.detalle}`);
    }
  }

  assert.deepEqual(
    problemas,
    [],
    `Problemas de accesibilidad en las plantillas (criterios en docs/requerimientos/accesibilidad-auditoria-2026-11-09.md):\n${problemas.join('\n')}`,
  );
});
