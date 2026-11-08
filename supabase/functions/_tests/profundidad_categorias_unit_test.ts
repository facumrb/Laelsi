// ============================================================================
// Pruebas de los niveles de la jerarquía de categorías
// ============================================================================
// Los negocios necesitan más de tres niveles de subcategorías (por ejemplo, Tecnología > Computación >
// Periféricos > Mouses > Inalámbricos). El límite pasa de 3 a 5 niveles: las guías de usabilidad
// recomiendan que quien compra recorra 3 o 4 niveles como máximo y dejar el resto a los filtros, así que
// 5 es un techo con margen, no la profundidad aconsejada.
//
// El número vive en tres lugares que no pueden compartir código (la base, esta función y el frontend):
// la última parte de este archivo comprueba que concuerden.
//
// Se ejecuta con: deno test --allow-read supabase/functions/_tests/profundidad_categorias_unit_test.ts
// ============================================================================
import assert from 'node:assert/strict';
import {
  excedeElLimite,
  MENSAJE_LIMITE_NIVELES,
  MENSAJE_LIMITE_NIVELES_SUBARBOL,
  NIVELES_MAXIMOS,
  PROFUNDIDAD_MAXIMA,
} from '../_shared/profundidad-categorias.ts';
import { armarNodoDeArbol, type NodoCategoria } from '../_shared/subarbol-categorias.ts';

// ─── El límite ───────────────────────────────────────────────────────────────

Deno.test('el quinto nivel (profundidad 4) es el último permitido', () => {
  assert.equal(excedeElLimite(4), false);
  assert.equal(excedeElLimite(5), true);
});

Deno.test('los niveles que antes eran el tope ya no lo son', () => {
  assert.equal(excedeElLimite(2), false);
  assert.equal(excedeElLimite(3), false);
});

Deno.test('una raíz nunca excede el límite', () => {
  assert.equal(excedeElLimite(0), false);
});

Deno.test('el máximo de niveles es la profundidad máxima más uno (la raíz es el nivel 1)', () => {
  assert.equal(PROFUNDIDAD_MAXIMA, 4);
  assert.equal(NIVELES_MAXIMOS, 5);
});

Deno.test('los mensajes de error dicen cuántos niveles se permiten, sin el 3 de antes', () => {
  for (const mensaje of [MENSAJE_LIMITE_NIVELES, MENSAJE_LIMITE_NIVELES_SUBARBOL]) {
    assert.match(mensaje, /5 niveles/);
    assert.doesNotMatch(mensaje, /3 niveles/);
  }
});

// ─── El árbol que se arma para la tienda y el panel ──────────────────────────

interface Nodo extends NodoCategoria {
  name: string;
}

/** Una cadena de cinco niveles: 1 > 2 > 3 > 4 > 5. */
const CADENA: readonly Nodo[] = [
  { id: 1, parentId: null, state: 'Activo', name: 'Tecnología' },
  { id: 2, parentId: 1, state: 'Activo', name: 'Computación' },
  { id: 3, parentId: 2, state: 'Activo', name: 'Periféricos' },
  { id: 4, parentId: 3, state: 'Activo', name: 'Mouses' },
  { id: 5, parentId: 4, state: 'Activo', name: 'Inalámbricos' },
];

function hijasPorMadre(categorias: readonly Nodo[]): Map<number | null, Nodo[]> {
  const grupos = new Map<number | null, Nodo[]>();
  for (const c of categorias) grupos.set(c.parentId, [...(grupos.get(c.parentId) ?? []), c]);
  return grupos;
}

/** Los nombres de la cadena, bajando siempre por la primera hija. */
function nombresHaciaAbajo(nodo: { name: string; children: { name: string; children: unknown[] }[] }): string[] {
  const nombres = [nodo.name];
  let actual = nodo.children[0] as typeof nodo | undefined;
  while (actual) {
    nombres.push(actual.name);
    actual = actual.children[0] as typeof nodo | undefined;
  }
  return nombres;
}

Deno.test('con el límite del sistema, el árbol llega hasta el quinto nivel', () => {
  const raiz = armarNodoDeArbol(CADENA[0], hijasPorMadre(CADENA), PROFUNDIDAD_MAXIMA, false);

  assert.deepEqual(nombresHaciaAbajo(raiz), ['Tecnología', 'Computación', 'Periféricos', 'Mouses', 'Inalámbricos']);
});

Deno.test('un límite más corto corta el árbol en ese nivel (el de antes llegaba solo hasta el tercero)', () => {
  const raiz = armarNodoDeArbol(CADENA[0], hijasPorMadre(CADENA), 2, false);

  assert.deepEqual(nombresHaciaAbajo(raiz), ['Tecnología', 'Computación', 'Periféricos']);
});

Deno.test('soloActivas deja afuera la rama que cuelga de una categoría inactiva, en cualquier nivel', () => {
  const conInactiva: readonly Nodo[] = CADENA.map((c) => (c.id === 3 ? { ...c, state: 'Inactivo' as const } : c));

  const soloActivas = armarNodoDeArbol(conInactiva[0], hijasPorMadre(conInactiva), PROFUNDIDAD_MAXIMA, true);
  const todas = armarNodoDeArbol(conInactiva[0], hijasPorMadre(conInactiva), PROFUNDIDAD_MAXIMA, false);

  assert.deepEqual(nombresHaciaAbajo(soloActivas), ['Tecnología', 'Computación']);
  assert.deepEqual(nombresHaciaAbajo(todas), ['Tecnología', 'Computación', 'Periféricos', 'Mouses', 'Inalámbricos']);
});

Deno.test('el nodo conserva los datos de la categoría y suma sus hijas', () => {
  const raiz = armarNodoDeArbol(CADENA[0], hijasPorMadre(CADENA), PROFUNDIDAD_MAXIMA, false);

  assert.equal(raiz.id, 1);
  assert.equal(raiz.name, 'Tecnología');
  assert.equal(raiz.children.length, 1);
  assert.equal(raiz.children[0].id, 2);
});

// ─── Los tres lugares donde vive el número ───────────────────────────────────

/** Raíz del repositorio: supabase/functions/_tests/ -> ../../../ */
const RAIZ = new URL('../../../', import.meta.url);

Deno.test('el frontend usa el mismo máximo de profundidad que esta función', async () => {
  const modelo = await Deno.readTextFile(new URL('fe/src/app/models/category.model.ts', RAIZ));
  const coincidencia = modelo.match(/export const MAX_CATEGORY_DEPTH\s*=\s*(\d+)/);

  assert.notEqual(coincidencia, null, 'fe/src/app/models/category.model.ts tiene que exportar MAX_CATEGORY_DEPTH');
  assert.equal(Number(coincidencia?.[1]), PROFUNDIDAD_MAXIMA);
});

Deno.test('la restricción de la base de datos admite, como mínimo, la profundidad máxima', async () => {
  // La restricción es un tope de cordura, no la política: tiene que ser igual o mayor al límite de la
  // aplicación. Si algún día se sube el límite por encima de ese tope, esta prueba avisa antes de que falle
  // un INSERT en producción. Se toma la última migración que la define.
  const carpeta = new URL('supabase/migrations/', RAIZ);
  const migraciones: string[] = [];
  for await (const entrada of Deno.readDir(carpeta)) {
    if (entrada.isFile && entrada.name.endsWith('.sql')) migraciones.push(entrada.name);
  }

  let tope: number | undefined;
  for (const nombre of migraciones.sort()) {
    const sql = await Deno.readTextFile(new URL(nombre, carpeta));
    const definicion = sql.match(/ADD CONSTRAINT category_depth_check\s+CHECK\s*\(\s*depth\s+BETWEEN\s+0\s+AND\s+(\d+)\s*\)/i);
    if (definicion) tope = Number(definicion[1]);
  }

  assert.notEqual(tope, undefined, 'tiene que haber una migración que redefina category_depth_check');
  assert.equal((tope as number) >= PROFUNDIDAD_MAXIMA, true, `la base admite hasta ${tope} y el límite es ${PROFUNDIDAD_MAXIMA}`);
});
