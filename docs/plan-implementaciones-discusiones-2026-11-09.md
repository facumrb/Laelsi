# Plan: implementaciones de `discusiones.md` en el sistema actual (2026-11-09)

Pedido de Facundo: todas las implementaciones de [discusiones.md](./requerimientos/discusiones.md) **se hacen lo antes posible en el sistema actual** (`fe/` y las Edge Functions), y se mejoran más adelante cuando el sistema multi-tenant esté en marcha y el repositorio sea privado. Hasta entonces, no se sube nada.

## Estado

| ID | Qué | Base de datos | Servidor | Pantalla (`fe/`) | Estado |
| --- | --- | --- | --- | --- | --- |
| 65 | Estado Activo o Inactivo de clientes y administradores, con filtros y **sin borrado físico** | Migración `20261106000200` **verificada** | **Hecho y probado** (rutas, protecciones, lógica) | **Hecha y probada** (filtro, reactivar, modal sin borrado permanente) | Falta probarlo funcionando |
| 54 | Estado **Pausado** distinto de Inactivo, y carrito que avisa | Migración `20261106000300` **verificada** | **Hecho y probado** (tienda, categoría y ruta `availability`) | **Hecha y probada** (selector, filtro, etiqueta, carrito, WhatsApp, "Pausar") | Falta probarlo funcionando |
| 68 | Carrito del administrador | — | — | **Hecha y probada** (ícono oculto para administradores y modal "MODO ADMIN: carrito no habilitado") | Falta probarlo funcionando |
| 77 | Contraste de las etiquetas de las tarjetas | — | — | **Hecho** (`text-gray-600`) | Hecho |
| 70 | Rendimiento (prioridad máxima) | — | — | **Investigación hecha** ([rendimiento-investigacion-2026-11-09.md](./requerimientos/rendimiento-investigacion-2026-11-09.md)); **Hechas** las mejoras 1 (`preconnect`), 2 (portada en una llamada, 8 a 1) y 3 (`Cache-Control` de 60 s en el catálogo público). Sin medición propia de Lighthouse todavía | Falta la clave de PageSpeed para medir, y las mejoras 4 y 5 (`vercel.json` y regla de Cloudflare), que son de configuración |
| 71 | Menos campos obligatorios al crear clientes | — | **Hecho y probado**: el alta desde el panel pide usuario, correo y contraseña | **Hecha y probada**: nombre, apellido, DNI y teléfono opcionales; nombres tolerantes a datos faltantes | Comparativa en [campos-de-clientes-comparativa-2026-11-09.md](./requerimientos/campos-de-clientes-comparativa-2026-11-09.md); 2 preguntas abiertas |

## Qué está verificado y cómo

- **Base de datos:** se confirmó el rojo (con las dos migraciones apartadas, 010 y 011 fallan por la razón correcta: falta el tipo, la columna y el valor del enum) y luego el verde: **373 pruebas pgTAP pasan** (362 anteriores + 8 + 3) después de `db reset` con todas las migraciones.
- **Servidor (Deno):** 107 pruebas pasan (con el ID 71). El único fallo es `conexion_privilegiada_test.ts`, que **falla a propósito hasta E0c**. Las reglas nuevas (estado de usuario, estados de publicación y la lectura de ids de `availability`) tienen sus pruebas, con rojo previo. `deno lint` sin hallazgos.
- **Frontend (`ng test`):** **35 archivos y 253 pruebas pasan** (con el ID 71: formulario de clientes y `NombrePersonaPipe`), incluidas las de los 8 archivos de los IDs 54, 65 y 68 (`cart.service`, `add-to-cart-control`, `product-status-badge`, `entity-state-badge`, `confirm-delete-modal`, `api-client.service`, `api-admin.service` y `disponibilidad-producto`). Para confirmar que detectan errores se hicieron dos mutaciones a propósito (quitar la protección de sumar cantidad de un producto no disponible, y mostrar siempre "Eliminar permanentemente"): cada una hizo fallar exactamente la prueba correspondiente, y luego se restauraron.
- **Tipos y plantillas de toda la aplicación** (`ngc --noEmit`, que no genera archivos): sin errores. `ng test` solo compila lo que las pruebas importan, así que esto cubre las páginas sin prueba (Clientes, Administradores, carrito, ficha de producto, barra superior). Se comprobó que el chequeo detecta de verdad un error de plantilla plantado a propósito.

## Dependencias de `fe/`: cómo están y por qué no hay nada que subir

El repositorio es un **monorepo con workspaces** (`"workspaces": ["be", "fe"]` en el `package.json` de la raíz): las dependencias de `fe/` se instalan en el `node_modules` de la **raíz**, no en `fe/node_modules`, y el archivo de bloqueo es el `package-lock.json` de la raíz, que ya está versionado. Las dependencias estaban instaladas (Angular 21.2.21, vitest 4.1.11, jsdom 27.4.0); el diagnóstico anterior de "`fe/` no tiene dependencias" era un error, por buscar `fe/node_modules`. No hizo falta instalar nada ni subir ningún archivo, y el lock no cambió.

## Qué NO está verificado

- **Nada se vio todavía en un navegador:** la pantalla (avisos del carrito, filtros, modal, teléfono al confirmar) se probó con pruebas automáticas y chequeo de tipos, no mirándola. La app no se compiló ni se sirvió.
- **Chequeo de tipos de las funciones del servidor:** sigue sin hacerse (`npm:postgres` no está instalado). Pasan `deno lint` y, sobre todo, el recorrido de integración de abajo.

## Recorrido de integración contra las funciones reales (hecho el 2026-11-09)

Se sirvieron **las funciones en local** (`supabase functions serve`, con un archivo de entorno propio y sin los secretos reales) contra la base local en el **mismo estado que producción** (hasta `20261106000300`) y se recorrieron los flujos con pedidos reales a la API: **41 comprobaciones, 41 correctas**. Cubren: alta mínima de clientes (con dos DNI vacíos conviviendo), filtros y cambio de estado, inicio de sesión de una cuenta inactiva (403), DELETE que solo desactiva, protecciones de administradores, productos Pausado e Inactivo en la tienda, `availability`, compra de un producto pausado (rechazada), portada en una llamada **idéntica a las 8 llamadas anteriores** (mismas categorías, productos y orden), y las cabeceras `Cache-Control` (presentes en lo público, ausentes en `availability`, el panel y los POST). El script es descartable y no está en el repositorio.

## Cambios nuevos en el servidor

- **`GET /products/availability?ids=1,2,3`:** responde el estado actual de varios productos juntos (`{ "1": "Activo", "2": "Pausado" }`). La necesita el carrito, que guarda una **copia** del producto y puede tener el estado vencido. Un producto que ya no existe figura como Inactivo; un id inválido o más de 50 devuelve 400. Es pública y devuelve solo el estado.
- Resto: ver "Lo que se hizo en el servidor" de la sección anterior del documento de papelera y estados.

## Qué cambia en la pantalla (`fe/`)

- **Carrito:** cada producto del carrito se consulta al abrir la página; uno pausado o inactivo muestra su aviso, no deja sumar unidades, no cuenta en el total, ofrece "Quitar del carrito" y (si está pausado) "Consultar por WhatsApp". **No se puede confirmar el pedido** mientras haya productos no disponibles (el servidor igual lo rechazaría entero). Esto responde al hueco del ID 54: hasta ahora el carrito dejaba sumar unidades de un producto desactivado.
- **Tienda:** un producto pausado se ve con "No disponible por ahora", el botón de agregar queda deshabilitado y, en su ficha, hay una consulta por WhatsApp.
- **Panel de productos:** estado Pausado en el formulario, el filtro y la insignia (ámbar), y "Pausar" en el modal de "Eliminar".
- **Clientes y administradores:** filtro de estado en el botón "Filtros" de ambas pestañas, insignia "Inactivo", acción **Reactivar** y un modal sin "Eliminar permanentemente" (solo desactiva, y dice que no se borra nada). En Administradores se sacó el control de "único administrador" del cliente: lo hace el servidor, porque con el filtro el total de la lista ya no es la cantidad de activos.
- **ID 68 (`PROVISIONAL-2026-11-09`):** se oculta el ícono del carrito **solo para administradores** (comentar el ícono entero lo habría ocultado también a los clientes) y, si un administrador toca "agregar", ve el modal "MODO ADMIN: carrito no habilitado".

## Orden de despliegue (importante)

**Los comandos exactos, el orden y la reversa están en [despliegue-discusiones-2026-11-09.md](./despliegue-discusiones-2026-11-09.md).** Resumen: migraciones, luego todas las funciones y al final el push, porque un push a `main` despliega `fe/` a producción solo (Vercel). `npm run db:push` aplicaría también las `20261107…` de multi-tenant: hay que apartarlas un momento. Lo corrés vos; yo no escribo en producción.

## Lo que sigue

1. **Desplegar** en el orden del documento de despliegue, y mirar el sitio. Si querés mirar la pantalla antes, se puede servir la app en local (necesita tu aceptación).
2. **Rendimiento (ID 70):** conseguir la clave de PageSpeed para medir antes y después, y decidir las mejoras 4 y 5 (configuración). **Campos de clientes (ID 71):** las 2 preguntas de la comparativa quedaron aprobadas y hechas.
3. Funciones SQL de E0b (`create_order`, `cancel_order`, `is_admin`, `current_user_id`, `handle_new_auth_user`), que también deberían informar mejor el estado pausado.
4. Papelera, alertas y archivo previo a la purga (E2a y E5a): se hacen en el sistema nuevo.
