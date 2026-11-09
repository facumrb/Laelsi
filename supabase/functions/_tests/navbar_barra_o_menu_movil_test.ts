// ============================================================================
// La barra de categorías y el menú móvil se reparten la pantalla con la MISMA regla
// ============================================================================
// La barra de categorías (`navbar-category-bar`) abre sus menús al pasar el mouse o al enfocar con el
// teclado. En un dispositivo táctil eso no existe: tocar una categoría la abre como enlace y el
// desplegable queda inalcanzable. Por eso la barra solo se muestra donde hay hover y puntero fino, y
// en cualquier otro lado (teléfonos, tablets, teléfonos en horizontal) se usa el menú móvil con acordeón.
//
// La regla vive en una sola variante de Tailwind, `barra-hover` (fe/src/styles.css). Si una de las tres
// plantillas volviera a usar `md:` para decidir entre barra y menú móvil, podría pasar que no se vea
// ninguna de las dos (pantalla entre dos cortes distintos) o que se vean las dos a la vez.
//
// Las plantillas que participan:
//   - la barra:            `hidden barra-hover:flex`
//   - el botón hamburguesa: `barra-hover:hidden`
//   - el menú móvil:        `barra-hover:hidden` (el fondo oscuro y el panel)
//
// Se ejecuta con: deno test --allow-read supabase/functions/_tests/navbar_barra_o_menu_movil_test.ts
// ============================================================================
import assert from 'node:assert/strict';

const RAIZ = new URL('../../../fe/src/', import.meta.url);

function leer(ruta: string): string {
  return Deno.readTextFileSync(new URL(ruta, RAIZ));
}

const BARRA = 'app/pages/client/layout/navbar/navbar-category-bar/navbar-category-bar.component.html';
const SUPERIOR = 'app/pages/client/layout/navbar/navbar-top-bar/navbar-top-bar.component.html';
const MOVIL = 'app/pages/client/layout/navbar/navbar-mobile-sidebar/navbar-mobile-sidebar.component.html';

Deno.test('la barra de categorías se muestra solo con la variante barra-hover', () => {
  const html = leer(BARRA);

  assert.match(html, /<nav[^>]*class="[^"]*\bhidden\b[^"]*\bbarra-hover:flex\b/);
  assert.doesNotMatch(html, /\bmd:flex\b/);
});

Deno.test('el botón hamburguesa se oculta exactamente cuando aparece la barra', () => {
  const html = leer(SUPERIOR);

  assert.match(html, /aria-label="Abrir menú de navegación"/);
  assert.match(html, /<button[^>]*class="barra-hover:hidden\b/);
  assert.doesNotMatch(html, /\bmd:hidden\b/);
});

Deno.test('el menú móvil (fondo y panel) se oculta exactamente cuando aparece la barra', () => {
  const html = leer(MOVIL);

  const conVariante = html.match(/\bbarra-hover:hidden\b/g) ?? [];
  assert.equal(conVariante.length, 2, 'el fondo oscuro y el panel tienen que ocultarse con barra-hover:hidden');
  assert.doesNotMatch(html, /\bmd:hidden\b/);
});

Deno.test('la variante barra-hover existe y exige hover, puntero fino y pantalla ancha', () => {
  const css = leer('styles.css');

  const definicion = css.match(/@custom-variant\s+barra-hover\s*\(([^;]*)\);/);
  assert.ok(definicion, 'falta `@custom-variant barra-hover (...)` en styles.css');
  assert.match(definicion[1], /min-width:\s*68\.75rem/);
  assert.match(definicion[1], /hover:\s*hover/);
  assert.match(definicion[1], /pointer:\s*fine/);
});

// Flecha abajo abre el menú y enfoca su primer ítem en el mismo instante. Un elemento con `visibility: hidden` no se
// puede enfocar, y con `transition-all` el desplegable conserva `hidden` durante el primer instante de la transición,
// así que el foco no llegaba a pasar (se vio en el navegador: el menú abría y el foco se quedaba en la categoría). Al
// abrir, `visibility` tiene que quedar fuera de la transición; el cierre conserva su fundido.
Deno.test('al abrirse, el desplegable se hace visible en el acto (no se enfoca un ítem oculto)', () => {
  const css = leer('styles.css');

  const regla = css.match(/\.navbar-dropdown-abierto\s*\{([^}]*)\}/);
  assert.ok(regla, 'falta la regla .navbar-dropdown-abierto en styles.css');
  assert.match(regla[1], /transition-property:\s*opacity,\s*translate\s*;/);
});
