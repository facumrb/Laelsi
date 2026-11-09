# Revisión de diseño adaptable y usabilidad del panel de administración y de acceso (ID 64, 2026-11-09)

**Estado: diagnóstico aprobado el 2026-11-09; se implementa por tandas** (ver "Avance de la implementación"). El ID 64 de [discusiones.md](./discusiones.md) pide recorrer las vistas, registrar cada problema con su tamaño de pantalla, proponer una acción priorizada y no implementar hasta que se apruebe el diagnóstico.

## Avance de la implementación

| Tanda | Hallazgos | Estado | Cómo se verificó |
| --- | --- | --- | --- |
| 1 | 1, 2 y 3 | **Hecha** (en la rama de vista previa, no en `main`) | Pruebas primero: `interfaz_adaptable_test.ts` (todo diálogo con foco atrapado tiene alto máximo y scroll interno), pruebas de clases del filtro de Productos y de las dos barras. Con el arnés de la revisión: a 740×360 y 360×640 los modales de eliminar y de cancelar entran completos (18 a 342 px en una ventana de 360), con el cuerpo scrolleable y los botones visibles; el filtro de Productos no se corta en ninguno de 15 anchos (320 a 1366); ninguna barra de herramientas se recorta de 1024 a 1366 px |
| 2 | 4 y 5 (tarjetas en dos columnas, texto en dos líneas) | **Hecha** (en la rama de vista previa, no en `main`) | Prueba primero sobre `styles.css` (`.admin-table-row` es una grilla de dos columnas por debajo de `lg`), y pruebas del modal de eliminar (nombre completo en el cuerpo, título de hasta dos líneas). Con el arnés, altura de cada tarjeta a 360 / 768 px, antes → después: Productos 289 / 289 → 276 / 228; Clientes 441 / 441 → 398 / 333; Administradores 352 / 352 → 372 / 291; Órdenes 491–537 / 491–497 → 436–452 / 299; Categorías 215–301 / 215 → 215–301 / 178–192. A 768 px bajan entre 17 % y 40 %; a 360 px el cambio es chico porque ahí se mantiene una columna con pares cortos lado a lado, y Administradores sube 20 px porque ahora el correo completo se ve en dos líneas en vez de cortarse. Sin desbordes de celda de 320 a 380 px (Clientes a menos de 360 px usa fila completa para DNI/CUIT y condición fiscal) |
| 3 | 6 (Turnstile) | **Hecha** (en la rama de vista previa, no en `main`) | Según la documentación de Cloudflare (leída el 2026-11-09): `normal` 300×65 px, `flexible` 100 % con **mínimo de 300 px** (no arregla nada: el contenido de la tarjeta mide 222 px a 320 y 262 px a 360) y `compact` 150×140 px; el tamaño se pasa al dibujar el widget y la documentación no dice que se pueda cambiar después. Decisión aprobada: `compact` por debajo de 400 px de ancho y `normal` desde 400 (`elegirTamanoDelWidget`, con pruebas). Con el arnés (widget simulado con las medidas de la documentación): de 320 a 399 px mide 150×140 y queda centrado dentro de la tarjeta; a 400 px mide 300×65 y queda alineado con los campos. **Falta confirmarlo con el widget real** en la vista previa y saber el modo del widget en el panel de Cloudflare (si fuera Invisible no ocupa lugar) |
| 4 | 8, 9 y 10 (tamaños táctiles y fuentes) | **Hecha** (en la rama de vista previa, no en `main`) | Fuentes: prueba permanente que prohíbe `text-[Npx]` por debajo de 12 px en el panel, el acceso y lo compartido (salió roja con 12 apariciones; ahora todas son `text-xs`). Táctil: los botones de ícono de las tarjetas pasan de 20×20 a 36×36 px (`p-2`), y los enlaces que quedan solos en su línea (Órdenes, Analíticas, acceso) tienen al menos 24 px de alto. Con el arnés, de 320 a 768 px ya no quedan controles menores de 24 px ni fuentes menores de 12 px; solo quedan los campos de archivo ocultos (`sr-only`, 1×1 a propósito) y los enlaces dentro de una oración (exentos por el criterio 2.5.8). A 1366 px quedan nombres clicables de 20 px de alto dentro de las filas de la tabla y el botón de expandir de Categorías (20×20), separados de otros controles. **No se tocaron** las 11 fuentes chicas del catálogo público (`pages/client`), fuera del alcance del ID 64 |
| 5 | 7, 11, 12, 13 y 14 (formularios y ajustes menores) | **Hecha** (en la rama de vista previa, no en `main`) | **Corrección del diagnóstico (hallazgo 7):** los formularios de producto, cliente y administrador **ya** estaban en dos o tres columnas desde 768 px; solo el registro seguía en una columna hasta 1023 px. Lo hecho: `.form-grid-2` pasa a dos columnas desde `sm` (640 px) y el registro también; el pie de formulario envuelve (el botón "Cancelar" ya no se recorta a 320 px); el perfil ya no recorta etiqueta y valor a 1024 px; el detalle del pedido y reordenar categorías scrollean enteros en ventanas de hasta 480 px de alto (a 740×360 el diálogo pasa de unos 40 px de scroll útil a 324 visibles de 656); el encabezado muestra solo el ícono de "Ver Tienda" por debajo de 400 px, con nombre accesible que contiene el texto visible; y a 768 px Productos queda en una fila (actualizar precios, filtros y agregar) y Categorías también (ordenar, filtros y agregar). **Hallazgo nuevo, corregido:** `app-turnstile` es un elemento en línea y el espacio del formulario no se aplicaba: el widget quedaba pegado al botón "Crear Cuenta"; ahora es un bloque. Con el arnés ninguna de las 6 vistas medidas de 320 a 1024 px tiene recortes ni desbordes |

## Qué pedía y qué tiene que ver con el ID 77

El ID 64 pide que, en pantallas MD o menores, las tarjetas del panel dividan la información en **dos columnas**, y que se revisen tarjetas, menús, modales, login y registro. El **ID 77** (contraste de las etiquetas CATEGORÍA, PRECIO, STOCK, ACCIONES cuando la tarjeta está seleccionada) es un caso puntual de lo mismo y **ya está corregido** (`text-gray-600` en `.admin-table-mobile-label`, `styles.css`). Lo que **no estaba hecho** es lo que el ID 64 agrega: el diseño de dos columnas y el resto de esta lista.

## Cómo se revisó

- Aplicación local (`ng serve`) en un Chrome sin interfaz, con **datos inventados** (nombres largos, correos largos, productos sin foto, estados mezclados) y una sesión de administrador simulada. Cada pedido a Supabase lo respondió el propio arnés y todo destino externo estaba bloqueado: **no se tocó producción**.
- **33 escenas** (listas, formularios, perfil, filtros abiertos, desplegables, modales, menú móvil y de usuario, login, registro, recuperar y restablecer contraseña) a **320, 360, 768, 1024 y 1366 px**; ventanas bajas (740×360, 1024×600, 1280×600, 1093×560); y un barrido de **18 anchos** (320 a 1366) para los filtros.
- En cada escena se midió: elementos fuera de la ventana, paneles flotantes cortados por el costado o por abajo, contenido recortado por su contenedor, controles menores de 24×24 px, texto cortado con "…" y fuentes menores de 12 px; y se miraron las capturas.
- El arnés y las capturas quedaron fuera del repositorio (carpeta temporal); se pueden conservar si lo pedís.

## Lo que está bien

- **Ninguna vista tiene scroll horizontal** en ningún ancho.
- Los filtros de Categorías, Clientes, Administradores y Órdenes **no se cortan en ningún ancho** (de 320 a 1366).
- Los modales de detalle de pedido, reordenar categorías, productos de la categoría y actualizar precios entran completos y con scroll interno.
- Login, registro, recuperar y restablecer contraseña quedan centrados y legibles desde 320 px. El menú móvil y el menú del usuario funcionan.

## Hallazgos, por prioridad

### Alta

| # | Vista | Tamaño | Elemento y comportamiento observado | Impacto | Acción propuesta |
| --- | --- | --- | --- | --- | --- |
| 1 | Productos, Categorías, Clientes, Administradores, Órdenes (modales de eliminar, desactivar, cancelar pedido, bloqueo de borrado) | Ventana **baja** (medido 740×360, un celular apaisado) | `confirm-delete-modal`, `cancel-order-modal`, `category-delete-blocked-modal` y `admin-self-delete-blocked-modal` no tienen alto máximo ni scroll: el de eliminar mide **504 px** y en una ventana de 360 px queda **72 px arriba y 72 px abajo fuera de la pantalla**, sin forma de scrollear (el fondo es `overflow: visible`). Quedan cortados el título y los botones "Eliminar permanentemente / Desactivar / Pausar / Cancelar" | **No se puede usar el modal** en esa pantalla: usabilidad | `max-h-[90vh]` y `overflow-y-auto` en el cuerpo (como ya hacen los otros cuatro modales) y fondo con scroll |
| 2 | Productos: botón **Filtros** | **640 a 768 px** (tablet vertical, celular grande apaisado) | El panel usa `sm:left-auto sm:right-0 w-96` (384 px, pegado al borde derecho de su botón), pero el botón mide menos que eso hasta ~820 px: el panel queda **cortado por el borde izquierdo** (−70 px a 640, −40 a 700, −13 a 768; a 820 ya no) y el texto de la izquierda no se lee. Es lo que viste | Legibilidad | Cambiar `sm:` por `lg:` (3 clases en `products-filter-button.component.html`), como ya tienen los otros cuatro |
| 3 | Productos y Categorías: barra de herramientas | **1024 px** (con el menú lateral abierto) | El botón "+ Agregar Producto" / "+ Agregar Categoría" se sale de la ventana: se ve "+ Agreg…" y queda ~70 px fuera | Usabilidad (el botón principal casi no se lee) | Que la barra envuelva (`flex-wrap`) o que el texto largo aparezca desde `xl` en vez de `sm` |

### Media

| # | Vista | Tamaño | Elemento y comportamiento observado | Impacto | Acción propuesta |
| --- | --- | --- | --- | --- | --- |
| 4 | Tarjetas de Productos, Categorías, Clientes, Administradores y Órdenes | Menor de 1024 px (**es el pedido central del ID 64**) | Una sola columna: cada tarjeta mide **289 px (productos), 215 a 301 (categorías), 352 (administradores), 441 (clientes) y 491 a 537 (órdenes)**, igual a 360 que a 768 px. A 768 la tarjeta mide 705 px de ancho y los datos ocupan solo la tercera parte. `styles.css` ya trae `sm:col-span-2` en la primera y la última celda (preparado para dos columnas), pero `.admin-table-row` es `flex flex-col` y nunca se aplica. Además las etiquetas son inconsistentes: en Productos "CATEGORÍA:" tiene el valor debajo y "PRECIO:" y "STOCK:" en la misma línea; en Clientes todas debajo | Mucho scroll para ver pocos registros; datos mezclados | `.admin-table-row` pasa a `grid grid-cols-1 sm:grid-cols-2` por debajo de `lg`; la primera y la última celda (nombre, acciones) ocupan las dos columnas. Estimación, no medida: bajar la altura de cada tarjeta entre un tercio y la mitad. En 360 px, dos columnas solo para pares cortos (Precio/Stock, Pago/Total) |
| 5 | Tarjetas, Analíticas y modales | **360 px** | Texto cortado con "…" aunque la tarjeta tiene espacio: nombre de producto (194 de 337 px), correos en Clientes, Administradores y Órdenes, nombres de las listas de Analíticas, título del modal de eliminar ("Eliminar producto: …", no se ve cuál). A 768 px se ven completos | Se pierde el dato que identifica el registro | Permitir dos líneas en las tarjetas (`line-clamp-2` o `break-words`) y, en el modal de eliminar, poner el nombre completo en el cuerpo |
| 6 | Registro y Recuperar contraseña | **320 y 360 px** | El widget de Cloudflare Turnstile se dibuja en tamaño normal (300×65 px, `turnstile.component.ts` no define `size`). A 320 px **sale de la tarjeta** (la tarjeta mide 288 px); a 360 px sobresale de los campos (262 px). En esta revisión se simuló con un marco de 300×65: hay que confirmarlo con el widget real en la vista previa | Estético y de alineación; a 320 puede cortarse | `size: 'flexible'` o `'compact'` según el ancho (a verificar contra la documentación de Cloudflare antes de decidir) |
| 7 | Formularios (producto, cliente, administrador, registro) | 768 px y más | Los campos ocupan todo el ancho (606 px): DNI, teléfono, contraseña y confirmar. El espacio entre campos es grande (~60 px, con lugar reservado para el error) y distinto entre secciones. Existe `.form-grid-2` pero no se usa acá | Formularios largos (el de cliente mide ~3000 px a 360) | Dos columnas desde 640 px para Nombre/Apellido, DNI/Teléfono, Precio/Stock y Contraseña/Confirmar |

### Baja

| # | Vista | Tamaño | Elemento y comportamiento observado | Acción propuesta |
| --- | --- | --- | --- | --- |
| 8 | Tarjetas de todas las listas | Menor de 1024 px | Botones de ícono Editar, Eliminar, Desactivar y Reactivar de **20×20 px**: por debajo de 24×24 (WCAG 2.2, criterio 2.5.8, nivel AA; se recomienda 44×44) | `p-2` o `min-h-10 min-w-10`; la fila de acciones ya tiene lugar |
| 9 | Órdenes, Analíticas, Acceso | Todos | Enlaces solos en su línea de 19 a 20 px de alto: "#100" (32×19), nombre del cliente, "Ver todas", "Ver catálogo", "¿Olvidaste tu contraseña?", "Crear cuenta", "Iniciar sesión" | `py-2` para llegar a 24 px o más |
| 10 | Órdenes, Analíticas, Categorías, Perfil, formularios | Todos | Texto de 10 a 11 px: insignias de estado de Órdenes y Analíticas (10), "Nivel N" (10), etiquetas del Perfil (10) y ayudas de formularios (11) | Mínimo 12 px (`text-xs`) |
| 11 | Perfil | 1024 px | La etiqueta y el valor de "Nombre de usuario" quedan recortados 12 px por su contenedor. En el formulario de administrador a 320 px el botón "Cancelar" queda recortado 3 px | Revisar `min-w-0` y los márgenes negativos del pie del formulario |
| 12 | Detalle de pedido y Reordenar categorías | Ventana baja (360 px de alto) | El scroll interno queda en ~40 px de alto: el encabezado y el pie ocupan casi todo | Compactar el pie y ocultar el subtítulo en ventanas bajas |
| 13 | Encabezado del panel | 360 px | "Ver Tienda" se parte en dos líneas y el botón ocupa ~130 px | Solo el ícono con `aria-label` por debajo de 400 px |
| 14 | Barras de herramientas | 768 px | "Agregar" y "Actualizar precios" ocupan el ancho completo, cada uno en su fila | Una sola fila desde 640 px |

## Lo que esta revisión no cubre

- **Dispositivos reales**: se emuló el tamaño de pantalla, no el comportamiento táctil, el teclado en pantalla ni los navegadores móviles.
- **Turnstile real**: se simuló con un marco de 300×65 px (hallazgo 6).
- **Datos reales**: los datos son inventados para forzar casos extremos; con datos reales algunos cortes (hallazgo 5) serán menos frecuentes.
- **Contraste en todos los estados** (foco, pasar el mouse, deshabilitado) y la **pasada con lector de pantalla** (ver [accesibilidad-auditoria-2026-11-09.md](./accesibilidad-auditoria-2026-11-09.md)).
- La tienda pública (cliente) y el carrito: fuera del alcance de este ID.

## Orden de implementación propuesto (cuando lo apruebes)

Un commit por tema, con prueba primero cuando se pueda comprobar con una prueba (clases de la plantilla, como ya hace la prueba de accesibilidad) y verificación visual con el mismo arnés en los anchos de cada hallazgo:

1. Modales con alto máximo y scroll (hallazgo 1).
2. Filtro de Productos y barra de herramientas a 1024 px (2 y 3).
3. Tarjetas en dos columnas y texto en dos líneas (4 y 5).
4. Turnstile en pantallas chicas (6), después de ver el widget real en la vista previa.
5. Tamaños táctiles y fuentes (8, 9 y 10).
6. Formularios en dos columnas (7) y el resto de los ajustes menores (11 a 14).
