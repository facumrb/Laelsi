# Accesibilidad del sistema actual: auditoría (2026-11-09)

Responde a la pregunta de Facundo: ¿las cuestiones de accesibilidad están implementadas en todo el sistema? **Respuesta: la parte pública está muy bien; el panel de administración tiene huecos reales.** Dos fuentes: Lighthouse (PageSpeed Insights, móvil) sobre las páginas públicas y un barrido del código de las 98 plantillas de `fe/`.

## Lo que se midió

**Lighthouse, categoría "Accesibilidad", sitio publicado:**

| Página | Puntaje | Falla |
| --- | --- | --- |
| Inicio | 100 | 1 elemento: el nombre accesible no coincide con el texto visible |
| Categoría | 100 | 2 elementos, la misma auditoría (el botón "Filtros" y un enlace) |
| Ficha de producto | 100 | 1 elemento, la misma auditoría |
| Ingresar | 100 | ninguna |
| Registro | 100 | ninguna |

**Barrido de las plantillas (heurístico, no reemplaza una auditoría):**

| Qué se buscó | Resultado |
| --- | --- |
| `<img>` sin `alt` | **0** |
| Botones solo con ícono y sin nombre accesible | **0** |
| Pantallas con foco atrapado (`cdkTrapFocus`) | 22 usos; 9 diálogos con `role="dialog"` |
| Avisos para lectores de pantalla (`role="status"`, `aria-live`) | 10 |
| Estilos de foco visible frente a `outline-none` | 190 frente a 60 |
| Contraste de las etiquetas de las tarjetas del panel | corregido (ID 77) |

## Lo que está mal o incompleto

| # | Hallazgo | Dónde | Gravedad |
| --- | --- | --- | --- |
| A | **Los selectores desplegables hechos a mano no se pueden operar con teclado**: las opciones son `<li>` con clic, sin foco ni teclas | Estado y categoría en los formularios de categorías y productos, condición fiscal en el formulario de clientes y en "Mi perfil", selector de categoría del producto y filtros de productos | **Alta**: quien usa teclado o lector de pantalla no puede elegir una opción |
| B | Dos pantallas superpuestas sin `role="dialog"` ni `aria-modal` | Modal de reordenar categorías y detalle del pedido | Media |
| C | El nombre accesible no coincide con el texto visible (Lighthouse) | Botón "Filtros" y un enlace con `aria-label` distinto al texto | Baja |
| D | Un campo sin etiqueta asociada | Restablecer contraseña | Media |
| E | Celdas clicables solo con mouse (usuario o nombre que abre la edición) | Listas de clientes, administradores y productos | Baja: ya hay un botón "Editar" con teclado |
| F | Fondos de modales que cierran al hacer clic (`div` con `(click)`) | Casi todos los modales | **No es un defecto**: el modal ya se cierra con Escape y tiene su botón Cancelar |

## Estado de las correcciones (2026-11-09)

| # | Estado | Cómo |
| --- | --- | --- |
| A | **Corregido** | Directiva `appListbox` en los 9 selectores y en el acordeón de filtros de las listas (foco en la opción elegida, flechas, Inicio y Fin, Enter y Espacio, Escape y Tab). Escape cierra solo la lista y devuelve el foco al botón (antes `clickOutside` se lo sacaba y, dentro de un modal, cerraba también el modal) |
| B | **Corregido** | `role="dialog"`, `aria-modal` y `aria-labelledby` en reordenar categorías, detalle del pedido y "Categoría no disponible" |
| C | **Corregido** | El botón "Filtros" y el enlace de WhatsApp del carrito dejan que el texto visible sea el nombre; el del pie lo incluye en el `aria-label` |
| D | **No era un defecto** | Es un campo oculto de usuario para los gestores de contraseñas; la prueba permanente lo exceptúa |
| E | **Corregido** | Directiva `appActivable` (rol de botón, `tabindex`, Enter y Espacio) en las celdas clicables de clientes, administradores, productos, categorías, pedidos y analítica |

Prueba permanente: `supabase/functions/_tests/interfaz_accesible_test.ts` revisa todas las plantillas (imagen sin `alt`, botón de ícono sin nombre, diálogo sin rol, clic sin teclado, opción sin lista, nombre que no contiene el texto visible, campo sin etiqueta). Corre con `npm run test:funciones`.

## Lo que esta auditoría NO cubre

- **El panel de administración no se midió con Lighthouse** (exige iniciar sesión): está solo el barrido del código.
- **Pruebas manuales**: recorrer cada pantalla solo con el teclado, con un lector de pantalla (NVDA), con zoom al 200 % y en alto contraste. Lo automático detecta cerca de un tercio de los problemas.
- El contraste de color en todos los estados (foco, pasar el mouse, deshabilitado) no se verificó pantalla por pantalla.

## Propuesta

1. **Corregir A, B, C y D**, con pruebas primero. A es lo más importante: los selectores deben poder abrirse con teclado, recorrerse con flechas, elegirse con Enter y cerrarse con Escape, y anunciarse bien (`role="listbox"` y `role="option"` o un `<select>` nativo donde alcance).
2. **Una prueba permanente** que escanee las plantillas y falle si vuelve a aparecer una imagen sin `alt`, un botón de ícono sin nombre, una pantalla superpuesta sin `role="dialog"` o un clic en un elemento no interactivo sin teclado. Igual que la que ya impide los emojis decorativos.
3. **Una pasada manual** con teclado y lector de pantalla por el panel, que es lo único que cierra el tema.
