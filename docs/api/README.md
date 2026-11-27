# Documentación de la API

[Volver a la documentación](../README.md)

La especificación completa está en [openapi.yaml](openapi.yaml) (OpenAPI 3.1). Se puede ver de dos maneras:

- abrir [editor.swagger.io](https://editor.swagger.io) y pegar el contenido del archivo (o usar *File → Import file*);
- en VS Code, con una extensión de OpenAPI o de Swagger Viewer.

## Datos generales

| | |
| :-- | :-- |
| Estilo | REST con JSON |
| URL base (producción) | `https://vwtqkglkenogylkranzz.supabase.co/functions/v1` |
| URL base (local) | `http://127.0.0.1:54321/functions/v1` |
| Implementación | Una Edge Function de Supabase por recurso: `supabase/functions/<recurso>/index.ts` |
| Autenticación | `Authorization: Bearer <access token de Supabase Auth>` |
| Anti-bots | `X-Turnstile-Token: <token de Cloudflare Turnstile>` en registro, recuperación de contraseña, compra y arrepentimiento |

### Formato de las respuestas

Si sale bien:

```json
{ "statusCode": 200, "message": "Categoría encontrada", "data": { "id": 1, "name": "Librería" }, "status": "success" }
```

Los listados paginados traen en `data` el objeto `{ data: [...], total, page, limit, totalPages }`. Por defecto `limit` vale 16 y como máximo 100.

Si hay un error:

```json
{ "status": "error", "message": "El Nombre de la categoría es requerido" }
```

### Niveles de acceso

| Rol | Quién | Cómo se valida (`supabase/functions/_shared/auth.ts`) |
| :-- | :-- | :-- |
| Público | Cualquiera, sin token | — |
| Usuario | Cualquier sesión válida (Admin o Client) | `requireUser` |
| Dueño o Admin | El dueño del recurso (su cuenta, sus pedidos) o un Admin | `requireOwnerOrAdmin`, `requireOwnerOrAdminOf` |
| Admin | Solo administradores activos | `requireAdmin` |

### Códigos de error

| Código | Cuándo |
| :-- | :-- |
| 400 | Datos inválidos: validaciones de cada ruta, o errores de la base `22P02`, `22003`, `23514`, `22001` y `LE400` |
| 401 | Falta el token, no es válido o las credenciales son incorrectas |
| 403 | El rol no alcanza o la cuenta está inactiva |
| 404 | No existe el recurso o la ruta (`LE404` de las funciones SQL) |
| 409 | Dato único repetido (`23505`) o registro con datos asociados (`23503`) |
| 429 | Demasiados intentos desde la misma IP (login, registro, recuperación, arrepentimiento) |
| 500 | Error inesperado. No se envían detalles al cliente |

El manejo central de errores está en `errorToResponse` (`supabase/functions/_shared/http.ts`).

## Endpoints

| Recurso | Método y ruta | Rol |
| :-- | :-- | :-- |
| **auth** | `POST /auth/login` | Público |
| | `POST /auth/register` | Público (Turnstile) |
| | `GET /auth/me` | Usuario |
| | `POST /auth/accept-terms` | Usuario |
| | `POST /auth/verify-password` | Usuario |
| | `POST /auth/forgot-password` | Público (Turnstile) |
| | `POST /auth/reset-password/validate` | Público |
| | `POST /auth/reset-password` | Público |
| **categories** | `GET /categories/search?query=` | Público |
| | `GET /categories/active` | Público |
| | `GET /categories/tree` | Público |
| | `GET /categories/:id/children` | Público |
| | `GET /categories/:id` | Público |
| | `GET /categories` | Admin |
| | `POST /categories` | Admin |
| | `PATCH /categories/reorder` | Admin |
| | `PATCH /categories/:id` | Admin |
| | `DELETE /categories/:id` | Admin |
| **products** | `GET /products/active`, `GET /products/page` | Público |
| | `GET /products/search?query=` | Público |
| | `GET /products/best-sellers` | Público |
| | `GET /products/best-sellers/category/:categoryId` | Público |
| | `GET /products/active/category/:categoryId?brand=&priceOrder=&popularityOrder=` | Público |
| | `GET /products/active/:id` | Público |
| | `GET /products/availability?ids=1,2,3` | Público |
| | `GET /products/home` | Público |
| | `GET /products/:id` | Público |
| | `GET /products` | Admin |
| | `GET /products/category/:categoryId` | Admin |
| | `POST /products` | Admin |
| | `PATCH /products/:id` | Admin |
| | `DELETE /products/:id` | Admin |
| **bulk-prices** | `POST /bulk-prices/preview` | Admin |
| | `POST /bulk-prices/apply` | Admin |
| | `POST /bulk-prices/rollback/:batchId` | Admin |
| | `GET /bulk-prices/history` | Admin |
| **photos** | `POST /photos/productPhotos/:productId` | Admin |
| | `POST /photos/reorder` | Admin |
| | `DELETE /photos/productPhotos/:photoId` | Admin |
| | `POST /photos/userPhoto/:userId` | Dueño o Admin |
| | `DELETE /photos/userPhoto/:photoId` | Dueño o Admin |
| **uploads** | `POST /get-upload-url` | Admin (`product`), Dueño o Admin (`user`) |
| | `POST /delete-r2-object` | Admin |
| **clients** | `GET /clients` | Admin |
| | `GET /clients/search?query=` | Admin |
| | `GET /clients/account/:id` | Dueño o Admin |
| | `GET /clients/:id` | Admin |
| | `POST /clients` | Admin |
| | `PATCH /clients/:id` | Dueño o Admin |
| | `PATCH /clients/:id/state` | Admin |
| | `DELETE /clients/:id` (desactiva) | Admin |
| **admins** | `GET /admins`, `GET /admins/search`, `GET /admins/account/:id`, `GET /admins/:id` | Admin |
| | `POST /admins`, `PATCH /admins/:id`, `PATCH /admins/:id/state`, `DELETE /admins/:id` (desactiva) | Admin |
| **orders** | `POST /orders` | Usuario (Turnstile) |
| | `GET /orders/client/:clientId` | Dueño o Admin |
| | `GET /orders/:id` | Dueño o Admin |
| | `PATCH /orders/:id/cancel` | Dueño o Admin |
| | `GET /orders?status=&deliveryMethod=&paymentMethod=&query=` | Admin |
| | `PATCH /orders/:id/status` | Admin |
| | `PATCH /orders/:id/delivery-method` | Admin |
| **analytics** | `GET /analytics/summary` | Admin |
| **revocations** | `POST /revocations` | Público (Turnstile) |

El login con Google y la renovación de tokens no pasan por esta API: los maneja el cliente de Supabase Auth en el navegador.

## Cómo mantenerla al día

Las rutas salen de la tabla `routes` al final de cada `supabase/functions/<recurso>/index.ts`. Si se agrega, se quita o cambia de rol una ruta, hay que actualizar `openapi.yaml` y esta tabla.
