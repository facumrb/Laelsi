// ============================================================================
// El código de la aplicación no vuelve a cargar supabase-js completo
// ============================================================================
// El navegador solo usa Supabase para la autenticación, y `fe/src/app/services/supabase.client.ts` carga únicamente el
// cliente de auth (@supabase/auth-js). Importar `@supabase/supabase-js` desde cualquier archivo de la aplicación vuelve
// a meter en el paquete inicial ~225 kB (50 kB transferidos) de realtime, postgrest y storage que nadie usa, y nada lo
// avisa: la aplicación sigue andando igual, solo carga más lenta (ID 70 de docs/requerimientos/discusiones.md).
//
// Las pruebas (*.spec.ts) pueden importarlo: no entran en el paquete.
// Se ejecuta con: deno test --allow-read supabase/functions/_tests/bundle_liviano_test.ts
// ============================================================================
import assert from 'node:assert/strict';

/** ¿El código importa el paquete completo (con `import`, `import type` solo no pesa, o `require`)? */
export function importaSupabaseJsCompleto(codigo: string): boolean {
  const sinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // `import type` se borra al compilar: no pesa
  const importaValores = /^\s*import\s+(?!type\b)[^;]*?from\s+['"]@supabase\/supabase-js['"]/m.test(sinComentarios);
  const importaDirecto = /^\s*import\s+['"]@supabase\/supabase-js['"]/m.test(sinComentarios);
  const dinamico = /(?:import|require)\s*\(\s*['"]@supabase\/supabase-js['"]\s*\)/.test(sinComentarios);
  return importaValores || importaDirecto || dinamico;
}

Deno.test('detector: importar el valor de supabase-js es un problema; el cliente de auth, un tipo o un comentario, no', () => {
  assert.equal(importaSupabaseJsCompleto(`import { createClient } from '@supabase/supabase-js';`), true);
  assert.equal(importaSupabaseJsCompleto(`import * as sb from "@supabase/supabase-js"`), true);
  assert.equal(importaSupabaseJsCompleto(`import '@supabase/supabase-js';`), true);
  assert.equal(importaSupabaseJsCompleto(`const m = await import('@supabase/supabase-js');`), true);

  assert.equal(importaSupabaseJsCompleto(`import { GoTrueClient } from '@supabase/auth-js';`), false);
  assert.equal(importaSupabaseJsCompleto(`import type { Session } from '@supabase/supabase-js';`), false);
  assert.equal(importaSupabaseJsCompleto(`// import { createClient } from '@supabase/supabase-js';`), false);
  assert.equal(importaSupabaseJsCompleto(`/* import { createClient } from '@supabase/supabase-js'; */`), false);
});

const RAIZ = new URL('../../../fe/src/app/', import.meta.url);

async function archivosDeLaAplicacion(dir: URL, acumulado: URL[] = []): Promise<URL[]> {
  for await (const entrada of Deno.readDir(dir)) {
    const ruta = new URL(entrada.name + (entrada.isDirectory ? '/' : ''), dir);
    if (entrada.isDirectory) await archivosDeLaAplicacion(ruta, acumulado);
    else if (entrada.name.endsWith('.ts') && !entrada.name.endsWith('.spec.ts')) acumulado.push(ruta);
  }
  return acumulado;
}

Deno.test('ningún archivo de la aplicación importa supabase-js completo (solo el cliente de auth)', async () => {
  const archivos = await archivosDeLaAplicacion(RAIZ);
  assert.ok(archivos.length > 100, `Se esperaban muchos archivos y se encontraron ${archivos.length}`);

  const culpables: string[] = [];
  for (const archivo of archivos) {
    if (importaSupabaseJsCompleto(await Deno.readTextFile(archivo))) {
      culpables.push(archivo.href.split('/fe/src/app/')[1]);
    }
  }

  assert.deepEqual(
    culpables,
    [],
    `Estos archivos importan @supabase/supabase-js y suman ~225 kB al paquete inicial. Usá el cliente de auth de ` +
      `fe/src/app/services/supabase.client.ts:\n${culpables.join('\n')}`,
  );
});
