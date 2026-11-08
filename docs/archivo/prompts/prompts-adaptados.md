# Prompts Adaptados – Proyecto Laelsi

> **Stack del proyecto**
>
> - **Backend:** Express 4 + TypeScript + MikroORM 6 + MySQL, estructura por carpetas de entidad (`be/src/{entity}/`)
> - **Frontend:** Angular 21 + Tailwind CSS 4 + Signals + Zoneless (`provideZonelessChangeDetection`), estructura `fe/src/app/`
> - **Entidades existentes:** `Category`, `Product` (con `Price`, `PriceChangeBatch`), `User` (STI → `Admin`, `Client`), `Order` (con `OrderLine`), `ProductPhoto`, `UserPhoto`
> - **Archivos clave:** `fe/src/app/shared/form-utils.ts`, `be/src/shared/validation/validation.controller.ts`, `be/src/shared/db/customBaseEntity.entity.ts`, `be/src/shared/utils/apiResponse.ts`
> - **Base entity heredada:** `CustomBaseEntity` (id, createdAt, updatedAt, deletedAt)
> - **Formato de respuesta API:** `ApiResponse { statusCode, message, data, status }`

---

## Prompt 1 – Subcategorías: jerarquía en Category

### 1A · Backend – Modelo de datos y API

En el proyecto Laelsi (`be/src/category/`), extender la entidad `Category` (`category.entity.ts`) para soportar **subcategorías jerárquicas** (self-referencing):

1. **Modelo de datos (MikroORM):**
   - Agregar una propiedad `@ManyToOne(() => Category, { nullable: true })` llamada `parent` con `nullable: true` (categoría raíz = sin padre).
   - Agregar `@OneToMany(() => Category, (cat) => cat.parent)` llamada `children` (Collection).
   - Agregar `@Property({ default: 0 })` llamada `depth` para control de profundidad (máximo sugerido: 3 niveles).
   - Asegurar que MikroORM genere un índice en la columna `parent_id` para rendimiento.
   - Las categorías existentes en la DB actual deben quedar con `parent = null` (categorías raíz) sin perder datos.

2. **Validaciones en el controlador** (`category.controller.ts`):
   - En `add` y `update`: validar que asignar un padre no cree ciclos (una categoría no puede ser padre de sí misma, ni de un ancestro suyo).
   - Validar profundidad máxima (ej: 3 niveles) y lanzar `AppError` con código 400 si se excede.
   - En `remove`: si la categoría tiene subcategorías, lanzar `AppError` indicando que debe reasignarlas o eliminarlas primero (misma lógica que el check de productos existente).

3. **Endpoints REST** (en `category.routes.ts`):
   - `GET /api/categories` → devolver todas las categorías con `populate: ['children', 'products.photos']`, opcionalmente como árbol anidado.
   - `GET /api/categories/tree` → **nuevo endpoint** que devuelva la estructura en forma de árbol (categorías raíz con `children` recursivos). Soportar query param `?depth=N` para limitar niveles a poblar. Soportar `?state=Activo` para filtrar solo categorías activas.
   - `GET /api/categories/:id/children` → **nuevo** para obtener hijos directos de una categoría.
   - Mantener el endpoint existente `findAllActive` pero adaptarlo para respetar la jerarquía.

4. **Rendimiento:**
   - Evitar consultas N+1 usando `populate` adecuado o `QueryBuilder` con joins.
   - Usar `orderBy: { parent: 'ASC', order: 'ASC', name: 'ASC' }` para consistencia.

5. **Modelo Frontend** (`fe/src/app/models/category.model.ts`):
   - Agregar `parentId?: number | null`, `parent?: IApiCategory | null`, `children?: IApiCategory[]`, `depth?: number` a `IApiCategory`.
   - Agregar `parentId?: number | null` a `ICreateCategory` y `IUpdateCategory`.

### 1B · Frontend – UI de gestión y navegación jerárquica

En el panel admin (`fe/src/app/pages/admin/pages/categories-page/`):

1. **Panel Admin – Gestión de jerarquía:**
   - En el formulario de crear/editar categoría, agregar un `<select>` o autocomplete para seleccionar la categoría padre (opcional). Mostrar categorías elegibles (excluyendo la propia y sus descendientes al editar).
   - En el listado de categorías, mostrar jerarquía visualmente: indentación por nivel, o lista expandible/colapsable (acordeón). Cada categoría debe mostrar su padre y su profundidad.
   - Opcionalmente: drag-and-drop con `cdkDragDrop` de Angular CDK para reordenar y reasignar padres.

2. **Tienda (cliente) – Navegación (`fe/src/app/pages/client/`):**
   - En el menú lateral o navbar de categorías (componentes en `client/components/`), renderizar el árbol de categorías en formato de menú anidado expandible.
   - Implementar breadcrumbs dinámicos en las páginas de categoría y producto que muestren la ruta jerárquica (ej: `Librería > Cuadernos > Cuadernos A4`).
   - Actualizar `api-category.service.ts` con nuevos métodos: `getCategoryTree()`, `getCategoryChildren(id)`.

3. **Diferenciar las categorías según su estado (`CategoryState.Activo` / `Inactivo`)**: las subcategorías inactivas no se deben mostrar al cliente pero sí al admin.

---

## Prompt 2 – Página de Registro completa

### 2A · Formulario reactivo con validaciones

Reescribir completamente `fe/src/app/pages/auth/pages/register-page/` para que sea un formulario de registro de **cliente** robusto:

1. **Formulario reactivo** (usar `FormBuilder.nonNullable.group` ya existente, expandirlo):
   - **Campos:** `name`, `lastName`, `dni`, `phone`, `username`, `email`, `password`, `confirmPassword`.
   - **Reutilizar las validaciones de `FormUtils`** (`fe/src/app/shared/form-utils.ts`):
     - `name` / `lastName`: pattern `FormUtils.namePattern`, minLength(2), maxLength(100).
     - `email`: pattern `FormUtils.emailPattern`.
     - `username`: pattern `FormUtils.usernamePattern`, minLength(4), maxLength(30).
     - `password`: pattern `FormUtils.passwordPattern` (mínimo 8 chars, 1 letra, 1 número).
     - `confirmPassword`: custom group validator `FormUtils.isFieldOneEqualFieldTwo('password', 'confirmPassword')`.
     - `dni`: pattern `FormUtils.numberPattern`, longitud 7-8 (conforme a la entity `length: 15`).
     - `phone`: pattern `FormUtils.phonePattern`, maxLength(20).
   - Aplicar `FormUtils.notOnlyWhiteSpace` a los campos de texto.
   - Usar `FormUtils.getFieldError(form, fieldName)` o `FormUtils.getTextError(errors, fieldName)` para mostrar mensajes de error inline bajo cada campo.

2. **Validaciones asíncronas** para campos UNIQUE (`email`, `username`, `dni`):
   - Consumir el endpoint existente `GET /api/validate-unique?entity=Client&field=email&value=...` (ya implementado en `be/src/shared/validation/validation.controller.ts`).
   - Implementar **debounce de ~400ms** usando `debounceTime` de RxJS en un `AsyncValidator` personalizado.
   - Mostrar feedback inline: ícono de carga (spinner) mientras valida, check verde si disponible, "X" roja con mensaje si está en uso.
   - Registrar los errores custom `emailTaken`, `usernameTaken`, `dniTaken` en `FormUtils.getTextError`.

3. **Seguridad de contraseña:**
   - Toggle de visibilidad (ojo/ojo tachado) en los campos `password` y `confirmPassword`. Cambiar `type` entre `password` y `text`.
   - No loguear la contraseña en consola. El envío se hace por HTTPS (responsabilidad del hosting, no del código).
   - El hashing ya lo hace el backend con bcrypt (`user.entity.ts → setPassword()`).

4. **Subida de foto de perfil (opcional en registro):**
   - Agregar un campo de file input para foto de perfil con preview.
   - Validar tipo (solo `image/jpeg`, `image/png`, `image/webp`) y tamaño máximo (ej: 2 MB).
   - Si se incluye foto, enviarla como `FormData` con `multipart/form-data` separado al crear exitosamente el usuario, usando `api-photo.service.ts`.

5. **Control de errores y UX:**
   - Deshabilitar el botón Submit hasta que el formulario sea válido y todas las async validations hayan pasado.
   - Usar el signal `loading` existente para mostrar spinner durante el submit.
   - Usar el signal `errorMessage` existente para errores del servidor.
   - Manejar errores HTTP (400, 409 – ya existe, 500) con mensajes claros usando `ApiErrorService` existente (`fe/src/app/shared/api-error.service.ts`).

### 2B · Diseño responsivo y accesible

1. **Layout responsivo con Tailwind 4:**
   - **SM** (< 768px): formulario en una sola columna, scroll vertical. Campos apilados.
   - **MD** (768–1024px): formulario en 2 columnas para campos relacionados (nombre/apellido, contraseña/confirmar).
   - **LG** (> 1024px): layout centrado con carta/card elevada, opcionalmente con ilustración lateral.
   - Mínimo `min-h-screen` con fondo acorde al diseño de Laelsi.

2. **Accesibilidad:**
   - Todos los inputs con `<label>` asociado (atributo `for`).
   - `aria-invalid` y `aria-describedby` para errores.
   - Navegación por teclado completa (Tab order lógico).
   - Contraste suficiente en mensajes de error (rojo sobre fondo claro).

---

## Prompt 3 – Validación de campos UNIQUE (ya parcialmente implementado)

El endpoint genérico `GET /api/validate-unique` ya existe en `be/src/shared/validation/validation.controller.ts` y soporta las entidades `Admin`, `Client`, `Category`, `Product` con `excludeId` para ediciones. Completar y robustecer:

### 3A · Backend – Mejoras al ValidationController

1. **Whitelist de campos permitidos:** Actualmente cualquier `field` es consultable. Agregar un mapa de campos válidos por entidad para evitar exposición de columnas internas:

   ```typescript
   const ALLOWED_FIELDS: Record<string, string[]> = {
     Admin: ['email', 'username', 'dni'],
     Client: ['email', 'username', 'dni', 'cuit'],
     Category: ['name'],
     Product: ['name']
   };
   ```

   Rechazar con `AppError 400` si el campo no está en la whitelist.

2. **Normalización:** Antes de consultar, normalizar el valor (`.trim().toLowerCase()` para email/username) para evitar bypasses por casing.

3. **Mensajes genéricos por seguridad:** En vez de decir "El email ya está en uso" (facilita enumeración), considerar un mensaje genérico para campos sensibles como email: `"Este valor no está disponible"`. Para campos no sensibles como nombre de categoría, se puede ser específico.

4. **Rate limiting (básico):** Agregar un middleware simple que limite la cantidad de peticiones a este endpoint (ej: máximo 30 request/minuto por IP). Se puede usar un Map en memoria o una librería como `express-rate-limit`.

5. **Tests:** Agregar tests en `be/tests/` para el ValidationController:
   - Test con campo válido → `{ available: true }`.
   - Test con campo duplicado → `{ available: false }`.
   - Test con entidad inválida → error 400.
   - Test con campo no permitido (tras implementar whitelist) → error 400.
   - Test con `excludeId` → que no se cuente el propio registro.

### 3B · Frontend – Validador asíncrono reutilizable

1. **Crear un `AsyncValidator` genérico** (en `fe/src/app/shared/validators/unique.validator.ts`):

   ```typescript
   // Firma sugerida:
   export function uniqueFieldValidator(
     entity: string, field: string, http: HttpClient, excludeId?: number
   ): AsyncValidatorFn { ... }
   ```

   - Usar `debounceTime(400)`, `distinctUntilChanged`, `switchMap` para evitar requests innecesarios.
   - Devolver `{ [field + 'Taken']: true }` si no está disponible, o `null` si sí lo está.

2. **Integrar en register-page**, en los formularios de Admin y Client del panel admin (en `fe/src/app/pages/admin/pages/admins-page/` y `clients-page/`), y en el formulario de edición de perfil (`profile-page/`).

3. **UI feedback:** Mostrar inline bajo el campo: spinner mientras se consulta, ✓ verde si disponible, ✗ rojo si en uso. Deshabilitar submit hasta que todas las validaciones async terminen (`form.pending`).

---

## Prompt 4 – Auditoría y centralización de `form-utils.ts`

### 4A · Frontend – Completar y centralizar FormUtils

Auditar `fe/src/app/shared/form-utils.ts` y todos los formularios del proyecto para centralizar validaciones:

1. **Agregar validaciones faltantes** conforme a las entidades del backend:
   - **Product:** `name` (maxLength 50, unique), `description` (maxLength 1000, required), `brand` (required), `stock` (min 0, entero), `price` (min 0.01, numérico positivo).
   - **Category:** `name` (maxLength 50, unique), `description` (maxLength 1000 nullable), `order` (min 0, entero).
   - **Client:** `cuit` (`cuitPattern ^[0-9]{11}$`), `street` (maxLength 100), `streetNumber` (maxLength 10, numérico), `city` (maxLength 100), `province` (maxLength 100), `postalCode` (maxLength 10), `floor` (maxLength 5), `apartment` (maxLength 5).
   - **Foto:** validación de tipo MIME (`image/jpeg`, `image/png`, `image/webp`) y tamaño máximo (ej: 2 MB para usuarios, 5 MB para productos). Agregar `static maxFileSize = { userPhoto: 2 * 1024 * 1024, productPhoto: 5 * 1024 * 1024 }` y un validador custom `static fileSizeValidator(maxBytes: number)`.
   - **Campos numéricos genéricos:** `static positiveIntegerValidator`, `static positiveDecimalValidator`.

2. **Buscar validaciones duplicadas** en archivos de componentes del admin (formularios de producto, categoría, admin, cliente) y en el register-page. Reemplazar cualquier regex o validación hardcodeada (como el `'^[0-9]{7,8}$'` del register) con los patterns de `FormUtils`.

3. **Agregar al `getTextError` los nuevos errores custom:**
   - `usernameTaken` → `"El nombre de usuario ya está en uso."`
   - `dniTaken` → `"Este DNI ya está registrado."`
   - `cuitTaken` → `"Este CUIT ya está registrado."`
   - `fileTooLarge` → `"El archivo excede el tamaño máximo de X MB."`
   - `invalidFileType` → `"Tipo de archivo no permitido. Solo se aceptan: JPG, PNG, WEBP."`
   - `positiveInteger` → `"Debe ser un número entero positivo."`

4. **Documentar `FormUtils`** con JSDoc/TSDoc: cada propiedad estática, cada método, parámetros y retorno.

### 4B · Backend – Validación espejo y constraints en DB

1. **Revisar que las validaciones del backend** en los controladores (sanitize + validaciones manuales en `add`/`update`) sean consistentes con `FormUtils`:
   - Mismas longitudes máximas, mismos patterns aplicados en sanitización.
   - Agregar validaciones de formato (regex de email, username, etc.) en el backend si no existen, como capa extra a las constraints de la DB.

2. **Constraints en la DB (MikroORM decorators):**
   - Verificar que todos los `unique` estén correctos: `User.email`, `User.username`, `User.dni`, `Client.cuit`, `Category.name`, `Product.name`.
   - Verificar `length` en todas las propiedades coincida con lo definido en `FormUtils`.
   - MikroORM ya genera constraints vía `syncSchema()`. Verificar que el schema generado sea correcto.

3. **Manejo de errores de DB → mensajes útiles:** El patrón actual de catch por `error.code === '23505'` (PostgreSQL) o `'ER_DUP_ENTRY'` (MySQL) ya está implementado en los controladores. Verificar que esté en **todos** los controladores (`admin.controller.ts`, `client.controller.ts`, `product.controller.ts`, `category.controller.ts`) y que use `AppError` con código 409.

---

## Prompt 5 – Paginación genérica para todas las entidades

### 5A · Backend – Endpoints paginados genéricos

Actualmente solo `Product` tiene paginación (`findPage`). Implementar paginación para las demás entidades:

1. **Crear un helper genérico** en `be/src/shared/utils/pagination.ts`:

   ```typescript
   interface PaginationParams {
     page: number;     // default 1
     limit: number;    // default 10, máximo 100
     sortBy?: string;  // campo de ordenamiento
     sortOrder?: 'ASC' | 'DESC';
   }

   interface PaginatedResponse<T> {
     items: T[];
     total: number;
     page: number;
     limit: number;
     totalPages: number;
     hasMore: boolean;
   }

   function parsePaginationParams(query: Record<string, any>): PaginationParams { ... }
   ```

2. **Agregar `findPage`** a los controladores de:
   - `Category` → `GET /api/categories/page?page=1&limit=10`
   - `Admin` → `GET /api/admins/page?page=1&limit=10`
   - `Client` → `GET /api/clients/page?page=1&limit=10`
   - `Order` → `GET /api/orders/page?page=1&limit=10` (con filtros: `?status=Pendiente`, `?clientId=X`)
   - Refactorizar el `findPage` existente de `Product` para usar el helper.

3. **Filtros combinables (query params):**
   - Productos: `?category=X`, `?state=Activo`, `?brand=X`, `?minPrice=X`, `?maxPrice=X`, `?query=texto`.
   - Órdenes: `?status=X`, `?clientId=X`, `?dateFrom=X`, `?dateTo=X`.
   - Categorías: `?state=X`, `?parentId=X` (cuando tenga subcategorías).
   - Clientes/Admins: `?query=texto` (buscar en nombre, apellido, email).

4. **Serializar filtros en URL:** El frontend debe reflejar page, limit y filtros en la URL (`queryParams` de Angular Router) para permitir compartir enlaces y volver con estado preservado.

### 5B · Frontend – Componente de paginación reutilizable

1. **Crear un componente compartido** `fe/src/app/shared/components/pagination/`:
   - Inputs: `currentPage`, `totalPages`, `totalItems`, `limit`.
   - Outputs: `pageChange`, `limitChange`.
   - Mostrar: botones Anterior/Siguiente, números de página, selector de ítems por página.
   - Diseño con Tailwind 4, responsivo: en SM solo Anterior/Siguiente, en MD/LG mostrar números.
   - `aria-label` en controles para accesibilidad.
   - Deshabilitar botones cuando corresponda (primera/última página).

2. **Integrar en las páginas del admin** que listan entidades:
   - `admin/pages/products-page/` → reemplazar la carga total por paginación.
   - `admin/pages/categories-page/` → agregar paginación.
   - `admin/pages/clients-page/` → agregar paginación.
   - `admin/pages/admins-page/` → agregar paginación.
   - `admin/pages/orders-page/` → agregar paginación con filtros.

3. **Para la tienda del cliente:**
   - `client/pages/category-page/` → paginación o scroll infinito para productos de una categoría.
   - `client/pages/search-result/` → paginación de resultados.
   - Adaptar cantidad de ítems por página según breakpoint: SM=6, MD=9, LG=12 (por defecto).

4. **Modelo de respuesta paginada en el frontend** (`fe/src/app/models/`):

   ```typescript
   export interface PaginatedResponse<T> {
     items: T[];
     total: number;
     page: number;
     limit: number;
     totalPages: number;
     hasMore: boolean;
   }
   ```

5. **Actualizar los services** (`api-product.service.ts`, `api-category.service.ts`, etc.) para consumir los nuevos endpoints paginados.

---

## Prompt 6 – Histórico de precios (documentar y completar)

El proyecto **ya tiene implementado un sistema de histórico de precios** con las entidades `Price` (`be/src/product/price/price.entity.ts`) y `PriceChangeBatch` (`be/src/product/price-change-batch/priceChangeBatch.entity.ts`). El método `Product.updatePrice()` ya gestiona el ciclo de vida. Documentar y completar:

### 6A · Documentación del sistema actual

1. **Crear documentación** en `be/docs/price-history.md` describiendo:
   - **Datos registrados por Price:** `id`, `amount`, `currency` (enum ARS/USD), `validFrom` (timestamp), `isCurrent` (boolean), `product` (FK), `batch` (FK nullable a `PriceChangeBatch`).
   - **Flujo:** Al llamar `product.updatePrice(amount, currency, batch?)`, todos los precios existentes se marcan `isCurrent = false`, y se crea uno nuevo con `isCurrent = true` y `validFrom = now()`.
   - **PriceChangeBatch:** Registra cambios masivos con `user` (quién lo hizo), `adjustmentType` (fixed/percentage), `adjustmentValue`, `roundingRule`, `isReverted`. Permite rollback.
   - **Trazabilidad:** El batch vincula al usuario que realizó los cambios. En cambios individuales (sin batch), el precio queda vinculado solo al producto.

2. **Mejoras sugeridas:**
   - Agregar un campo `reason` (string, nullable) a `Price` para registrar el motivo del cambio cuando es individual (no batch).
   - Agregar `changedBy` (FK a `User`, nullable) en `Price` para trazabilidad de cambios individuales (no solo via batch).
   - Ambos son opcionales y no rompen la estructura actual.

### 6B · Frontend – Visualizador de histórico de precios

1. **En el panel admin**, al ver/editar un producto (`admin/pages/products-page/`):
   - Agregar una sección o tab "Historial de Precios" que muestre una tabla con todos los `Price` del producto, ordenados por `validFrom DESC`.
   - Columnas: Precio, Moneda, Válido desde, ¿Actual?, Lote de cambio (link al batch si existe).
   - Opcionalmente: gráfico tipo línea temporal (chart) con la evolución del precio.

2. **Endpoint si no existe:** `GET /api/products/:id/prices` → devolver `product.prices` ordenado por `validFrom DESC`. (Verificar si ya se está poblando con `populate: ['prices']` en `findOne`; si es así, no se necesita endpoint nuevo, solo filtrar en frontend).

---

## Prompt 7 – Botón "Reservar" cuando stock = 0

### 7A · Backend – Entidad y lógica de reservas

1. **Crear una entidad `Reservation`** en `be/src/reservation/reservation.entity.ts`:

   ```
   @Entity()
   class Reservation extends CustomBaseEntity {
     @ManyToOne(() => Product, { nullable: false }) product
     @ManyToOne(() => Client, { nullable: false })  client
     @Property({ nullable: false }) quantity: number
     @Enum(() => ReservationState) status: ReservationState = ReservationState.Pending
     @Property({ nullable: true }) notes?: string
   }
   ```

   Con el enum `ReservationState { Pending = 'Pendiente', Confirmed = 'Confirmada', Cancelled = 'Cancelada', Fulfilled = 'Cumplida' }` en `be/src/shared/enums/`.

2. **Controlador** `be/src/reservation/reservation.controller.ts`:
   - `POST /api/reservations` → crear reserva. Validaciones: producto debe existir, producto debe tener `stock === 0`, cliente autenticado (middleware `auth`), quantity > 0.
   - `GET /api/reservations` → listar reservas (admin: todas; client: solo las suyas).
   - `PATCH /api/reservations/:id/status` → cambiar estado (solo admin).
   - `GET /api/reservations/product/:productId` → listar reservas de un producto (admin).

3. **Registrar en `app.ts`:** `app.use('/api/reservations', reservationRouter)`.

4. **Modelo frontend** (`fe/src/app/models/reservation.model.ts`): interfaces `IApiReservation`, `ICreateReservation`.

### 7B · Frontend – UI condicional en la tienda

1. **En la página de producto** (`fe/src/app/pages/client/pages/product-page/`) y en las cards de listados:
   - Si `product.stock > 0`: mostrar el botón **"Agregar al carrito"** normalmente.
   - Si `product.stock === 0`: ocultar "Agregar al carrito" y mostrar un botón **"Reservar"** con estilo diferenciado (ej: borde punteado, color ámbar/naranja, ícono de campana o reloj).
   - La condición se evalúa reactivamente con Signals o `@if` (Angular 21 control flow).

2. **Flujo de reserva:**
   - Al hacer clic en "Reservar": si el usuario no está logueado, redirigir a login con `returnUrl`. Si está logueado, abrir un modal/diálogo simple con:
     - Nombre del producto (read-only).
     - Cantidad deseada (input numérico, min 1).
     - Notas opcionales.
     - Botón "Confirmar Reserva" + botón "Cancelar".
   - Al confirmar: `POST /api/reservations` con `{ productId, quantity, notes }`.
   - Mostrar feedback: éxito (SweetAlert o alerta del `alert.service.ts` existente) indicando "Tu reserva fue registrada. Te notificaremos cuando haya stock." Error: mensaje claro.

3. **En el perfil del cliente** (`client/pages/profile-page/`): agregar una sección "Mis Reservas" que liste las reservas del usuario con su estado.

4. **En el admin** (`admin/pages/`): agregar una página "Reservas" con listado de todas las reservas, filtros por estado/producto, y botón para cambiar estado (confirmar, cumplir, cancelar).
