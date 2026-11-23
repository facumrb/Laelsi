# Cierre de la revisión de seguridad, aceptación con Google y datos de despliegue definitivos

Fecha: 2026-10-21 (noche, hora argentina) · Rama: `main` · Estado: **sin commit y sin `ng build`**. Nada aplicado en producción.

Esta entrega hace tres cosas: deja constancia de la aceptación de los Términos también para quien entra con Google, implementa los pendientes de código de [revision-seguridad-y-datos-2026-10-21.md](revision-seguridad-y-datos-2026-10-21.md) que tenían una propuesta concreta, y analiza qué hay que cambiar para que todo coincida con los datos de despliegue definitivos.

## 1. Orden de despliegue (importante)

1. `npm run db:push` — aplica `20261022000100_aceptacion_terminos_y_arrepentimiento.sql` (si todavía no se aplicó) y `20261022000200_endurecer_funciones_sql.sql`. Las funciones nuevas leen columnas que crean estas migraciones, así que tiene que ir **primero**.
2. En `supabase/functions/.env`: agregar `REVOCATION_NOTIFY_EMAIL` y revisar `ALLOWED_ORIGINS` (ver sección 5). Después `npm run functions:secrets`.
3. `npm run functions:deploy` — despliega las **12** funciones del repo (el archivo de datos lista 10: faltan `analytics` y `revocations`).
4. Frontend en Vercel, **enseguida** después del paso 3.

Entre los pasos 3 y 4 el frontend viejo no funciona del todo con las funciones nuevas: el registro responde 403 (no manda el token de Turnstile) y cambiar el email o la contraseña propios responde 400 (no manda la contraseña actual). El orden inverso (frontend primero) rompe menos, pero la pantalla de aceptación para Google necesita las funciones nuevas. Hacé 3 y 4 seguidos.

**`LEGAL_VERSION` pasó a `2026-10-22`** porque los textos legales cambiaron de fondo (aceptación con Google). Las aceptaciones guardadas con `2026-10-21` corresponden a la versión anterior de los textos.

## 2. Qué se implementó

### Constancia de aceptación con Google

La cuenta de Google se crea al volver de Google, sin casilla. Ahora:

- `getSessionUser` informa `termsAccepted` y el frontend lo guarda en la sesión.
- Si una cuenta de **cliente** tiene `termsAccepted = false` (cuentas de Google y cuentas anteriores a la casilla), el layout de la tienda muestra un diálogo bloqueante con una casilla explícita ([terms-gate](../../fe/src/app/pages/client/components/terms-gate/terms-gate.component.ts)).
- Al aceptar, `POST /auth/accept-terms` guarda `terms_accepted_at` y `terms_version`. Si ya aceptó esa versión no se toca nada: la fecha que vale es la de la primera aceptación. Las cuentas de administración no pasan por acá.
- Las sesiones guardadas por una versión anterior (sin ese dato) se completan solas desde `/auth/me`, sin cerrar la sesión si falla.
- Se actualizaron el aviso del login, los Términos y la Política de Privacidad.

### Pendientes del documento de revisión

| # | Qué | Dónde |
| --- | --- | --- |
| 2 | Cambiar el **email o la contraseña de la propia cuenta exige la contraseña actual**, verificada en el servidor. No la necesita un administrador que edita a otra persona ni una cuenta de solo Google. Los intentos fallidos cuentan para el límite de login, que ahora también protege `verify-password` | `_shared/contrasenas.ts`, `_shared/usuarios.ts`, `clients`, `admins`; en el frontend `CurrentPasswordService` y los cuatro formularios que cambian email o contraseña |
| 3 | El trigger `handle_new_auth_user` solo vincula un perfil existente si el email de la cuenta nueva está confirmado **y** el perfil no tiene ya otra cuenta | migración `20261022000200` |
| 4 | Turnstile **falla cerrado** en producción si falta la secret (solo se omite en el stack local, `http://`). El registro público ahora lleva Turnstile y un tope de 10 registros por hora por IP | `_shared/turnstile.ts`, `_shared/limites.ts`, `auth/index.ts`, `register-page` |
| 5 | Cabecera `Content-Security-Policy-Report-Only` con los orígenes reales (Supabase, imágenes de R2, endpoint S3 de R2, Turnstile) | `fe/vercel.json` |
| 8 | Las contraseñas **no se recortan** ni se les colapsan los espacios. Las cuentas anteriores se guardaron normalizadas, así que el login prueba primero lo escrito y después la versión normalizada | `_shared/http.ts`, `_shared/contrasenas.ts` |
| 9 | `create_order` rechaza un producto con el precio fuera de ARS | migración `20261022000200` |
| 10 | Todas las funciones `SECURITY DEFINER` fijan `search_path = public, pg_temp` | migración `20261022000200` |
| 13 | Una orden o una foto **ajena** responde 404, igual que una inexistente; sin sesión siempre es 401 | `_shared/auth.ts` (`requireOwnerOrAdminOf`), `orders`, `photos` |

## 3. Qué NO se implementó, y por qué

| # | Qué | Motivo |
| --- | --- | --- |
| 1 | Confirmar el email antes de activar la cuenta | El propio documento lo marca como **decisión de producto**: agrega un paso (revisar el correo) antes de poder comprar, y requiere pantallas, un enlace de confirmación y reenvío. Necesito que me digas si lo querés |
| 6 | Revalidar el carrito contra el servidor | Hay que decidir qué hacer cuando cambió un precio: ¿se actualiza solo y se avisa, o se pide confirmar? Es una regla de negocio |
| 7 | Firmar el `Content-Length` de la subida a R2 | **No es viable** con una URL prefirmada: la librería de firma (`aws4fetch`) trata `content-length` como encabezado no firmable, y R2 no soporta políticas de subida con rango de tamaño. El tamaño ya se verifica al registrar la foto. La regla de ciclo de vida para huérfanos es configuración de la consola de R2 (ver sección 5) |
| 11 | Índices `pg_trgm` para las búsquedas | El documento dice "cuando el catálogo crezca". Hoy no hace falta |
| 12 | Paginar `GET /bulk-prices/history` | Requiere cambiar la pantalla del historial; sin riesgo al volumen actual |
| 14 | Quitar `be/` | Decisión tuya (el README explica cuándo y cómo) |

## 4. Verificación

**Hecha:**

- `cd fe && npx ng test --no-watch` → 14 archivos, **103 tests en verde**, sin errores no manejados. `npx tsc -p fe/tsconfig.app.json --noEmit` → sin errores.
- Servidor de desarrollo: `/privacidad` y `/terminos` se renderizan en el servidor con el texto nuevo; `/` sigue siendo el shell vacío de la SPA.
- Las dos migraciones aplicadas **en orden, todas las reales**, sobre Postgres (PGlite): idempotentes, el trigger rechaza vincular un email sin confirmar (y se comprobó que **antes sí lo hacía**), `create_order` rechaza USD sin dejar rastros, el `search_path` quedó en las 6 funciones y los permisos se conservaron.
- Lógica de las funciones ejecutando el código real con dobles de base, Supabase, Turnstile y Resend: contraseñas, límites, `updateUser`, `register`, `accept-terms`, `login`, `verify-password`, `requireOwnerOrAdminOf` y `revocations`.

**Pendiente de verificar (no se pudo):**

- `ng build` de producción (la regla del proyecto es no buildear) y por lo tanto el pre-renderizado real. Corré `cd fe && npx ng build` antes de deployar.
- Los formularios de administrador (`edit-profile-page`, `admins-form`) y `profile-details` no tienen tests de componente: se verificaron por tipos y por la lógica del servidor. Probalos a mano: cambiar el email propio tiene que pedir la contraseña actual.
- El envío real de correos, el widget de Turnstile y el login real con Google.
- La cabecera CSP, que solo se ve en el navegador (consola) una vez desplegado.

## 5. Datos de despliegue definitivos: qué cambiar

### Cómo se analizó el archivo

`docs/Datos de despliegue.md` mezcla datos públicos con claves reales, así que **no se leyó**: se lo pasó por un filtro de lista blanca que solo deja ver palabras sueltas y dominios, y reemplaza todo lo demás (claves, hashes, IDs) por su longitud. Los datos públicos se compararon con el repo con comprobaciones que imprimen solo "coincide / no coincide". El archivo está en `.gitignore`, no está trackeado y nunca estuvo en el historial.

### Lo que ya coincide con el repo (no hay que tocar código)

- La site key de Turnstile de `environment.ts` y `environment.development.ts`.
- El proyecto de Supabase del callback de Google y el de los dos `environment`.
- Los dominios de imágenes (`productos.` y `usuarios.laelsi.com.ar`) en los dos `environment`, en `ngsw-config.json` y en la CSP.
- El dominio remitente de Resend (`noresponder.laelsi.com.ar`) y el formato `Laelsi <no-reply@...>`.
- Las 11 secrets del archivo son **exactamente** las que lee el código, más una: `REVOCATION_NOTIFY_EMAIL`.

### Lo que hay que cambiar

El dominio principal definitivo es `https://laelsi.com.ar` (sin `www`). **Hoy está al revés**: `laelsi.com.ar` responde `308` hacia `www.laelsi.com.ar` (verificado dos veces).

| Dónde | Qué cargar o cambiar |
| --- | --- |
| **Vercel** → Settings → Domains | `laelsi.com.ar` como dominio principal, sin redirección. `www.laelsi.com.ar` con "Redirect to laelsi.com.ar". Comprobá con `curl.exe -I https://laelsi.com.ar/privacidad` (200 directo) y `curl.exe -I https://www.laelsi.com.ar/privacidad` (308 hacia el principal). Opcional: quitar `laelsi.vercel.app` como dominio de producción |
| **Secrets** (`supabase/functions/.env` y `npm run functions:secrets`) | `SITE_URL=https://laelsi.com.ar` · `ALLOWED_ORIGINS=https://laelsi.com.ar,https://www.laelsi.com.ar` · `RESEND_FROM="Laelsi <no-reply@noresponder.laelsi.com.ar>"` · `REVOCATION_NOTIFY_EMAIL=` la casilla de la librería (puede ser la misma de `contactEmail`). `www` va en `ALLOWED_ORIGINS` aunque redirija: es inofensivo y evita un corte de CORS mientras la redirección no esté bien |
| **Supabase** → Authentication → URL Configuration | Site URL `https://laelsi.com.ar`. Redirect URLs: `https://laelsi.com.ar/**`, `https://www.laelsi.com.ar/**` y `http://localhost:4200/**`. Sin esto el login con Google vuelve con error |
| **Supabase** → Authentication → Providers | Google habilitado, con el callback `https://<proyecto>.supabase.co/auth/v1/callback`, que ya coincide. Confirmá que **"Confirm email" esté activado** |
| **Google Cloud** → Google Auth Platform | _Branding_: página principal `https://laelsi.com.ar`, privacidad `https://laelsi.com.ar/privacidad`, términos `https://laelsi.com.ar/terminos`, dominio autorizado `laelsi.com.ar`. _Clientes_: orígenes de JavaScript `https://laelsi.com.ar` y `https://www.laelsi.com.ar`; redirect URI solo la de Supabase. _Público_: publicar la app. Dominio verificado en Search Console |
| **Cloudflare R2** (los dos buckets) → CORS | `AllowedOrigins`: `https://laelsi.com.ar`, `https://www.laelsi.com.ar`, `http://localhost:4200`; métodos `PUT`; encabezados `content-type` y `cache-control`. Opcional: una regla de ciclo de vida que aborte las subidas multiparte incompletas |
| **Cloudflare Turnstile** | Hostnames: `laelsi.com.ar`, `www.laelsi.com.ar` y `localhost` |
| **Resend** | Dominio `noresponder.laelsi.com.ar` en estado _Verified_. La API key conviene que tenga permiso solo de _Sending access_ y limitada a ese dominio |
| **Repo** | Nada de código: `LEGAL_INFO.siteUrl`, los `environment` y el service worker ya usan los valores definitivos. Se corrigió el README, que recomendaba `www` |

**Una decisión de seguridad que queda abierta:** `isAllowedOrigin` en `_shared/http.ts` acepta cualquier `*.vercel.app` para que anden los previews. Con `laelsi.vercel.app` retirado y el dominio propio funcionando, conviene hacer ese comodín opcional (por ejemplo, con una variable `ALLOW_VERCEL_PREVIEWS`). No lo cambié porque rompería los previews sin que lo hayas pedido.

### Las claves: qué hacer en lugar de pasármelas

No necesito ningún valor secreto, y no conviene que pasen por un chat. Para cada una:

| Valor | Dónde va |
| --- | --- |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PRODUCTS`, `R2_BUCKET_USERS`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` | Solo en `supabase/functions/.env` (ignorado por git) y de ahí a Supabase con `npm run functions:secrets`. **Nunca** en el frontend ni en Vercel |
| Site key de Turnstile, URLs de R2, URL de Supabase | Ya están en `fe/src/environments/*` (son públicos por diseño) |

Para comprobar que los secrets quedaron bien cargados **sin mostrar valores**: `npx supabase secrets list` muestra el nombre y un resumen (_digest_) de cada uno, no el valor. Tienen que estar los 12 nombres. Después, una prueba de humo: recuperar una contraseña (llega el correo → Resend), subir una foto (R2) y confirmar un pedido (Turnstile).

Dos recomendaciones de higiene:

1. **Separá ese archivo en dos.** Uno público (dominios, endpoints, lista de funciones y de secrets) que se pueda leer y versionar sin riesgo, y uno privado con las claves, **fuera de la carpeta del repo**. Así cualquier análisis futuro se puede hacer sobre el público sin filtros.
2. Si esa carpeta se sincroniza con un servicio en la nube (OneDrive, Drive, Dropbox) o el archivo se compartió alguna vez, rotá la API key de Resend, las credenciales de R2 y la secret de Turnstile. Ya hubo un token `cfat_` en texto plano en un documento anterior.

También actualizá la lista de funciones de ese archivo: agregá `analytics` y `revocations`.
