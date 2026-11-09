# Rendimiento de la tienda: investigación (2026-11-09)

Responde al ID 70 de [discusiones.md](./discusiones.md): Lighthouse da alrededor de 60 % de rendimiento en cada página, y Facundo la considera **la tarea de mayor importancia**. Pidió empezar por mejoras rápidas para `fe/` (Angular, el sistema actual) y dejar criterios para el sistema nuevo (Next.js, [ADR 0002](../adr/0002-frontend-next-js.md)), sin sobrecargar los planes gratuitos de Supabase.

## Lo más importante, primero

1. **Ya hay una medición propia de Lighthouse** (sección "Línea de base", más abajo): el 60 % está en la categoría y la ficha, y la causa principal es el salto de diseño, no el peso. Lo que sigue de este párrafo es el contexto de cuando todavía no la tenía: **No tengo todavía una medición propia de Lighthouse, y sin ella no se puede afirmar cuál es la causa del 60 %.** La API pública de PageSpeed Insights respondió 429 (cuota anónima agotada: pide una clave de Google, gratuita) y medir con Lighthouse en local exige compilar y servir la aplicación. Lo que sí medí es lo que descarga y consulta el sitio publicado (ver abajo). **El primer paso del plan es medir.**
2. **El peso del JavaScript no parece ser el problema.** La carga inicial (JS y CSS) pesa unos **251 kB comprimidos** en 12 archivos.
3. **Lo más caro de la portada es el patrón de llamadas a la API: 8 invocaciones por carga, en dos tandas.** Eso afecta la sensación de velocidad y, sobre todo, **el cupo gratuito de Supabase** (500.000 invocaciones por mes, ver [limites-planes-gratuitos-2026-11-07.md](./limites-planes-gratuitos-2026-11-07.md)): a 8 por visita, el cupo alcanza para unas 62.000 visitas a la portada al mes, sin contar el resto de las pantallas.
4. **Una sola llamada para la portada** es la mejora con más valor y es compatible con el cupo gratuito: baja de 8 invocaciones a 1 y quita la espera en dos tandas.

## Qué se midió (sitio publicado, solo lectura) y qué se leyó en el código

| Dato | Valor | Cómo se supo |
| --- | --- | --- |
| Carga inicial, JS y CSS comprimidos (brotli) | **~251 kB**: `main` 5 kB, 3 archivos grandes de 113, 60 y 35 kB, 8 chicos, y 19,6 kB de CSS | Medido: descarga de cada archivo que referencia el HTML |
| Caché de los archivos con nombre único (`main-XXXX.js`, `chunk-XXXX.js`, `styles-XXXX.css`) | `public, max-age=0, must-revalidate` | Medido (cabecera). En cada visita repetida el navegador revalida los 12 archivos |
| Llamadas a la API al abrir la portada | **8**: árbol de categorías de la barra superior, más vendidos, categorías activas y, **recién cuando llegan las categorías**, los más vendidos de cada una de las 5 primeras | Leído: `navbar.component.ts`, `main-page.component.ts` |
| Respuesta de la API: caché | **Sin `Cache-Control`** en las respuestas públicas del catálogo | Medido (cabeceras) |
| Respuesta de la API: tiempos | Primera llamada **1,2 s** (arranque en frío, una muestra); siguientes **0,16 a 0,19 s** | Medido desde esta máquina, pocas muestras: es orientativo |
| Compresión de la API | gzip activo | Medido |
| Imágenes de producto en R2 | WebP de **4 a 9 kB** hoy; `Cache-Control: public, max-age=31536000, immutable` | Medido en 6 imágenes de la portada. **Son chicas porque el catálogo cargado es de prueba**: con fotos reales (hasta 1.200 px de ancho, ver `image-compressor.service.ts`) pesarán 10 veces más |
| Caché de las imágenes en Cloudflare | `cf-cache-status: HIT` (ya se cachean en el borde; más de 10 días de antigüedad) | Medido con `GET`. **Corrección del 2026-11-09:** la primera versión de este documento decía `DYNAMIC` por haber medido con un pedido `HEAD` (`curl -I`), que no representa lo que hace un navegador |
| Fuentes web | Ninguna (tipografías del sistema) | Leído en `styles.css` e `index.html`: no hay nada que bloquee el dibujado |
| Rutas | Todas con carga diferida; sin zone.js (`provideZonelessChangeDetection`) | Leído |
| Pre-renderizado | Solo `/privacidad` y `/terminos`. **Toda la tienda es una aplicación del lado del navegador**: hay que descargar y ejecutar el JavaScript antes de ver algo | Leído: `app.routes.server.ts` |
| Elemento más grande de la portada (candidato a LCP) | El banner de bienvenida (título y logo, este último con `loading="eager"`) es **estático**: no depende de la API. Las fotos de producto sí dependen, y todas llevan `loading="lazy"` | Leído. **El elemento real lo dirá la medición** |
| Indicador de carga de la portada | Un `spinner` hasta tener **todas** las llamadas (para que los carruseles aparezcan juntos); sin esqueletos | Leído |

## Línea de base de Lighthouse (PageSpeed Insights, móvil, sitio publicado antes del despliegue de estas mejoras)

Medida el 2026-11-09 con la clave gratuita de PageSpeed, **3 corridas por página y mediana**, sobre `https://www.laelsi.com.ar`:

| Página | Puntaje (corridas) | FCP | LCP | TBT | **CLS** | Speed Index | Peso y pedidos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inicio | **88** (93, 88, 88) | 0,8 s | 2,7 s | 7 ms | 0,073 | 7,4 s | 482 kB, 55 |
| Categoría | **71** (71, 72, 71) | 0,8 s | 3,3 s | 41 ms | **0,361** | 4,8 s | 483 kB, 56 |
| Ficha de producto | **68** (62, 68, 69) | 0,8 s | 3,5 s | 18 ms | **0,578** | 3,6 s | 416 kB, 43 |

Lo que dice la medición:

- **El 60 % no es el inicio** (88): está en la categoría y la ficha (68 a 71).
- **El problema principal es el salto de diseño (CLS)** en la categoría (0,361) y sobre todo en la ficha (0,578); por encima de 0,25 se considera malo. La categoría muestra "No hay productos que coincidan con tus filtros" mientras carga y recién después aparece la grilla, y el título entra tarde; la ficha arma su contenido cuando llegan los datos, sin reservar el lugar. **Esto confirma la idea de los esqueletos del ID 70.**
- **El peso del JavaScript no es el problema** (TBT de 7 a 41 ms). La única oportunidad grande que informa Lighthouse es "JavaScript sin usar": entre 450 y 600 ms.
- **Datos de usuarios reales (CrUX): sin datos**, el sitio todavía tiene poco tráfico para que Google los publique.
- PageSpeed no informó el elemento del LCP; hay que mirarlo con DevTools.

## Después del despliegue (misma medición, 2026-11-09, sitio publicado con las mejoras 1 a 4 y los esqueletos)

| Página | Puntaje antes → después | LCP | **CLS antes → después** | Speed Index |
| --- | --- | --- | --- | --- |
| Inicio | 88 → **91** (91, 91, 91) | 2,7 → 3,2 s | 0,073 → 0,073 | 7,4 → **3,6 s** |
| Categoría | 71 → **86** (86, 86, 86) | 3,3 → 3,8 s | 0,361 → **0,011** | 4,8 → 4,6 s |
| Ficha de producto | 68 → **90** (88, 90, 90) | 3,5 → 3,5 s | 0,578 → **0,050** | 3,6 → 3,4 s |

- **El salto de diseño quedó resuelto** en la categoría (de "malo" a casi cero) y en la ficha. Eso explica casi toda la suba de puntaje (+15 y +22 puntos).
- **El LCP no mejoró** (en inicio y categoría empeoró algo, 0,5 s): ahora el elemento más grande llega junto con los datos reales y los esqueletos no cuentan como contenido, como se había anticipado. El próximo paso para bajarlo es identificar el elemento del LCP con DevTools y priorizar su carga, o servir la portada con menos espera de la API.
- **Lo que sigue pendiente:** "JavaScript sin usar" (entre 470 y 620 ms de ahorro posible) y el inicio, que sigue en 91.
- **Verificado en producción:** `main-….js`, `chunk-….js` y `styles-….css` salen con `Cache-Control: public, max-age=31536000, immutable`; `index.csr.html`, `ngsw.json` y `ngsw-worker.js` siguen con `no-cache`.

## Qué puede explicar el 60 % (hipótesis a confirmar al medir)

| Hipótesis | Por qué | Qué métrica toca |
| --- | --- | --- |
| **Trabajo del procesador al arrancar** (ejecutar Angular y las bibliotecas, con el procesador de teléfono lento que simula Lighthouse) | 251 kB comprimidos equivalen a bastante más JavaScript ya descomprimido; hay 11 archivos precargados | TBT, FCP, LCP |
| **Dependencia del JavaScript para ver cualquier cosa** | Sin pre-renderizado, el HTML inicial no tiene contenido | FCP, LCP |
| **Espera por la API** antes de mostrar los carruseles, con arranque en frío de las funciones (1,2 s) | Dos tandas de llamadas y dos funciones distintas que pueden estar frías | Sensación de carga; LCP solo si la foto de un producto es el elemento más grande |
| **Fotos reales sin tamaño ajustado** | Se guarda una sola versión de hasta 1.200 px y se muestra en tarjetas de unos 300 px | LCP y peso transferido (hoy casi no se nota por las imágenes de prueba) |
| **Conexiones tardías** (DNS y TLS con la API y con las imágenes) | No había `preconnect` | FCP, LCP |
| **Archivos sin caché duradera** | `max-age=0` en archivos con nombre único | No afecta la primera visita, sí las repetidas |

## Plan de mejoras rápidas, por orden de valor

Cada una dice qué cambia, el esfuerzo y su efecto en el cupo gratuito de Supabase.

| # | Mejora | Esfuerzo | Efecto en Supabase | Estado |
| --- | --- | --- | --- | --- |
| 0 | **Medir antes y después** (ver el protocolo, abajo) | Chico | Ninguno | Pendiente: necesita una decisión |
| 1 | **`preconnect`** a la API y a las imágenes en `index.html` | Mínimo | Ninguno | **Hecho** |
| 2 | **Una sola llamada para la portada** (`GET /products/home`, que devuelve más vendidos y las 5 categorías con sus más vendidos). Sin segunda tanda y sin esperar a las categorías | Medio: una ruta nueva en `products`, con pruebas, y cambio de `main-page` | **Baja de 8 a 1 invocación por visita** | Para decidir |
| 3 | **`Cache-Control` en las respuestas públicas del catálogo** (por ejemplo `public, max-age=60, stale-while-revalidate=300` en los listados, más vendidos y categorías). El navegador deja de repetir llamadas | Chico: cabecera en `ok()` de las rutas públicas | **Reduce las invocaciones** de quien recarga o vuelve a una pantalla. Costo: un cambio del panel tarda hasta un minuto (más lo que ya tarda el caché en memoria, 3 minutos) en verse en la tienda | Para decidir |
| 4 | **Caché duradera para los archivos con nombre único** en `vercel.json` (`immutable`, un año) | Chico, pero **no se puede validar en local**: un `vercel.json` inválido rompe el despliegue, así que se prueba en una vista previa de Vercel antes. Solo debe alcanzar a los archivos con hash, **no** a `index.csr.html`, `ngsw*.js` ni `assets/` | Ninguno | Para decidir. Fragmento propuesto, abajo |
| 5 | ~~Cachear las imágenes en Cloudflare~~ | — | — | **Descartada: ya se cachean** (`cf-cache-status: HIT`). Se había propuesto por una medición errónea con `HEAD` |
| 6 | **Prioridad en la imagen más grande** (`fetchpriority="high"` y sin `loading="lazy"` en la que sea el elemento más grande) y **tamaños de imagen**: `width` y `height` más versiones chicas | Medio | Ninguno | **Después de medir**, porque hoy no se sabe cuál es ese elemento |
| 7 | **Esqueletos** en lugar del `spinner` (idea de Facundo) | Medio | Ninguno | Con la 2: mejora la **sensación** de carga y evita saltos de diseño. **No mejora el LCP por sí mismo** (un esqueleto no cuenta como contenido) |
| 8 | **`@defer (on viewport)` en los carruseles de categoría** (idea de Facundo) | Medio | **Reduce las llamadas iniciales**: los carruseles fuera de pantalla no piden nada hasta que se ven | Con la 2 queda redundante en la portada; sirve para las pantallas largas |
| 9 | **Mantener "calientes" las funciones** con una llamada programada cada pocos minutos, contra el arranque en frío de 1,2 s | Chico (GitHub Actions) | **Gasta cupo**: cada llamada es una invocación. Dos funciones cada 5 minutos son unas 17.000 al mes, un 3,5 % del cupo | **No recomendado todavía**: primero medir cuánto pesa de verdad el arranque en frío en el LCP |

Fragmento propuesto para la mejora 4 (sin aplicar):

```json
{
  "source": "/:archivo((?:main|chunk|styles)-[A-Z0-9]+\\.(?:js|css))",
  "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
}
```

## Sobre las ideas del ID 70

- **Esqueletos:** sí, pero como mejora de la sensación de carga y de la estabilidad visual, no como solución del puntaje de LCP. Conviene cuando la portada se arme con una sola llamada.
- **`@defer`:** la ronda 26 lo había descartado porque `fe/` se elimina. Para el sistema actual **sí sirve**, y en Next.js tiene su equivalente en el "streaming" de partes de la página.

## Criterios para el sistema nuevo (Next.js)

1. **Catálogo servido desde caché:** páginas de inicio, categoría y ficha generadas en el servidor y cacheadas en el borde (regeneración por tiempo o a pedido cuando el panel cambia algo). Con eso la visita normal **no invoca nada de Supabase**: es el criterio que más cuida el cupo gratuito.
2. **Una consulta por pantalla**, sin cascadas de llamadas dependientes.
3. **Imágenes con tamaño por ubicación** (varias versiones y `srcset`) y con la imagen principal priorizada. Cómo generarlas gratis (por ejemplo con transformaciones de Cloudflare) **está por verificar** antes de decidir.
4. **Presupuesto de rendimiento en el CI** (Lighthouse CI sobre inicio, categoría y ficha, en móvil) para que no vuelva a bajar sin que nadie lo note. Es parte de la validación del ADR 0002 en E1.
5. **Meta propuesta (mía, sin decidir):** 90 o más en móvil en inicio, categoría y ficha.

## Protocolo de medición (paso 0)

- **Qué:** Lighthouse en móvil sobre tres páginas (inicio, una categoría y una ficha de producto), **tres corridas y la mediana**, con el caché vacío. Anotar puntaje, FCP, LCP, TBT, CLS y **cuál es el elemento del LCP**.
- **Cómo, tres caminos:**
  1. **Facundo** corre Lighthouse en F12 (como ya lo hace) y me pasa las métricas y el informe exportado en JSON. No requiere nada de mi parte.
  2. **Clave gratuita de PageSpeed Insights** (Google Cloud, sin costo): con ella lo mido yo antes y después de cada mejora, sobre el sitio publicado, sin instalar nada.
  3. **Local:** compilar para producción, servir y correr Lighthouse, que además permite ver qué pesa cada archivo. Necesita tu aceptación expresa (compilar y servir) y una herramienta que hoy no está instalada.
- **Cuándo:** una vez al comienzo y después de cada tanda de mejoras.

## Para decidir

1. **¿Cómo medimos?** Recomiendo el camino 2 (clave gratuita), y el 1 mientras tanto.
2. **¿Hago la mejora 2** (portada en una sola llamada)? Es la de más valor, y baja el consumo del cupo gratuito.
3. **¿Hago la mejora 3** (`Cache-Control` en las respuestas públicas)? Acepta que un cambio del panel tarde hasta un minuto más en verse.
4. **¿Aplicamos la 4?** Con prueba previa en una vista previa de Vercel. (La 5 se descartó: las imágenes ya se cachean.)
