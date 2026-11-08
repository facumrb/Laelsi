// ============================================================================
// La interfaz no usa emojis como adorno
// ============================================================================
// Un emoji puesto en un título o un mensaje "para que quede lindo" (🔥 Más vendidos, 💡 Consejo) es
// el rasgo más reconocible del diseño generado sin criterio: no lo controla la marca, se ve distinto
// en cada sistema y los lectores de pantalla lo leen en voz alta ("fuego"). Si una pantalla necesita
// un ícono, va uno del sistema de diseño; si no, alcanza con el texto.
//
// PROVISIONAL-2026-11-08 (emojis): esta regla corrige solo ese problema. El diseño definitivo del sitio
// se decide en las etapas del plan (E2a, docs/hoja-de-ruta-etapas-2026-11-07.md).
//
// Qué se revisa: el código de la interfaz (plantillas y textos de `fe/src`) y los mensajes que el
// backend le muestra a la persona (`supabase/functions`). NO se revisan los comentarios, las pruebas
// ni los documentos. Los símbolos de texto corriente (©, ®, ™, →, ↳) no cuentan como emoji.
//
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/interfaz_sin_emojis_test.ts
// ============================================================================
import assert from 'node:assert/strict';
import { encontrarEmojis } from './emojis.ts';

// ─── El detector (lógica pura) ───────────────────────────────────────────────

Deno.test('detecta un emoji dentro de un texto y dice en qué línea está', () => {
  const codigo = ["const a = 1;", "const mensaje = 'Elegí una opción 💡';"].join('\n');

  assert.deepEqual(
    encontrarEmojis(codigo, 'ts').map((h) => h.linea),
    [2],
  );
});

Deno.test('detecta varios emojis distintos, cada uno con su línea', () => {
  const plantilla = ['<h2>', '  🔥 Más vendidos', '</h2>', '<p>Listo ✅</p>'].join('\n');

  const hallazgos = encontrarEmojis(plantilla, 'html');

  assert.deepEqual(
    hallazgos.map((h) => [h.linea, h.emoji]),
    [
      [2, '🔥'],
      [4, '✅'],
    ],
  );
});

Deno.test('detecta un emoji que lleva selector de variación (⚠️)', () => {
  assert.deepEqual(
    encontrarEmojis('<span>⚠️ Atención</span>', 'html').map((h) => h.linea),
    [1],
  );
});

Deno.test('no cuenta como emoji los símbolos de texto corriente', () => {
  const texto = '© 2026 Laelsi™ · Marca®. Ir al paso 3 → o volver ← ↳ subcategoría. Total: $ 1.500, #1 de 10';

  assert.deepEqual(encontrarEmojis(texto, 'html'), []);
});

Deno.test('ignora los emojis que están en comentarios', () => {
  const codigo = [
    "// 🚨 aviso para quien lea el código",
    "/* bloque con 💡",
    "   y otra línea con 🔥 */",
    "const url = 'http://ejemplo.com'; // nota 🔥",
  ].join('\n');

  assert.deepEqual(encontrarEmojis(codigo, 'ts'), []);
  assert.deepEqual(encontrarEmojis('<!-- 🔥 comentario -->\n<p>texto</p>', 'html'), []);
});

Deno.test('un comentario no tapa el emoji que está en el código de la misma línea', () => {
  const codigo = "const titulo = '🔥 Ofertas'; // un comentario";

  assert.deepEqual(
    encontrarEmojis(codigo, 'ts').map((h) => h.linea),
    [1],
  );
});

Deno.test('mantiene el número de línea aunque haya comentarios de varias líneas antes', () => {
  const codigo = ['/*', ' * uno', ' * dos', ' */', "const x = '💡';"].join('\n');

  assert.deepEqual(
    encontrarEmojis(codigo, 'ts').map((h) => h.linea),
    [5],
  );
});

// ─── El repositorio ──────────────────────────────────────────────────────────

/** Raíz del repositorio: supabase/functions/_tests/ -> ../../../ */
const RAIZ = new URL('../../../', import.meta.url);

/** Rutas versionadas y por versionar (las que .gitignore no excluye), relativas a la raíz. */
async function rutasDelRepositorio(): Promise<string[]> {
  const salida = await new Deno.Command('git', {
    args: ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    cwd: RAIZ,
    stdout: 'piped',
    stderr: 'piped',
  }).output();
  if (!salida.success) {
    throw new Error(`git ls-files falló: ${new TextDecoder().decode(salida.stderr)}`);
  }
  return new TextDecoder().decode(salida.stdout).split('\0').filter(Boolean);
}

/** Lo que muestra la interfaz: plantillas y textos del frontend, y mensajes del backend. Sin pruebas. */
function esCodigoDeInterfaz(ruta: string): boolean {
  if (ruta.endsWith('.spec.ts') || ruta.endsWith('.d.ts')) return false;
  if (ruta.startsWith('fe/src/')) return ruta.endsWith('.html') || ruta.endsWith('.ts');
  if (ruta.startsWith('supabase/functions/')) return ruta.endsWith('.ts') && !ruta.includes('/_tests/');
  return false;
}

Deno.test('el recorrido revisa los archivos de la interfaz conocidos (compañera de la siguiente)', async () => {
  const revisados = (await rutasDelRepositorio()).filter(esCodigoDeInterfaz);

  assert.equal(revisados.length > 50, true, `se esperaban más de 50 archivos y hay ${revisados.length}`);
  for (const conocido of [
    'fe/src/app/pages/client/pages/main-page/main-page.component.html',
    'supabase/functions/products/index.ts',
  ]) {
    assert.equal(revisados.includes(conocido), true, `el recorrido tendría que incluir ${conocido}`);
  }
});

Deno.test('ningún archivo de la interfaz usa emojis como adorno', async () => {
  const hallazgos: string[] = [];
  for (const ruta of (await rutasDelRepositorio()).filter(esCodigoDeInterfaz)) {
    let contenido: string;
    try {
      contenido = await Deno.readTextFile(new URL(ruta, RAIZ));
    } catch (error) {
      // Un archivo que git lista pero ya no está en disco (borrado sin `git rm`): no hay qué revisar
      if (error instanceof Deno.errors.NotFound) continue;
      throw error;
    }
    for (const { linea, emoji } of encontrarEmojis(contenido, ruta.endsWith('.html') ? 'html' : 'ts')) {
      hallazgos.push(`${ruta}:${linea} (${emoji})`);
    }
  }

  assert.deepEqual(
    hallazgos,
    [],
    'Hay emojis como adorno en la interfaz: usar solo texto (o un ícono del sistema de diseño)',
  );
});
