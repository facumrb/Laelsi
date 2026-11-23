# Revisión de seguridad, datos y rendimiento

Fecha: 2026-10-21 · Rama: `main` · Estado: **sin commit, sin build y nada aplicado en producción**.

Alcance: frontend (Angular), Edge Functions y migraciones de Supabase. El frontend nunca consulta las tablas con `supabase-js`: todo pasa por las Edge Functions (que se conectan con privilegios de servicio y **no pasan por RLS**), salvo una llamada directa a la API REST: `rpc/check_field_unique`. Por eso, en este proyecto, la única barrera real de cada ruta es la validación de la propia función.

## Orden de despliegue (importante)

1. `npm run db:push` — aplica `20261021000100_limite_check_field_unique.sql`.
2. `npm run functions:deploy` — despliega las funciones, incluida la nueva `analytics`.
3. Recién después, el frontend (Vercel).

El frontend **viejo funciona** con las funciones nuevas (se revisó en el código, con búsquedas, qué campos lee cada pantalla de lo que cambió). El frontend **nuevo no** funciona del todo con las funciones viejas: la pantalla de analíticas pediría `/analytics/summary` y el filtro de marcas quedaría vacío hasta que se desplieguen. De ahí el orden.

No hace falta ningún secret nuevo.

## Qué se cambió

### 1. Bugs y seguridad

| # | Problema | Cambio | Archivos |
| --- | --- | --- | --- |
| 1 | Un login correcto **borraba** los intentos fallidos de la IP: quien tuviera una cuenta propia podía alternar "4 intentos contra otra cuenta + 1 login propio" y probar contraseñas sin límite. | Un login correcto solo purga registros de más de un día. | `auth/index.ts` |
| 2 | La IP salía del **primer** valor de `X-Forwarded-For`, que controla el navegador: rotarlo evadía todos los límites por IP. Además una IP larga rompía el `INSERT` del intento (la columna es `VARCHAR(64)`) y el intento ni se registraba. | `CF-Connecting-IP`; si no está, el **último** valor de `X-Forwarded-For`; todo lo que no parezca una IP se agrupa como `desconocida`. | `_shared/turnstile.ts` |
| 3 | Una cuenta con usuario `ana@x.com` le quitaba el login por email a la cuenta cuyo email es exactamente ese (`limit 1` sin orden). | El email exacto gana; `username` se valida en el servidor. | `auth/index.ts`, `_shared/usuarios.ts` |
| 4 | Al fallar el registro de una foto, la limpieza **borraba de R2 la key aunque ya perteneciera a otra foto** (violación de unicidad). Quien conociera la key de otra persona (las URLs de las imágenes son públicas) le destruía el archivo. También se borraba el archivo propio al volver a registrar la misma key. | `discardUnregistered()`: solo borra keys que no están en `photo`. Si no puede verificar, no borra. | `photos/index.ts` |
| 5 | `GET /products`, `GET /products/category/:id` y `GET /categories` eran **públicos** y devolvían productos inactivos, stock, ventas y todo el historial de precios. | Solo Admin. Se verificó que ninguna pantalla de la tienda los usa. | `products/index.ts`, `categories/index.ts` |
| 6 | `/categories/tree` (sin `state`), `/categories/:id/children` y `/categories/search` devolvían categorías y **productos inactivos**. | Sin sesión de admin solo ven lo activo. | `categories/index.ts`, `_shared/auth.ts` |
| 7 | `check_field_unique` (API REST, clave pública) no tenía límite: el `validationLimiter` de 30/min del backend Express **no se migró**. Permite recorrer emails, usuarios, DNI y CUIT. | 30 consultas por minuto por IP dentro de la propia función (HTTP 429). Ver "Migración". | `migrations/20261021000100_*.sql` |
| 8 | El servidor aceptaba contraseñas de 6 caracteres y cualquier `username`, aunque el formulario exige 8 con letra y número. | Mismas reglas en el servidor (alta y edición). Una cuenta heredada puede seguir editándose si no cambia su usuario. | `_shared/usuarios.ts` |
| 9 | Percent-encoding inválido en la URL → 500; JSON mal formado → se tomaba como `{}`; `/products/12abc` se leía como `12`. | 400 con mensaje claro. | `_shared/http.ts` |
| 10 | Sin tope de líneas por orden: `create_order` bloquea una fila por línea. | Máximo 100. | `orders/index.ts` |
| 11 | `AuthService` guardaba en `localStorage` el perfil completo (DNI, CUIT, domicilio e historial de órdenes) porque TypeScript acepta el objeto por tipado estructural. | Solo `id`, `name`, `lastName`, `role`, `photo`. Al arrancar limpia lo que guardaron versiones anteriores. | `auth.service.ts` |
| 12 | `client.phone.replace(...)` rompía el detalle de una orden si el cliente no tiene teléfono (el esquema lo permite; el registro rápido y Google no lo piden). | Se tolera `null`; muestra "Sin teléfono". El tipo pasa a `string \| null`. | `order-detail-modal`, `order.model.ts` |

### 2. Overfetching y underfetching

| Dónde | Antes | Ahora |
| --- | --- | --- |
| `GET /categories/active` (home) | Cargaba **todos** los productos activos con todas sus fotos y precios, y la home leía solo `id` y `name` de 5 categorías. | Sin productos. |
| `GET /categories/:id` (página de categoría) | Todos los productos de la categoría; la página solo usa nombre, estado y padres. | Solo la categoría con sus padres. |
| `GET /categories` (admin) | Producto completo de todo el catálogo para contar y mostrar nombre y miniatura. | `{ id, name, photos[0] }`. |
| Productos (todas las listas) | Historial completo de precios por producto; ninguna pantalla lo usa y crece con cada cambio masivo. | Solo el precio vigente. |
| Órdenes | Fila completa del cliente (DNI, CUIT, domicilio), producto completo y todas las fotos. | Cliente: `id`, `name`, `lastName`, `email`, `phone`. Producto: `id`, `name`, `brand`, primera foto. |
| `GET /clients/:id`, `/clients/account/:id` | Incluían **todas** las órdenes sin paginar; nadie las lee (se piden aparte y paginadas). | Sin `orders`. |
| Usuarios | `select *` y `returning *`. | Columnas explícitas (sin `supabase_uid`). |
| Analíticas (admin) | 3 listados de 100 filas con joins para contar, sumar y quedarse con 5. **Los totales salían mal** con más de 100 registros (contadores topeados en 100; ingresos de solo las últimas 100 órdenes). | Una función (`GET /analytics/summary`) que los calcula en la base. |
| Filtro de marcas (categoría y búsqueda) | Se armaba con los 16 productos de la página visible: ofrecía marcas incompletas. | El servidor informa todas las marcas del resultado (`brands`), sin achicar la lista al elegir una. |
| Página de perfil | Pedía `/orders/client/:id` dos veces al cargar. | Una; el refresco tras cancelar un pedido se conserva. |
| `paginateProducts` | Página y total en serie. | En paralelo. |

**Por qué no se creó ninguna vista ni RPC nueva.** La consulta directa alcanza: el frontend no puede consultar tablas (solo habla con las Edge Functions) y los agregados de analíticas son un `count`, un `sum` y dos top 5, que la función resuelve con SQL directo como el resto de las lecturas. La única función SQL tocada es `check_field_unique`, porque es la que el navegador llama directo y no hay otra capa donde limitarla.

### 3. Errores, estados y validaciones

- Analíticas: estados de carga (`—` y "Cargando…"), error con "Reintentar" y vacío. Antes mostraba ceros mientras cargaba o si fallaba.
- Tipos alineados con las respuestas reales: `IProductSummary`, `IBulkPricePreviewItem`, `IBulkPriceResult`, `IPaginatedProducts`, `IAnalyticsSummary`. Desaparecen varios `any`.

### 4. SOLID y duplicación

- Alta y edición de producto repetían las mismas reglas (precio, stock, ventas, moneda, estado): ahora hay una sola `validateProductFields()`.
- `loadOrders` salió de `orders` a `_shared/pedidos.ts` porque ahora lo comparten `orders` y `analytics`.
- La política de contraseña estaba duplicada entre `auth` y `usuarios`: una sola `assertValidPassword()`.
- `loadFirstPhotos()` reemplaza tres formas distintas de traer fotos para una miniatura.

## Migración `20261021000100_limite_check_field_unique.sql`

Crea la tabla `rate_limit_event` y reemplaza `check_field_unique` (misma firma y mismo resultado). Es idempotente. **No se aplicó**: corre con `npm run db:push`.

**Rollback.** Volver a crear `check_field_unique` con el cuerpo de `20261012000300_funciones_rpc.sql` (la versión `STABLE`, sin límite) y `DROP TABLE IF EXISTS rate_limit_event;`.

**Matriz de permisos de la tabla nueva**

| Actor | Operación | Tabla | Condición | Resultado |
| --- | --- | --- | --- | --- |
| `anon` / `authenticated` | SELECT, INSERT, UPDATE, DELETE | `rate_limit_event` | RLS activo sin políticas y sin `GRANT` | **Denegado** |
| `service_role` | todas | `rate_limit_event` | omite RLS; hereda el `GRANT` por defecto | Permitido (hoy no la usa) |
| `check_field_unique` (`SECURITY DEFINER`) | INSERT, SELECT, DELETE | `rate_limit_event` | corre con los permisos de su dueño | Permitido |

Sin cambios en el resto: `anon` y `authenticated` siguen pudiendo ejecutar `check_field_unique` (la necesita el registro) y siguen **sin** poder ejecutar `create_order` ni `cancel_order`.

## Revisión de RLS (sin cambios)

No se modificó ninguna política. Las existentes son de solo lectura:

| Tabla | Operación | Quién | Condición |
| --- | --- | --- | --- |
| `product`, `category` | SELECT | todos | `state = 'Activo'` o admin |
| `price` | SELECT | todos | `is_current` o admin |
| `photo` | SELECT | todos | siempre (los archivos ya son públicos en R2) |
| `user` | SELECT | titular / admin | `supabase_uid = auth.uid()` o admin |
| `order`, `order_line` | SELECT | dueño / admin | `client_id = current_user_id()` o admin |
| `price_change_batch`, `audit_log` | SELECT | admin | `is_admin()` |
| `login_attempt`, `password_reset_*`, `rate_limit_event` | — | nadie | RLS sin políticas |

Ninguna tabla tiene política de escritura: toda escritura pasa por las Edge Functions.

Según el comentario de `20261019000100_permisos_service_role.sql`, `anon` y `authenticated` no tienen `GRANT` sobre las tablas, así que estas políticas hoy no son alcanzables por la API REST (son la segunda barrera si algún día se concede). **Conviene confirmarlo**, porque es lo que sostiene esa afirmación:

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');
-- esperado: ninguna fila
```

`product.deleted_at` y `category.deleted_at` **no** marcan borrado lógico: guardan la fecha del último cambio de estado (también al reactivar). Por eso las políticas no deben usarlas para filtrar.

## Contratos que cambiaron (puntos de ruptura)

Ninguno afecta al frontend actual. Solo importa si hay otro consumidor de la API:

- `GET /products`, `GET /products/category/:id`, `GET /categories`: ahora exigen sesión de administrador (401/403).
- `GET /categories/active` y `GET /categories/:id`: ya no traen `products`.
- `GET /categories`: `products[]` es `{ id, name, photos[] }`.
- Productos: `prices[]` trae solo el precio vigente.
- Órdenes: `client` y `items[].product` con menos campos (los que declara `IApiOrder`).
- `GET /clients/:id` y `/clients/account/:id`: sin `orders`.
- `GET /products/search` y `/products/active/category/:id`: suman `brands`.
- Nuevo `GET /analytics/summary` (admin).
- Altas y ediciones de usuarios: validan `username` y contraseña (400).

## Cómo verificar

**Los pasos 1, 2, 3, 4 y 6 daban otro resultado antes del cambio** (sirve para comparar contra producción actual).

1. **Límite de login.** Con un usuario real, 6 intentos con contraseña mala contra `POST /functions/v1/auth/login`: cinco `401` y el sexto `429`. Repetir intercalando un login correcto: el sexto fallo sigue siendo `429`. Repetir mandando un `X-Forwarded-For` distinto en cada intento: debe seguir llegando el `429`.
   Si **todos** los usuarios recibieran `429` enseguida, la IP detectada sería la de un proxy compartido (Supabase no documenta qué hace con estos headers en las Edge Functions): avisar y se ajusta `getClientIp`.
2. **Listados privados.** `curl https://<ref>.supabase.co/functions/v1/products` sin sesión: `401`. Con la sesión del admin: `200`.
3. **Límite de validaciones.** `POST /rest/v1/rpc/check_field_unique` (con la `apikey`) 31 veces seguidas: la 31 devuelve `429`. Los formularios siguen funcionando.
4. **Analíticas.** Abrir `/admin/analytics`: una sola petición (`analytics/summary`). Comparar con `select count(*) from "order"`, `select sum(total_amount) from "order" where status in ('Pagado','Enviado','Entregado')`, `select count(*) from "user" where role = 'Client'`.
5. **Home.** En la pestaña Network, `GET /categories/active` pesa unos pocos KB y no trae `products`.
6. **Fotos.** Registrar para otro usuario una key que ya tiene una foto: `409` y el archivo sigue en R2.
7. **Filtro de marcas.** En una categoría con más de 16 productos de varias marcas, el filtro ofrece todas las marcas.
8. **Navegador.** En `localStorage`, la clave `auth_user` tiene solo `id`, `name`, `lastName`, `role` y `photo`.
9. **Detalle de orden** de un cliente sin teléfono (admin): se abre y muestra "Sin teléfono".

## Pruebas automatizadas

**Frontend (Vitest):** `cd fe && npx ng test --no-watch` → 7 archivos, 30 tests. Se agregaron specs de `AuthService`, modal de detalle de orden, analíticas, perfil, categoría y búsqueda.

**Edge Functions:** el proyecto no tiene suite. Se verificó con un banco de pruebas temporal (fuera del repo): PGlite aplicando las migraciones **reales**, el cliente real `postgres.js` y dobles de Supabase Auth y R2 → 61 tests en verde. Además, `tsc --strict` sobre las funciones. El banco **no** puede comprobar: que PostgREST traduzca el SQLSTATE `PT429` a HTTP 429, ni los headers reales de Supabase. Eso se confirma con los pasos 1 y 3.

## Detectado y no implementado

Orden aproximado de importancia. Ninguno se tocó porque cambia reglas de negocio, necesita infraestructura o no se puede probar sin ella.

1. **Registro sin verificar el email (alto).** `createUser` usa `email_confirm: true`. Cualquiera puede registrar el email de otra persona; si la víctima entra después con Google, la vinculación automática de identidades de Supabase (por email verificado) debería unir esa identidad a la cuenta ya creada, y el atacante conservaría su contraseña ("pre-hijacking"). No se probó contra un Supabase real: conviene confirmarlo. Propuesta: confirmar el email (Resend ya está configurado) antes de activar la cuenta. Decisión de producto.
2. **Cambiar contraseña o email sin la contraseña actual (medio).** `PATCH /clients/:id` lo acepta solo con sesión; `verify-password` es una comprobación del frontend. Un token robado (XSS) alcanza para quedarse con la cuenta. Propuesta: exigir `currentPassword` en el servidor al titular.
3. **Trigger `handle_new_auth_user`.** Vincula por email un perfil que no tiene cuenta asociada (por ejemplo, el de una cuenta de Auth borrada o el de un seed) con `ON CONFLICT … DO UPDATE SET supabase_uid`, sin mirar `email_confirmed_at`. Si en el panel está desactivado "Confirm email", quien se registre con ese email directo contra `/auth/v1/signup` se queda con ese perfil (y su rol). **Verificar que "Confirm email" esté activado.** Propuesta: vincular solo si `NEW.email_confirmed_at IS NOT NULL`. No se tocó: es el trigger de todas las altas (incluido Google) y no se puede probar contra GoTrue real.
4. **Turnstile.** Vacío = sin verificación (documentado en el README). En producción conviene fallar cerrado si falta la secret. El registro público no tiene Turnstile ni límite por IP.
5. **Cabecera `Content-Security-Policy`.** Falta en `fe/vercel.json`. La sesión de Supabase vive en `localStorage`, así que un XSS la expone. Propuesta: empezar con `Content-Security-Policy-Report-Only` (Turnstile, R2, Supabase, SweetAlert2 necesitan excepciones).
6. **Carrito.** Guarda copias completas de cada producto en `localStorage`: el total que ve la persona usa precios viejos y el stock o el estado se descubren al confirmar. Propuesta: `GET /products/by-ids` y revalidar al abrir el carrito (hay que decidir qué hacer si cambió un precio).
7. **R2.** La URL prefirmada no limita el tamaño de lo que se sube (el límite se aplica al registrar) y los archivos que no se registran quedan huérfanos. Propuesta: firmar `Content-Length` y una regla de ciclo de vida.
8. **`trimStrings` altera las contraseñas** (recorta y colapsa espacios). Ya lo hacía el backend Express. Corregirlo bloquearía a quien tenga una contraseña con espacios dobles; requiere un reintento con el valor normalizado.
9. **`create_order` suma importes sin convertir monedas** (ARS/USD/EUR). Hoy sirve porque todo está en ARS.
10. **Funciones `SECURITY DEFINER`** con `search_path = public`: agregar `pg_temp` es la práctica recomendada (no es explotable hoy).
11. **Búsquedas `ILIKE '%…%'`** no usan índice. Cuando el catálogo crezca: índice `pg_trgm`.
12. **`GET /bulk-prices/history`** sin paginar; `getAuthUser` consulta a Supabase Auth en cada petición (se mantiene a propósito: así una sesión cerrada deja de servir enseguida; `getClaims` no lo garantiza).
13. **Orden de validaciones en órdenes/fotos:** a una persona sin sesión se le responde 404 o 401 según exista el recurso (los IDs son secuenciales, riesgo bajo).
14. **`be/`** sigue en el repositorio (ver el README).
