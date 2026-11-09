// ============================================================================
// Caché de las respuestas públicas del catálogo (reglas puras)
// ============================================================================
// ID 70 de docs/requerimientos/discusiones.md (mejora 3 de rendimiento-investigacion-2026-11-09.md). Las respuestas
// públicas del catálogo (portada, más vendidos, listados activos, árbol de categorías) no traían Cache-Control: cada
// recarga volvía a invocar la función. Con `max-age` el navegador reutiliza la respuesta unos segundos, lo que baja
// las invocaciones (cupo gratuito de Supabase) y el tiempo de carga. Solo se cachean GET exitosos de rutas que
// declaran un tiempo; lo que cambia con cada acción del usuario (carrito, pedidos, panel) nunca.
//
// Se ejecuta con: deno test --allow-read --allow-run=git supabase/functions/_tests/
// ============================================================================
import assert from 'node:assert/strict';
import { CACHE_CATALOGO_SEGUNDOS, cabecerasDeCache } from '../_shared/cache-publica.ts';

Deno.test('el catálogo público se cachea 60 segundos', () => {
  assert.equal(CACHE_CATALOGO_SEGUNDOS, 60);
});

Deno.test('un GET exitoso con tiempo declarado lleva Cache-Control público con ese tiempo', () => {
  const cabeceras = cabecerasDeCache('GET', 200, 60);
  assert.equal(cabeceras['Cache-Control'], 'public, max-age=60');
});

Deno.test('la respuesta varía por origen y por sesión, para no mezclar versiones entre quienes piden', () => {
  assert.equal(cabecerasDeCache('GET', 200, 60)['Vary'], 'Origin, Authorization');
});

Deno.test('con otro tiempo declarado, usa ese tiempo', () => {
  assert.equal(cabecerasDeCache('GET', 200, 300)['Cache-Control'], 'public, max-age=300');
});

Deno.test('sin tiempo declarado no se agrega nada: lo que no se declara no se cachea', () => {
  assert.deepEqual(cabecerasDeCache('GET', 200, undefined), {});
  assert.deepEqual(cabecerasDeCache('GET', 200, 0), {});
});

Deno.test('un tiempo inválido no se cachea', () => {
  assert.deepEqual(cabecerasDeCache('GET', 200, -5), {});
  assert.deepEqual(cabecerasDeCache('GET', 200, Number.NaN), {});
  assert.deepEqual(cabecerasDeCache('GET', 200, Number.POSITIVE_INFINITY), {});
});

Deno.test('solo se cachea GET: un POST, PATCH o DELETE nunca', () => {
  for (const metodo of ['POST', 'PATCH', 'DELETE', 'PUT']) {
    assert.deepEqual(cabecerasDeCache(metodo, 200, 60), {}, `no debería cachear ${metodo}`);
  }
});

Deno.test('solo se cachea la respuesta exitosa (200): ni errores ni creaciones', () => {
  for (const estado of [201, 204, 304, 400, 401, 403, 404, 409, 500]) {
    assert.deepEqual(cabecerasDeCache('GET', estado, 60), {}, `no debería cachear un ${estado}`);
  }
});

Deno.test('un tiempo con decimales se redondea hacia abajo', () => {
  assert.equal(cabecerasDeCache('GET', 200, 59.9)['Cache-Control'], 'public, max-age=59');
});
