// ============================================================================
// Caché de las respuestas públicas del catálogo (reglas puras)
// ============================================================================
// ID 70 de docs/requerimientos/discusiones.md (mejora 3 de docs/requerimientos/rendimiento-investigacion-2026-11-09.md).
// Con `Cache-Control: max-age` el navegador reutiliza la respuesta unos segundos en vez de volver a invocar la
// función: baja las invocaciones (cupo gratuito de Supabase) y el tiempo de carga. Un cambio hecho en el panel puede
// tardar hasta ese tiempo en verse en la tienda.
//
// Solo se cachean GET exitosos de rutas que DECLARAN un tiempo (`cacheSeconds` en el resultado, ver http.ts): lo que
// no se declara no se cachea. Se declara solo en lo público que no cambia con cada acción (portada, más vendidos,
// listados activos, árbol de categorías de un visitante); nunca en el carrito (availability), pedidos, panel ni lo
// que depende de quién pide.
//
// Este archivo no toca la red, para poder probarlo solo (ver _tests/cache_publica_unit_test.ts).
// ============================================================================

/** Cuánto se cachea el catálogo público: lo que tarda, como máximo, en verse un cambio del panel en la tienda. */
export const CACHE_CATALOGO_SEGUNDOS = 60;

/**
 * Cabeceras de caché para una respuesta. Vacías salvo que sea un GET exitoso (200) con un tiempo válido.
 * `Vary` hace que el navegador guarde una versión por origen y por sesión, para no mezclarlas.
 */
export function cabecerasDeCache(
  metodo: string,
  estado: number,
  segundos: number | undefined,
): Record<string, string> {
  if (metodo !== 'GET' || estado !== 200) return {};
  if (segundos === undefined || !Number.isFinite(segundos) || segundos < 1) return {};
  return {
    'Cache-Control': `public, max-age=${Math.floor(segundos)}`,
    Vary: 'Origin, Authorization',
  };
}
