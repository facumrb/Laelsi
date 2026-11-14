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
import {
  CACHE_CATALOGO_SEGUNDOS,
  cabecerasDeCache,
  segundosDeCacheDelDetalle,
} from '../_shared/cache-publica.ts';

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

function base64url(texto: string): string {
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwtConPayload(payload: unknown): string {
  const cabecera = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  return `${cabecera}.${base64url(JSON.stringify(payload))}.firma`;
}

function pedidoCon(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set('Authorization', authorization);
  return new Request('http://localhost/products/1', { headers });
}

Deno.test('el detalle de un visitante sin cabecera Authorization se cachea', () => {
  assert.equal(segundosDeCacheDelDetalle(pedidoCon()), CACHE_CATALOGO_SEGUNDOS);
});

Deno.test('el detalle pedido con un token de cliente se cachea', () => {
  const token = jwtConPayload({ app_metadata: { role: 'Client' } });
  assert.equal(segundosDeCacheDelDetalle(pedidoCon(`Bearer ${token}`)), CACHE_CATALOGO_SEGUNDOS);
});

Deno.test('el detalle pedido con un token sin rol se cachea', () => {
  const token = jwtConPayload({ sub: 'abc' });
  assert.equal(segundosDeCacheDelDetalle(pedidoCon(`Bearer ${token}`)), CACHE_CATALOGO_SEGUNDOS);
});

Deno.test('el detalle pedido por un administrador no se cachea', () => {
  const token = jwtConPayload({ app_metadata: { role: 'Admin' } });
  assert.equal(segundosDeCacheDelDetalle(pedidoCon(`Bearer ${token}`)), undefined);
});

Deno.test('un token malformado se cachea sin lanzar', () => {
  const adminValido = jwtConPayload({ app_metadata: { role: 'Admin' } });
  const casos = [
    'Bearer',
    'Bearer ',
    'Bearer no-es-un-jwt',
    'Bearer a.b',
    'Bearer a.b.c.d',
    'Bearer cabecera.%%%.firma',
    `Bearer cabecera.${base64url('esto no es json')}.firma`,
    `Bearer cabecera.${base64url('null')}.firma`,
    `Basic ${adminValido}`,
    adminValido,
  ];
  for (const caso of casos) {
    assert.equal(
      segundosDeCacheDelDetalle(pedidoCon(caso)),
      CACHE_CATALOGO_SEGUNDOS,
      `debería cachear con: ${caso}`,
    );
  }
});

function base64urlUtf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwtAdminConResto(resto: number, userMetadata?: unknown): { token: string; largo: number } {
  for (let relleno = 0; relleno < 12; relleno++) {
    const payload = {
      sub: 'a'.repeat(relleno + 1),
      app_metadata: { role: 'Admin' },
      ...(userMetadata === undefined ? {} : { user_metadata: userMetadata }),
    };
    const json = JSON.stringify(payload);
    if (new TextEncoder().encode(json).length % 3 !== resto) continue;
    const codificado = base64urlUtf8(json);
    const cabecera = base64urlUtf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    return { token: `${cabecera}.${codificado}.firma`, largo: codificado.length };
  }
  throw new Error('no se pudo armar el payload');
}

Deno.test('un administrador con payload sin relleno de largo 4n+2 no se cachea', () => {
  const { token, largo } = jwtAdminConResto(1);
  assert.equal(largo % 4, 2);
  assert.equal(segundosDeCacheDelDetalle(pedidoCon(`Bearer ${token}`)), undefined);
});

Deno.test('un administrador con payload sin relleno de largo 4n+3 no se cachea', () => {
  const { token, largo } = jwtAdminConResto(2);
  assert.equal(largo % 4, 3);
  assert.equal(segundosDeCacheDelDetalle(pedidoCon(`Bearer ${token}`)), undefined);
});

Deno.test('un administrador con nombre no ASCII (UTF-8 real) no se cachea en ningún largo de payload', () => {
  for (const resto of [0, 1, 2]) {
    const { token, largo } = jwtAdminConResto(resto, { name: 'Ñandú 漢字', nota: '?????????>>>>>>>>>' });
    assert.equal(largo % 4 === 0, resto === 0);
    assert.match(token.split('.')[1], /[-_]/);
    assert.equal(segundosDeCacheDelDetalle(pedidoCon(`Bearer ${token}`)), undefined, `resto ${resto}`);
  }
});
