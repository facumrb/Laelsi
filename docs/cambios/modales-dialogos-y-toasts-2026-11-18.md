# Modales, diálogos y toasts (2026-11-18)

Renovación de los modales y las confirmaciones del frontend (`fe/`). Todos pasan a compartir la misma base y la estética. No se instaló ni se desinstaló ningún paquete: `sweetalert2` sigue instalado y se usa para los toasts.

## Resumen

- Hay una base común para los modales (`app-modal-shell`). Junto con ella hay una escala única de capas (z-index), un bloqueo del scroll con contador y una pila que decide qué modal está arriba.
- Los avisos, las confirmaciones y los pedidos de un dato de `AlertService` dejan de usar sweetalert2 y pasan a ser diálogos propios. La API pública de `AlertService` no cambia.
- Los toasts (`toast()`, `error()` y `success()`) siguen en sweetalert2, con su estética por defecto.
- Se migran 11 modales a la base común. Los dos drawers (el menú lateral del panel y el de la tienda en el celular) adoptan la escala de capas y el bloqueo del scroll.
- Se corrigen varios problemas que aparecieron durante la migración (ver "Correcciones").

## Infraestructura nueva

| Archivo | Qué hace |
| --- | --- |
| `fe/src/app/shared/components/modals/modal-shell/` | Shell de los modales: fondo, tarjeta, header (título, subtítulo, ficha de ícono con su tono, header con fondo opcional), cuerpo desplazable y pie. Tiene las ranuras `[modalStrip]`, `[modalFooter]`, `[modalForm]` y `[modalSubtitle]`, y la directiva `modalDescription` para `aria-describedby`. Acepta los inputs `size`, `height` (en `dvh`), `dismissible` (bloqueante), `busy`, `lockScroll` y `flushBody`. Lleva `role="dialog"`, `aria-modal`, trampa de foco (CDK a11y) y foco inicial en `cdkFocusInitial` o en la X |
| `fe/src/app/services/ui/modal-stack.service.ts` | Pila de modales abiertos. Decide la capa (modal, anidado, bloqueante) y deja que Escape y el clic en el fondo cierren solo el de arriba. Escape se escucha en `document` y se ignora si alguien cortó la propagación o hizo `preventDefault` |
| `fe/src/app/services/ui/scroll-lock.service.ts` | Bloqueo del scroll de la página con contador. Admite zonas que sí se desplazan (el cuerpo del modal o el drawer) y evita el salto por la barra de desplazamiento |
| `fe/src/app/services/ui/dialog.service.ts` | Diálogos propios: `avisar`, `confirmar` y `pedirDato`. Se muestran de a uno, en cola, y los avisos repetidos comparten la promesa. En el servidor (SSR) se resuelven como descartados |
| `fe/src/app/shared/components/modals/dialog-host/` | Host que dibuja esos diálogos. Se carga con `@defer (on idle; when hayDialogo())`. Si la carga falla, descarta la cola para que ninguna promesa quede colgada |

### `app.component.ts`

Se agrega `<app-dialog-host />` junto al `<router-outlet />`. El host tiene que vivir en la raíz para estar en cualquier ruta (tienda, panel, actualización de la app). También tiene que sobrevivir al cambio de layout, por ejemplo:

- el resumen del pedido muestra un aviso y navega a `/auth/login`;
- el manejo de errores de la API cierra la sesión y después avisa.

### `AlertService`

- `modal()`, `confirmDelete()`, `confirmAction()`, `askPhone()` y `askCurrentPassword()` delegan en `DialogService` y conservan sus firmas.
- `modal()` ya no acepta HTML: recibe texto plano y, opcionalmente, un bloque `detalle` con datos destacados. El aviso del alias de pago en el resumen del pedido usa ese bloque.
- `askCurrentPassword()` no recorta la contraseña: los espacios pueden ser parte de ella. Si el valor está vacío o tiene solo espacios, muestra el error y el diálogo sigue abierto.
- `toast()` usa `titleText` en lugar de `title`, sin cambio visual. Así el título nunca se interpreta como HTML: hay toasts que muestran datos externos, como el mensaje de error del registro o el nombre de una categoría.
- sweetalert2 se sigue cargando bajo demanda, a través del token `CARGAR_SWEETALERT`.

### `styles.css`

- Tokens de color `--color-brand` y `--color-brand-hover`, y la animación de entrada de los modales.
- Escala de capas: `--z-dropdown` 20, `--z-header` 50, `--z-drawer` 60, `--z-modal` 100, `--z-modal-nested` 110, `--z-blocking` 200 y `--z-toast` 1060. `--z-toast` es el z-index que sweetalert2 le da por defecto a su contenedor de toasts.
- Clases globales `btn-primary`, `btn-danger`, `modal-capa`, `modal-body`, `modal-body-flush` y `modal-footer`. Incluyen un ajuste para pantallas de poca altura (`max-height: 480px`).
- Se borraron las clases `.elsi-modal-*` y `.elsi-btn-primary-full`, que ya no se usan.

## Modales migrados

`confirm-delete`, `category-delete-blocked`, `admin-self-delete-blocked`, `verify-password`, `category-products`, `order-detail`, `cancel-order`, `bulk-price`, `categories-order`, `inactive-category` y `terms-gate`.

En cada uno se conservan:

- los textos, los inputs y outputs, y los `data-testid`;
- cuándo y cómo se cierra;
- el foco inicial y los estados de carga.

Cambian:

- el fondo, la tarjeta, el header y el pie, que pasan a ser los del shell;
- la capa, que ahora decide la pila;
- el bloqueo del scroll;
- el manejo de Escape y de la trampa de foco, que ahora son comunes.

Cambios de contenido acordados con el dueño:

- **Eliminar o desactivar** (`confirm-delete`):
  - El header muestra solo la acción ("Eliminar producto", "Desactivar administrador"…) con el subtítulo "Esta acción requiere confirmación". La entidad afectada va en el cuerpo, debajo de una etiqueta destacada.
  - El detalle va en una sola caja neutra con tres partes:
    - "La eliminación es permanente (no recomendado)";
    - las alternativas: Pausar ("se sigue viendo en la tienda como «no disponible por ahora», pero no se puede comprar") y Desactivar (recomendado);
    - "No se borra nada", cuando la acción es solo desactivar.
  - El botón Pausar conserva el color ámbar.
- **Acción bloqueada** (`category-delete-blocked` y `admin-self-delete-blocked`): la misma caja neutra, con "Motivo del bloqueo" y "Recomendaciones".

### Drawers

- **Menú lateral del panel:** usa `z-(--z-drawer)` y bloquea el scroll solo por debajo de `64rem`.
- **Menú lateral de la tienda (celular):** bloquea el scroll con el servicio y se cierra solo al pasar al ancho de escritorio (1100 px).
- **Header de la tienda:** usa `z-(--z-header)`.

## Correcciones

- `order-summary`: al terminar, navega a `/profile/orders`, y el aviso del alias de pago usa el bloque estructurado.
- Analíticas del panel: cancelar una orden desde la tabla abre el modal de cancelación y después refresca los datos.
- El enlace a analíticas del menú de la tienda (celular y barra superior) apunta a `/admin/analytics`.
- `click-outside`: con Escape solo saca el foco si el foco está dentro de su elemento.
- `close-modal-button`: pasa a ser `type="button"`, para no enviar el formulario que lo contiene.

## Qué revisar en el navegador

- Los toasts de éxito y de error tienen la estética de sweetalert2 y quedan por encima de un modal abierto.
- Escape y el clic en el fondo cierran solo el modal de arriba cuando hay uno abierto sobre otro.
- La página de fondo no se desplaza con un modal o un drawer abierto, y el contenido no salta al abrirlo.
- Los modales se ven bien en pantallas de poca altura (celular en horizontal).
