# Rendimiento, CSS sin uso y comentarios (2026-11-13)

Tres trabajos sobre el sistema actual (`fe/` y las Edge Functions), en la rama `mejora-de-rendimiento`: mejoras de rendimiento que parten de [rendimiento-investigacion-2026-11-09.md](./requerimientos/rendimiento-investigacion-2026-11-09.md), eliminación del CSS sin uso y revisión de comentarios según la política de `CLAUDE.md`. Todo el trabajo es local: no se compiló, no se sirvió y no se commiteó nada. `be/` quedó fuera de alcance.

## Estado

| Bloque | Qué | Estado |
| --- | --- | --- |
| a | CSS sin uso: `@keyframes slideUp` y `--animate-slideUp` en `fe/src/styles.css` | **Hecho y revisado** (12 líneas borradas, sin hallazgos bloqueantes) |
| b1 | Pedidos públicos del catálogo sin `apikey` ni `Authorization`, para evitar la consulta previa (OPTIONS) | **Hecho y revisado** (sin bloqueantes; se sumaron las pruebas que pidió la revisión) |
| b2 | `Cache-Control` de 60 s en `GET /products/:id` y `/categories/:id`, salvo para administradores | **Hecho y revisado** (sin bloqueantes) |
| b3 | Tarjetas livianas: los listados públicos sin `description` y con una sola foto | **Hecho y revisado** (sin bloqueantes). La consulta SQL nueva todavía no se ejecutó contra una base |
| b4 | Foto principal de la ficha con `loading="eager"` y `fetchpriority="high"` | **Hecho y revisado dos veces** (sin bloqueantes; la corrección de la primera revisión quedó aplicada y aceptada) |
| b5 | Autocompletado del buscador con `limit=6` | **Hecho y revisado** (sin bloqueantes) |
| b6 | Esqueletos en la portada en lugar del indicador giratorio | **Hecho y revisado** (sin bloqueantes). La revisión encontró que el esqueleto reserva menos alto que el contenido real: ver "Detectado y no decidido" |
| b7 | Turnstile del carrito solo con sesión iniciada | **Hecho y revisado** (sin bloqueantes); aplicada y revisada la corrección que pidió la revisión (vaciar el token al perder la sesión) |
| b8 | Buscador sin `FormsModule` | **Hecho y revisado** (sin bloqueantes) |
| b9 | Menú lateral del celular y modal de "categoría no disponible" con `@defer` | **Hecho y revisado** (sin bloqueantes; se aplicó un ajuste menor de la revisión) |
| b10 | Modal de orden de categorías con `@defer` | **Hecho y revisado** (sin bloqueantes) |
| c1 | Comentarios: `fe/src/app/pages/admin` | **Hecho y revisado** (unos 150 comentarios quitados y 10 reescritos en 31 archivos; sin cambios de código; un comentario corregido a pedido de la revisión) |
| c2 | Comentarios: `fe/src/app/pages/client` | **Hecho y revisado** (21 archivos; sin cambios de código; un comentario afinado a pedido de la revisión) |
| c3 | Comentarios: `fe/src/app/pages/auth` | **Hecho y revisado** (18 comentarios obvios quitados en 6 archivos; sin cambios de código) |
| c4 | Comentarios: `fe/src/app/shared` | **Hecho y revisado** (19 archivos; sin cambios de código; se afinaron dos comentarios a pedido de la revisión) |
| c5 | Comentarios: `fe/src/app/services` y el resto de `fe/src/app` | **Hecho y revisado** (22 archivos; sin cambios de código; se afinaron dos comentarios a pedido de la revisión) |
| c6 | Comentarios: `supabase/functions` | **Hecho y revisado** (17 comentarios quitados y 11 reescritos en 9 archivos; sin cambios de código) |

## Decisiones tomadas

Se cerraron con el dueño del proyecto antes de implementar. Lo que no figura acá no se implementa.

| # | Decisión | Respuesta |
| --- | --- | --- |
| 1 | Comentarios de los archivos de prueba (`*.spec.ts`, `*_test.ts`) | Se revisan |
| 2 | Alcance de comentarios en `supabase/` | Solo `supabase/functions`. Fuera: todas las migraciones y `supabase/tests` |
| 3 | Revisión en el bloque c | Después de cada carpeta |
| 4 | Mejoras de rendimiento aprobadas | b1 a b6 (del informe del analista: 1, 2, 4, 3, 7 y 9) |
| 5 | Mejoras no aprobadas | Datos al instante con `placeholderData` y menos consultas a la base en las funciones del catálogo |
| 6 | CSS | Se borra solo `slideUp`. No hubo clases dudosas. Las reglas duplicadas no se tocan |
| 7 | Chequeo de tipos y plantillas con `ngc --noEmit` | Autorizado, al cerrar cada bloque que toque `fe/` |
| 8 | Pruebas nuevas | Las de pantalla son temporales (se borran en verde). Quedan las del interceptor, las de los servicios y las de Deno |
| 9 | `@defer` y afines | Se suman b7 a b10, aceptando que b8, b9 y b10 solo se confirman con un build y que ninguno mueve Lighthouse |
| 10 | Hidratación de `/privacidad` y `/terminos` | No se hace |
| 11 | Deno | No estaba instalado; se autorizó instalarlo con `winget` para correr las pruebas de las funciones |

Aclaración sobre b1: el riesgo es funcional, no de seguridad. La `apikey` es pública por diseño, las rutas marcadas no miran quién pide y el servidor sigue exigiendo sesión de administrador donde ya la exige.

## Qué está verificado y cómo

- **Línea de base, antes de tocar nada:** `npx ng test --no-watch` en `fe/`: **29 archivos y 239 pruebas pasan**.
- **Línea de base de las funciones (Deno 2.9.8):** `deno test --allow-read --allow-run=git supabase/functions/_tests/`: **132 pasan y 2 fallan**. Los 2 fallos son anteriores a este trabajo y están en `interfaz_adaptable_test.ts` ("el registro pone sus campos en dos columnas desde sm" y "el encabezado del panel muestra solo el ícono de Ver Tienda por debajo de 400 px"): comparan plantillas de `fe/` que esta tarea no había tocado al momento de correrlas. No se corrigen acá.
- **La API acepta pedidos sin `apikey`** (requisito de b1): `GET /functions/v1/products/home` contra producción, sin cabeceras, respondió 200 con `Access-Control-Allow-Origin` y `Cache-Control: public, max-age=60` (solo lectura, 2026-11-13).
- **Bloque a:** `slideUp`, `slide-up` y `animate-slideUp` no aparecen en ningún otro archivo de `fe/` (tres búsquedas independientes). Después del borrado, `ng test`: 29 archivos y 239 pruebas pasan.
- **Bloque b1:** rojo previo confirmado (11 pruebas fallaban con `expected true to be false` y `expected false to be true` antes del cambio). Después: `ng test` con **34 archivos y 266 pruebas en verde** y `ngc -p tsconfig.app.json --noEmit` sin errores. Salen sin credenciales diez pedidos GET: `/products/home`, `/products/availability`, `/products/active`, `/products/active/category/:id`, `/products/search`, `/products/best-sellers`, `/products/best-sellers/category/:id`, `/products/:id` y `/categories/:id` (solo desde la tienda) y `/categories/tree?state=Activo`. Los formularios del panel siguen pidiendo los detalles con credenciales. La revisión leyó cada handler del servidor y confirmó que ninguno de los marcados mira la sesión, y que no queda otra cabecera que dispare la consulta previa. Las pruebas de las queries y del navbar se validaron con una mutación: al quitar el `true` o el `'Activo'` fallaron exactamente las 3 pruebas que los fijan, y luego se restauró.
- **Bloque b2:** rojo previo confirmado (la función no existía). Después: `deno test` con **137 pasan y 2 fallan**, los mismos 2 de la línea de base. La respuesta cacheada lleva `Vary: Origin, Authorization`. La revisión comprobó, importando la función real, que un token de administrador devuelve "sin caché" con payloads de largo 4n, 4n+2 y 4n+3 y con caracteres no ASCII; que el navegador no puede servirle al panel la copia de la tienda (el `Vary` y la ausencia de `Cache-Control` en la respuesta al administrador); que el service worker no cachea la API (`ngsw-config.json` solo tiene el grupo de imágenes), y que invertir el criterio hace fallar las pruebas. Supuesto a tener presente: el servidor decide quién es administrador por la tabla `user`, y hoy coincide con `app_metadata.role` del token porque el alta es el único camino que asigna el rol; un cambio de rol hecho a mano por SQL dejaría a ese administrador recibiendo caché de 60 s en el panel.
- **Bloque b3:** antes de escribir se confirmó por lectura que ningún consumidor de los listados usa `description` ni más de una foto (tarjeta, buscador, carrito, resumen del pedido, mensaje de WhatsApp) y que ningún listado se reutiliza como detalle. Rojo previo confirmado (el módulo no existía). Después: `deno test` con **146 pasan y 2 fallan**, los mismos 2 de la línea de base. Quedaron livianas `/products/home`, `/active`, `/page`, `/search`, `/active/category/:id`, `/best-sellers` y `/best-sellers/category/:id`; siguen completas las dos rutas del panel, los dos detalles y `availability`. La revisión comparó la lista de columnas con la tabla `product` del esquema y con todas las migraciones hasta `20261106000300` (coincide, sin columnas inexistentes), confirmó que `photos[0]` es la misma foto que antes (mismo orden en ambas consultas) y que no se coló la mejora no aprobada de "menos consultas".
- **Bloque b4:** rojo previo confirmado (`expected 'lazy' to be 'eager'`, en el componente y en la ficha montada con consultas simuladas). Solo la foto principal de la ficha pasa `eager` y `high`; los otros nueve usos de `app-product-image` generan el mismo HTML que antes. La primera revisión detectó que `loading`, al dejar de ser un atributo fijo, se aplicaba después de `src`, con riesgo de descargar de entrada imágenes fuera de pantalla. Una prueba que intercepta la asignación de `src` mostró que reordenar la plantilla no alcanza (Angular aplica las propiedades antes que los atributos), así que `src` pasó a enlazarse como atributo (`[attr.src]`), detrás de `loading` y `fetchpriority`; con eso la prueba pasó. La segunda revisión confirmó, leyendo el compilador instalado, que `[attr.src]` usa el mismo saneamiento de URL que `[src]`, que la vista previa `data:` del gestor de fotos del panel sigue siendo válida y que `displayUrl()` nunca devuelve vacío. Las pruebas de este bloque eran temporales y se borraron.
- **Bloque b5:** rojo previo confirmado (el servicio se llamaba sin límite). Una sola constante, `MAX_SUGERENCIAS`, define lo que se pide y lo que se muestra. `ng test`: 34 archivos y 266 pruebas en verde, con el spec temporal ya borrado; `ngc --noEmit` sin errores. La revisión confirmó que el servidor acepta `limit=6` (acota entre 1 y 100) y que la página de resultados no cambia.
- **Bloque b6:** rojo previo confirmado (`expected +0 to be 10`: el indicador giratorio no mostraba esqueletos). La portada muestra dos secciones de esqueleto (más vendidos y una categoría) de cinco tarjetas, con la misma envoltura, la misma fila y los mismos anchos por tarjeta que las secciones reales, y los tres `track $index` pasaron a `product.id` e `item.category.id`. `ng test`: 34 archivos y 266 pruebas en verde con el spec temporal borrado; `ngc --noEmit` sin errores. La revisión confirmó en el servidor que no puede haber ids repetidos dentro de una misma lista ni dos secciones de la misma categoría, que el esqueleto no puede quedar para siempre y que los estados de error y de lista vacía muestran lo mismo que antes.
- **Bloque b7:** rojo previo confirmado (sin sesión, el widget estaba en el DOM). La condición es reactiva y un visitante sin sesión nunca llega a necesitar el token. `ng test`: 34 archivos y 266 pruebas en verde con el spec temporal borrado; `ngc --noEmit` sin errores. La revisión confirmó que al recargar con sesión guardada el widget se monta desde el primer dibujado y que la renovación del token de Supabase no lo desmonta.
- **Bloque b8:** rojo previo confirmado en las dos pruebas (el campo tenía las clases de `ngModel`, y la prueba estática señalaba a `search-bar.component.ts`). No hay ningún `<form>` en la plantilla del buscador y la tecla Enter se maneja con `keyup.enter`, así que no hay envío nativo. `ng test`: 34 archivos y 266 pruebas en verde; `ngc --noEmit` sin errores (descarta un `ngModel` olvidado); `deno test`: **148 pasan y 2 fallan**, los mismos 2 de la línea de base. Queda la prueba permanente `tienda_sin_formularios_test.ts`. La revisión confirmó que ningún ancestro del buscador es un `<form>`, que la señal y el campo no pueden quedar desincronizados, que ningún estilo ni prueba dependía de las clases `ng-*` y que el layout de la tienda no importa formularios por otro camino.
- **Corrección de b7:** rojo previo confirmado (con el token viejo, `checkout()` no mostraba "Verificación en curso"). Un `effect` vacía el token cuando se pierde la sesión.
- **Bloque b9:** rojo previo confirmado (con el menú cerrado, el diálogo estaba en el DOM, y no existía ningún bloque diferido). El menú lateral del celular va en `@defer (when showSideMenu(); prefetch on idle)` y el modal de "categoría no disponible" pasó a `InactiveCategoryModalComponent`, diferido con `when showInactiveCategoryModal()`. Cerrar y reabrir el menú sigue funcionando. Se adaptaron `category-page.component.spec.ts` y `navbar.component.spec.ts` sin cambiar lo que comprueban. El empaquetado que arma el corredor de pruebas mostró trozos aparte para el menú (24 kB) y para el modal (4 kB): indica que el compilador los separa, no cuánto pesan en producción.
- **Bloque b10:** rojo previo confirmado (con el modal cerrado, estaba en el DOM). El modal de orden carga el árbol con un `effect` que no depende del paso de cerrado a abierto, así que carga una vez en la primera apertura y otra en cada reapertura (comprobado con el componente real: 1 y 2 llamadas). El corredor de pruebas mostró un trozo aparte de 30 kB para el modal.
- **Revisión de b9, b10 y de la corrección de b7:** sin bloqueantes. Leyendo el código del CDK instalado, la revisión confirmó que el foco entra al menú del celular al montarse ya abierto (`ngAfterContentInit` captura el foco cuando la auto-captura es verdadera). Nada busca el menú por el DOM, y `@angular/cdk/a11y` ya no entra por ningún import directo en el layout de la tienda ni en la página de categoría. El modal extraído es equivalente al anterior en textos, clases, roles e ícono. A pedido de la revisión, el modal de categoría lleva además un `@if` dentro del bloque diferido, para que desaparezca al cerrarlo como antes (un bloque diferido no se desmonta); el spec de la categoría sigue en verde (8 de 8). En Angular 21 un `effect` puede escribir una señal sin opciones adicionales, así que la corrección de b7 no lanza en ejecución.
- **Bloque c3 (comentarios de `pages/auth`):** la revisión recorrió todas las líneas del diff: 16 líneas eliminadas son comentarios completos y las otras 2 son líneas de código a las que solo se les quitó el comentario del final. Se conservaron todos los que explican un porqué (token de un solo uso, gestor de contraseñas, mensaje idéntico exista o no la cuenta).
- **Bloque c6 (comentarios de `supabase/functions`):** la revisión separó en el diff los cambios de código de b2 y b3 de los del editor y confirmó que este solo tocó comentarios, ninguno dentro de una consulta SQL ni en nombres de pruebas. Contrastó cada comentario reescrito con el código (por ejemplo, "productos visibles con categoría activa" es exacto porque la tienda muestra Activos y Pausados; el texto anterior decía "solo los activos"). Las etiquetas `PROVISIONAL-` son 7 antes y 7 después, y no se quitó ninguna directiva. `deno test` después de este bloque: 148 pasan y 2 fallan, los mismos 2 de la línea de base.
- **Bloque c4 (comentarios de `shared`):** la revisión filtró todas las líneas del diff que no son comentario: solo quedaron dos líneas de código a las que se les quitó el comentario del final y los cambios de b4. Ningún comentario HTML eliminado era multilínea ni envolvía marcado, y no se tocó ninguna expresión regular. Sigue completa la explicación de la regla de no cerrar un modal cuando se seleccionó texto y se soltó el clic afuera. Los tres comentarios nuevos del gestor de fotos se contrastaron con el código y son exactos. A pedido de la revisión se corrigió el comentario de `trim-input.directive.ts`, que era inexacto desde antes (la directiva quita los espacios de ambos extremos y junta los repetidos), y se documentó en `click-outside.directive.ts` que Escape también emite `clickOutside`.
- **Bloque c5 (comentarios de `services` y el resto de `fe/src/app`):** abarcó `services/` (con `api-services/` y `queries/`), `interceptors/`, `guards/`, `models/` y los archivos sueltos de la raíz; no existen `utils`, `helpers` ni `constants` en `fe/src/app`. La revisión separó el código de b1 y confirmó que el editor solo tocó comentarios (tres líneas de código perdieron únicamente el comentario del final). En `auth.service.ts` siguen íntegros los comentarios sobre la sesión, la renovación del token y los eventos entre pestañas. La revisión detectó que una mención quitada de `error.interceptor.ts` ("se adjuntará en el AuthInterceptor") era falsa: el reintento tras un 401 no vuelve a pasar por ese interceptor, y por eso el token se pone a mano; ese porqué quedó ahora documentado en el archivo.
- **Bloque c2 (comentarios de `pages/client`):** la revisión leyó el diff completo de la carpeta (30 archivos, por el código de los bloques b4 a b9) y confirmó que el editor solo quitó comentarios de una línea, ninguno pegado a una etiqueta `PROVISIONAL-` ni envolviendo marcado. Las etiquetas `PROVISIONAL-` coinciden archivo por archivo entre HEAD y el árbol de trabajo (12 archivos), y siguen íntegros los bloques del ícono del carrito y del cartel de bienvenida. `deno test` después de este bloque: 148 pasan y 2 fallan, los mismos 2 de la línea de base (las pruebas que leen plantillas del navbar no se vieron afectadas).
- **Bloque c1 (comentarios de `pages/admin`):** la revisión aplicó un filtro mecánico sobre el diff (todas las líneas tocadas que no son comentario): quedaron 18, de las cuales 10 son el `@defer` de b10 y 8 son cuatro líneas de código que solo perdieron el comentario del final. Los comentarios HTML abiertos y cerrados coinciden en los 8 archivos de plantilla modificados. Las referencias a decisiones se conservan (ID 54: 1 y 1; ID 64: 3 y 3; ID 65: 5 y 5). Siguen documentados el acordeón de categorías, el ordenamiento jerárquico, la contraseña obligatoria al crear y opcional al editar, y las reglas del cambio masivo de precios. A pedido de la revisión se corrigió un comentario de `admins-form.component.ts` que describía mal el código (decía "actualizar el token" y lo que se actualiza son el nombre, el apellido y la foto de la sesión). `deno test` después de este bloque: 148 pasan y 2 fallan, los mismos 2 de la línea de base.
- **Verificación final, con todos los bloques aplicados y el árbol de trabajo quieto:** `ng test` con **34 archivos y 266 pruebas en verde**; `ngc -p tsconfig.app.json --noEmit` sin errores; `deno test` con **148 pasan y 2 fallan**, los mismos 2 de la línea de base (`interfaz_adaptable_test.ts`). Sin specs temporales en el repositorio, sin commits (el último sigue siendo `3dff112`), y sin cambios en `be/`, `supabase/migrations`, `supabase/tests` ni en los `package.json` y el archivo de bloqueo. El diff abarca 125 archivos versionados más 12 nuevos.
- **Estado con todos los bloques de rendimiento aplicados** (antes de los bloques de comentarios) (corrido con el árbol de trabajo quieto): `ng test` con **34 archivos y 266 pruebas en verde**; `ngc -p tsconfig.app.json --noEmit` sin errores; `deno test` con **148 pasan y 2 fallan**, los mismos 2 de la línea de base; ningún spec temporal quedó en el repositorio.

## Detectado y no decidido

- **El esqueleto de tarjeta es más bajo que la tarjeta real** (`product-card-skeleton.component.html:18-23`, anterior a este trabajo y compartido con la página de categoría): su pie mide 49 px contra 89 px de la tarjeta real (93 px desde `sm`), porque no reserva el lugar del botón de agregar. En la portada, al llegar los datos, lo que está debajo de la primera sección baja entre 20 y 44 px. Además, en celulares los títulos largos de categoría pasan a dos líneas y la cabecera real mide más que la del esqueleto (esto último es un cálculo, falta mirarlo). El salto es mucho menor que el de antes, pero no desaparece. Corrección propuesta por la revisión, sin hacer: que el pie del esqueleto apile una barra de precio y una barra de botón como la tarjeta real; corrige también la categoría, pero cambia lo que se ve.
- **Comentarios con historia de la migración que se conservaron en `supabase/functions`:** cabeceras "Reemplaza a X.routes.ts + ..." en casi todas las funciones, "(reemplaza a MikroORM)" en `db.ts`, "(Tarea 5.5)" y la tabla de equivalencias en `http.ts`, "(igual que hacía FileStorageUtil.safeDeleteFile)" en `r2.ts`. Recomendación de la revisión: quitarlos cuando `be/` se dé de baja, porque hasta entonces sirven de referencia cruzada; y conservar "Ajuste de seguridad respecto del backend anterior..." de `orders` y `clients`, que explica una decisión vigente.
- **El tipo `IApiProduct` del frontend declara `description` como obligatorio** (`fe/src/app/models/product.model.ts:26`), y las fotos declaran `order` y `productId`; desde b3 los listados públicos ya no los mandan. Nada se rompe en ejecución porque ningún consumidor de listados los lee, pero el tipo ya no describe la respuesta. Propuesta de la revisión, sin hacer: un tipo `IProductCard` para las respuestas de listado.
- **La lista de columnas de `loadProductCards` está escrita a mano** (`supabase/functions/_shared/catalogo.ts`). Si una migración futura agrega una columna a `product`, el panel la recibirá y las tarjetas no, sin que nada falle. Hay que revisarla al aplicar las migraciones de multi-tenant.
- **La foto principal de la ficha no reinicia su estado de error al cambiar de miniatura** (anterior a este trabajo): si una foto falla, las siguientes siguen mostrando la imagen de reemplazo.

- **Cuatro rutas públicas más que podrían salir sin credenciales** y no estaban en la lista aprobada de b1: `GET /categories/active` y `/categories/search` (las usa la tienda), y `GET /products/page` y `/products/active/:id` (hoy sin uso en la tienda). No se tocaron.
- **`deno lint supabase/functions` informa 28 problemas**, ninguno en los archivos de esta tarea. No se verificó si son anteriores.

## Qué NO está verificado

- **Nada se vio en un navegador:** la aplicación no se compiló ni se sirvió. En particular, no se miró: la portada con esqueletos, la ficha, el buscador sin `ngModel` (ni la escritura con teclados de composición), el carrito con y sin sesión con el widget real de Cloudflare, la primera apertura del menú del celular (que ya no se desliza la primera vez) ni la de los modales diferidos.
- **Efecto real en Lighthouse (LCP, CLS) y en el cupo de Supabase:** no se midió. Que las consultas OPTIONS cuenten como invocaciones es una hipótesis.
- **Que el navegador deje de mandar la consulta previa:** se dedujo de las cabeceras que salen (ninguna propia en los pedidos marcados) y del estándar de CORS; no se observó en la pestaña de red.
- **La consulta SQL nueva de las tarjetas livianas (b3) nunca se ejecutó.** Se comparó por lectura con el esquema y con las migraciones, pero no corrió contra una base: las imágenes de Supabase para Docker no están descargadas en esta máquina. Tampoco se pudo chequear los tipos de `products/index.ts` (`npm:postgres` no está instalado). Si la consulta fallara, darían error 500 a la vez la portada, los listados y la búsqueda. **Conviene probarla en local antes de desplegar las funciones.**
- **Cuánto peso sale de cada trozo con b8, b9 y b10:** solo lo dice un build. El corredor de pruebas mostró trozos aparte para el menú del celular, el modal de categoría y el modal de orden, lo que indica que el compilador los separa, no su tamaño en producción.
- **Los cambios en `supabase/functions` (b2, b3 y los comentarios) no están desplegados:** no tienen efecto hasta que se desplieguen las funciones. Si se sube `fe/` antes que las funciones, la ficha y la categoría siguen sin caché y los listados siguen completos, pero nada se rompe: ningún cambio del frontend depende de los del servidor.
- **Los 2 fallos anteriores de `interfaz_adaptable_test.ts`** siguen sin investigar: no forman parte de esta tarea.

## Herramientas y entorno

- **Deno 2.9.8** se instaló con `winget install DenoLand.Deno`, con autorización expresa, para correr las pruebas de las funciones. No se tocó el repositorio ni el archivo de bloqueo.
- **Docker Desktop** se inició para probar la consulta de b3, pero la pila de Supabase no se levantó porque sus imágenes no están descargadas. Quedó abierto.

## Medición local con Lighthouse (2026-11-14)

Con aceptación expresa se compilaron para producción el último commit ("antes") y el estado de trabajo ("después"), se sirvieron en `http://localhost:4200` con un servidor estático propio (brotli, HTTP/1.1) y se midieron con Lighthouse 12.8.2 en Edge, móvil, 3 corridas por página y mediana. La app local llama a la API de producción, así que **no mide b2 ni b3**. Los números sirven para comparar los dos builds entre sí, no contra las mediciones de PageSpeed del sitio publicado.

**Peso (certeza, por el metafile del build):** el JavaScript que descarga una visita baja en las tres pantallas de la tienda: inicio 812,8 → 751,9 kB (217,1 → 204,9 kB con brotli), categoría 824,7 → 761,2 kB, ficha 817,6 → 754,6 kB. `@angular/forms` y `cdk/a11y` ya no se descargan en la tienda, y `cdk/drag-drop` salió del trozo de Categorías del panel (96,9 → 28,4 kB). El paquete **inicial** no cambia (780,7 → 781,0 kB) y pasa de 11 a 14 archivos.

**Lighthouse con red simulada (modo por defecto):**

| Página | Puntaje | FCP | LCP | CLS | TBT | Pedidos a la API |
| --- | --- | --- | --- | --- | --- | --- |
| Inicio | 75 → 81 | 2,8 → 3,1 s | 3,9 → 4,0 s | 0,107 → 0,011 | 295 → 129 ms | 2 GET + 2 OPTIONS → 2 GET |
| Categoría | 73 → 67 | 2,7 → 3,2 s | 4,2 → 4,8 s | 0,188 → 0,188 | 64 → 77 ms | 3 GET + 3 OPTIONS → 3 GET |
| Ficha | 82 → 76 | 2,7 → 3,1 s | 4,0 → 4,7 s | 0,011 → 0,011 | 96 → 95 ms | 2 GET + 2 OPTIONS → 2 GET |

**Lighthouse con red y procesador realmente limitados (`--throttling-method=devtools`):**

| Página | Puntaje | FCP | LCP | CLS |
| --- | --- | --- | --- | --- |
| Inicio | 52 → 48 | 6,7 → 7,0 s | 6,7 → 7,1 s | 0,107 → 0,011 |
| Categoría | 48 → 33 | 7,1 → 7,9 s | 8,9 → 9,4 s | 0,188 → 0,943 (2 de 3 corridas; la tercera, 0,188) |
| Ficha | 56 → 58 | 6,7 → 6,8 s | 8,1 → 7,9 s | 0,011 → 0,011 |

Qué quedó **verificado**:

- **Las consultas OPTIONS desaparecen** en las tres páginas (b1): era una hipótesis por lectura y ahora está observada en la lista de pedidos.
- **El salto de diseño del inicio baja de 0,107 a 0,011** (b6), en los dos modos.
- **La foto principal de la ficha ya no figura como "LCP con carga diferida"** (b4).
- **El peso por pantalla baja** unos 60 kB sin comprimir (b8, b9).

Qué salió **peor y no está explicado del todo**:

- **El primer pintado (FCP) empeora en este entorno local**: 0,3 a 0,5 s con red simulada y 0,1 a 0,8 s con limitación real. Se probaron dos causas con builds experimentales en una copia temporal: cambiar `prefetch on idle` del menú del celular por un temporizador de 4 s recupera cerca de 0,1 s, y quitar los tres `@defer` recupera otro tanto (FCP 2,9 a 3,0 s, contra 2,7 a 2,8 s del build anterior). Queda una diferencia sin explicar. El arranque pasó de 11 a 14 archivos, y el servidor local usa HTTP/1.1, donde cada archivo extra cuesta una espera adicional; en Vercel (HTTP/2) ese costo debería ser mucho menor, pero **no está comprobado**. Las métricas observadas sin limitación no empeoran.
- **El CLS de 0,943 de la categoría no es un defecto nuevo**: las capturas de antes y de después son iguales. Son dos saltos que ya existían y que, con los datos llegando antes, a veces caen en el mismo cuadro y Chrome los cuenta como uno grande: el pie de página que sube cuando la categoría tiene pocos productos (el esqueleto dibuja 16 tarjetas), y el encabezado, que se mueve cuando carga el logo (`<img>` con `loading="lazy"` y sin alto reservado).

**Oportunidades que marca Lighthouse** (ninguna hecha):

| Oportunidad | Dónde | Estimación de Lighthouse |
| --- | --- | --- |
| Imágenes más grandes que su tamaño en pantalla | Fotos de producto (una de 53 kB se muestra a 160×120) y el logo de 500 px mostrado a 128 px | 61 a 125 KiB; 150 a 300 ms |
| Imagen del LCP con carga diferida | Categoría: la primera tarjeta de producto es el LCP y carga con `lazy` | Sin cifra |
| Imagen del LCP no descubrible desde el HTML | Ficha: la foto depende de la API | 150 ms |
| JavaScript sin usar | Trozo del framework de Angular (57 de 103 kB transferidos) | 55 KiB; 300 a 450 ms |
| Saltos de diseño | Pie de página y logo del encabezado, en categoría | CLS 0,188 |

## Medición sobre Vercel: producción contra la vista previa de la rama (2026-11-14)

Los cambios se subieron a la rama `mejora-de-rendimiento` (commit `f14bc93`; `main` no se tocó) y Vercel publicó su vista previa. Como `main` está en el commit base de la rama, producción sirve de "antes" y la vista previa de "después", las dos por HTTP/2. Las midió el dueño del proyecto con Lighthouse 13.5 en Chrome (móvil, red simulada), 3 corridas por página; se toma la mediana. Las Edge Functions no se desplegaron, así que **no mide b2 ni b3**.

| Página | Puntaje | FCP | LCP | CLS | TBT | Pedidos a la API |
| --- | --- | --- | --- | --- | --- | --- |
| Inicio | 83 → 90 | 2,3 → 2,3 s | 3,4 → 3,1 s | 0,096 → 0,000 | 219 → 78 ms | 2 GET + 2 OPTIONS → 2 GET |
| Categoría | 70 → 72 | 2,3 → 2,2 s | 4,5 → 4,5 s | 0,177 → 0,188 | 212 → 108 ms | 3 GET + 3 OPTIONS → 3 GET |
| Ficha | 81 → 83 | 2,2 → 2,3 s | 4,1 → 4,2 s | 0,011 → 0,011 | 179 → 85 ms | 2 GET + 2 OPTIONS → 2 GET |

Conclusiones:

- **El empeoramiento del primer pintado visto en local no aparece en Vercel**: el FCP queda igual en las tres páginas (diferencias de 0,1 s, dentro de la variación entre corridas). Era un efecto del servidor local con HTTP/1.1, donde cada archivo extra del arranque cuesta una espera; con HTTP/2 los 3 o 4 archivos de más no pesan.
- **Mejora clara en el inicio**: el salto de diseño desaparece (0,096 → 0,000) y el puntaje pasa de 83 a 90, con las tres corridas en 90.
- **El tiempo de bloqueo (TBT) baja a menos de la mitad en las tres páginas.** No se aisló a qué cambio se debe.
- **Las consultas OPTIONS desaparecen** también en Vercel.
- **El LCP de la categoría y de la ficha no cambia.** En la ficha, la foto principal ya no carga con `lazy`, pero eso solo no alcanzó para mover el LCP: la imagen sigue dependiendo de la respuesta de la API.
- **El CLS de la categoría sigue en 0,18**: es el salto del pie de página, anterior a este trabajo.

Reservas: son 3 corridas por página y hay variación (el inicio de producción dio 71, 83 y 91); la vista previa carga un pedido extra de la barra de Vercel (`vercel.live`), que juega levemente en contra del "después"; y los dominios son distintos (dominio propio contra `vercel.app`).

## Correcciones de la categoría y su medición (2026-11-14)

Commit `29e312f` en la rama `mejora-de-rendimiento` (hecho con el implementador y revisado, sin bloqueantes):

- Las dos primeras tarjetas de la categoría cargan su foto sin `lazy` y con prioridad alta (entrada `prioritaria` de `ProductCardComponent`; la grilla tiene 2 columnas en celular).
- `<main>` del layout de la tienda tiene alto mínimo de pantalla, para que el pie de página no suba cuando la página queda corta. Las páginas cortas de la tienda quedan con más espacio en blanco antes del pie.
- El logo del pie reserva su proporción real (996×516) y ya no cambia de ancho al cargar.

Medición de `/category/1`, producción contra la vista previa de ese commit, Lighthouse 12.8 en Edge, móvil, 3 corridas alternadas y mediana:

| | Puntaje | FCP | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- |
| Producción | 77 (70, 77, 79) | 2,3 s | 3,9 s (4,7; 3,9; 3,6) | 0,177 | 106 ms |
| Vista previa | 80 (77, 80, 81) | 2,5 s | 4,4 s (4,4; 4,5; 4,4) | 0,011 | 103 ms |

- **El salto del pie de página quedó resuelto**: el CLS baja de 0,177 a 0,011 en las tres corridas.
- **La carga prioritaria de la primera fila no mostró mejora en el LCP.** La foto ya no figura como "con carga diferida", pero Lighthouse ahora pide precargarla (600 a 850 ms estimados): sigue dependiendo de la respuesta de la API para descubrirse. La comparación además tiene ruido (producción varió entre 3,6 y 4,7 s) y la vista previa carga un script de Vercel (`vercel.live`) que producción no tiene.

## Prueba de las tarjetas livianas contra una base real (2026-11-14)

La consulta nueva de b3 nunca se había ejecutado. Se probó con el código real de `supabase/functions/_shared/catalogo.ts` (una copia idéntica, fuera del repositorio) contra un Postgres 14.3 descartable en Docker, con el esquema cargado desde las migraciones del proyecto (`20261012000100`, `20261106000100` y `20261106000300`, aplicadas sin adaptaciones sobre un esquema `auth` mínimo) y cuatro productos de prueba. **13 comprobaciones, 13 correctas:**

- `loadProductCards` corre y devuelve los productos en el orden pedido, omitiendo los inexistentes.
- La tarjeta tiene las mismas claves que el producto completo menos `description`, y todos los demás campos son idénticos en valor y tipo (precio como número, categoría con sus padres).
- `photos` trae 0 o 1 elemento, y es la misma primera foto que la carga completa: la de menor `order` aunque tenga el `id` más alto, y con el mismo `order` desempata el `id` más bajo.
- `paginateProducts` con `tarjetas: true` sale liviano; sin el parámetro, como lo llama el panel, sale completo.

El contenedor se borró al terminar. Lo que esta prueba no cubre: las cabeceras de caché a través de una ruta real (tienen pruebas unitarias) y las rutas completas servidas como función. Postgres 14 no es la versión de producción; las consultas no usan nada específico de una versión.

## Propuestas que quedaron afuera

Con su motivo, para retomarlas:

- **Datos al instante (`placeholderData`) y menos consultas a la base en las funciones:** no aprobadas en esta tanda.
- **Carga diferida de `supabase-js` en las funciones:** hipótesis sobre el arranque en frío; solo los tiempos de los logs la confirmarían.
- **`OnPush` por defecto, service worker en modo `lazy`, `Promise.all` en los pedidos del panel:** impacto bajo.
- **Hidratación de las páginas legales (`provideClientHydration`):** impacto bajo; un desajuste solo se vería en el navegador.
- **Índices nuevos (trigram para la búsqueda y `(client_id, id desc)` en pedidos):** necesitan una migración y solo rinden con tablas grandes.
- **Versiones chicas de las fotos:** conviene esperar al catálogo real.
- **Reglas CSS duplicadas que sí se usan** (`.table-th` igual a `.admin-table-header-cell`; `.navbar-static-link` casi igual a `.navbar-link`): unificarlas es un refactor aparte.
- **`@defer` en los carruseles de la portada:** descartado; no ahorra llamadas desde que la portada se arma en una sola y choca con los esqueletos.
