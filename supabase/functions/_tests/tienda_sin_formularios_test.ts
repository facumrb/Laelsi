// ============================================================================
// El layout de la tienda pública no importa @angular/forms
// ============================================================================
// El layout (`fe/src/app/pages/client/layout/`: navbar, buscador, pie, etc.) se descarga en todas las páginas públicas.
// Si un componente de ahí importa `@angular/forms`, todo el módulo de formularios entra en el paquete que carga cada
// visitante, aunque solo se use en un campo. El buscador usa enlaces nativos (`[value]` e `(input)`) justamente para
// evitarlo. Los formularios van en páginas que se cargan bajo demanda (administración, ingreso, pedido), no aquí.
//
// Las pruebas (*.spec.ts) pueden importarlo: no entran en el paquete.
// Se ejecuta con: deno test --allow-read supabase/functions/_tests/tienda_sin_formularios_test.ts
// ============================================================================
import assert from 'node:assert/strict';

/** ¿El código importa `@angular/forms` (con `import`, `import type` no pesa, o `import()`/`require`)? */
export function importaAngularForms(codigo: string): boolean {
  const sinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const importaValores = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+['"]@angular\/forms(?:\/[^'"]*)?['"]/m.test(sinComentarios);
  const importaDirecto = /^\s*import\s+['"]@angular\/forms(?:\/[^'"]*)?['"]/m.test(sinComentarios);
  const dinamico = /(?:import|require)\s*\(\s*['"]@angular\/forms(?:\/[^'"]*)?['"]\s*\)/.test(sinComentarios);
  return importaValores || importaDirecto || dinamico;
}

Deno.test('detector: importar @angular/forms es un problema; un tipo o un comentario, no', () => {
  assert.equal(importaAngularForms(`import { FormsModule } from '@angular/forms';`), true);
  assert.equal(importaAngularForms(`import * as f from "@angular/forms"`), true);
  assert.equal(importaAngularForms(`import {\n  FormsModule,\n  NgModel,\n} from '@angular/forms';`), true);
  assert.equal(importaAngularForms(`const m = await import('@angular/forms');`), true);

  assert.equal(importaAngularForms(`import { Router } from '@angular/router';`), false);
  assert.equal(importaAngularForms(`import type { FormGroup } from '@angular/forms';`), false);
  assert.equal(importaAngularForms(`// import { FormsModule } from '@angular/forms';`), false);
  assert.equal(importaAngularForms(`/* import { FormsModule } from '@angular/forms'; */`), false);
});

const RAIZ = new URL('../../../fe/src/app/pages/client/layout/', import.meta.url);

async function archivosDelLayout(dir: URL, acumulado: URL[] = []): Promise<URL[]> {
  for await (const entrada of Deno.readDir(dir)) {
    const ruta = new URL(entrada.name + (entrada.isDirectory ? '/' : ''), dir);
    if (entrada.isDirectory) await archivosDelLayout(ruta, acumulado);
    else if (entrada.name.endsWith('.ts') && !entrada.name.endsWith('.spec.ts')) acumulado.push(ruta);
  }
  return acumulado;
}

Deno.test('ningún archivo del layout de la tienda importa @angular/forms', async () => {
  const archivos = await archivosDelLayout(RAIZ);
  assert.ok(archivos.length >= 5, `Se esperaban varios archivos y se encontraron ${archivos.length}`);

  const culpables: string[] = [];
  for (const archivo of archivos) {
    if (importaAngularForms(await Deno.readTextFile(archivo))) {
      culpables.push(archivo.href.split('/fe/src/app/')[1]);
    }
  }

  assert.deepEqual(
    culpables,
    [],
    `Estos archivos del layout de la tienda importan @angular/forms y lo suman a todas las páginas públicas. ` +
      `Usá enlaces nativos ([value], (input)) o mové el formulario a una página cargada bajo demanda:\n${culpables.join('\n')}`,
  );
});
