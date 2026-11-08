# Plan Maestro de Migración LaElsi: Supabase + Cloudflare (R2 & Edge Security) + Vercel

Este documento establece la lista completa y ordenada de tareas técnicas para modernizar la arquitectura de **LaElsi**, migrando desde el backend monolítico Express + MikroORM + MySQL a una arquitectura Serverless de alto rendimiento, costo $0/mes en infraestructura y seguridad de nivel empresarial.

---

## Arquitectura Objetivo

* **Frontend**: Angular 21 alojado en **Vercel** (CDN global, SPA rewrites, cabeceras HTTP de seguridad).
* **Base de Datos y Autenticación**: **Supabase** (PostgreSQL 15+, Supabase Auth nativo con Google OAuth y Email/Password, triggers de sincronización a `public.user`, Row Level Security nativo y funciones PL/pgSQL para transacciones atómicas).
* **Lógica de Backend**: **Supabase Edge Functions** (TypeScript en runtime Deno) para orquestación de recursos, gestión de fotos y operaciones administrativas.
* **Almacenamiento de Objetos**: **Cloudflare R2** (buckets S3-compatibles `laelsi-products` y `laelsi-users`, $0 costo de egreso/ancho de banda, URLs prefirmadas para subida directa).
* **Seguridad Perimetral y Anti-Bots**: **Cloudflare Edge** (Proxy DNS, mitigación automática DDoS L3/L4/L7, WAF & Edge Rate Limiting rules y Cloudflare Turnstile).

---

## BLOQUE 0 — Preparación de Plataformas y Credenciales

### Tarea 0.1 — Crear cuenta y configurar proyecto en Supabase
1. Ir a [supabase.com](https://supabase.com/) y crear una organización y un proyecto nuevo (región recomendada: `sa-east-1` São Paulo).
2. Obtener y guardar los siguientes valores desde **Project Settings → API**:
   * `SUPABASE_URL` (ej: `https://xxxx.supabase.co`)
   * `SUPABASE_ANON_KEY` (clave pública para el frontend)
   * `SUPABASE_SERVICE_ROLE_KEY` (clave de servicio con privilegios totales, solo para Edge Functions o scripts de backend)
   * `DATABASE_URL` (Connection string con pooler Supavisor en puerto 6543)
3. En **Authentication → Providers**, habilitar **Google**:
   * Ingresar en [Google Cloud Console](https://console.cloud.google.com/), crear credenciales OAuth 2.0 (Web application) con la Callback URL proporcionada por Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`).
   * Configurar `Client ID` y `Client Secret` en Supabase.

### Tarea 0.2 — Configurar Cloudflare (R2, DNS y Turnstile)
1. Ir a [cloudflare.com](https://cloudflare.com/) y habilitar **Cloudflare R2 Object Storage**.
2. Crear dos buckets:
   * `laelsi-products` (fotos del catálogo de productos)
   * `laelsi-users` (avatares y fotos de perfil de usuarios)
3. En cada bucket, habilitar **Public Access** (Settings → Public Access → Allow Access / Custom Domain) y anotar las URLs base:
   * `R2_PUBLIC_URL_PRODUCTS` (ej: `https://pub-xxxx.r2.dev` o `https://fotos-productos.laelsi.com.ar`)
   * `R2_PUBLIC_URL_USERS` (ej: `https://pub-xxxx.r2.dev` o `https://fotos-usuarios.laelsi.com.ar`)
4. Generar un **API Token de R2** con permisos de lectura y escritura (*Admin Read & Write* en R2 Storage). Guardar:
   * `R2_ACCOUNT_ID`
   * `R2_ACCESS_KEY_ID`
   * `R2_SECRET_ACCESS_KEY`
5. *(Seguridad Anti-Bots)* En Cloudflare Dashboard → **Turnstile**, crear un widget para el dominio de LaElsi (modo *Managed* o *Invisible*). Guardar:
   * `TURNSTILE_SITE_KEY` (pública para el frontend)
   * `TURNSTILE_SECRET_KEY` (privada para validación en Edge Functions)

### Tarea 0.3 — Configurar proyecto en Vercel
1. Ir a [vercel.com](https://vercel.com/) y conectar el repositorio de GitHub.
2. Configurar el proyecto asignando la carpeta `fe` como **Root Directory**.
3. Mantener el deploy automático en pausa hasta finalizar las adaptaciones del frontend en el Bloque 4.

---

## BLOQUE 1 — Base de Datos en Supabase (Schema SQL, Triggers y RLS)

### Tarea 1.1 — Crear Schema SQL con integración de Supabase Auth
En el **SQL Editor** de Supabase, ejecutar el esquema DDL que define las tablas de negocio, tipos ENUM, triggers de actualización automática y la sincronización nativa con `auth.users`:

```sql
-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUMS
CREATE TYPE user_role AS ENUM ('Admin', 'Client');
CREATE TYPE category_state AS ENUM ('Activo', 'Inactivo');
CREATE TYPE product_state AS ENUM ('Activo', 'Inactivo');
CREATE TYPE order_state AS ENUM ('Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado');
CREATE TYPE delivery_method AS ENUM ('RetiroSucursal', 'Envio');
CREATE TYPE fiscal_condition AS ENUM ('ConsumidorFinal', 'ResponsableInscripto', 'Monotributista', 'Exento');
CREATE TYPE currency AS ENUM ('ARS', 'USD');
CREATE TYPE photo_type AS ENUM ('product_photo', 'user_photo');
CREATE TYPE adjustment_type AS ENUM ('fixed', 'percentage');

-- TABLA: USER (Integrada con Supabase Auth via supabase_uid)
CREATE TABLE "user" (
  id                SERIAL PRIMARY KEY,
  supabase_uid      UUID UNIQUE,                       -- Vínculo directo con auth.users
  dtype             user_role NOT NULL DEFAULT 'Client',
  role              user_role NOT NULL DEFAULT 'Client',
  name              VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL DEFAULT '',
  dni               VARCHAR(15) UNIQUE,
  phone             VARCHAR(20) NOT NULL DEFAULT '',
  username          VARCHAR(50) UNIQUE,
  password          VARCHAR(100),                      -- NULL para usuarios autenticados vía Google OAuth
  email             VARCHAR(255) NOT NULL UNIQUE,
  
  -- Campos fiscales y de envío para Client
  cuit              VARCHAR(11) UNIQUE,
  fiscal_condition  fiscal_condition DEFAULT 'ConsumidorFinal',
  street            VARCHAR(100),
  street_number     INTEGER,
  city              VARCHAR(100),
  province          VARCHAR(100),
  postal_code       VARCHAR(10),
  floor             VARCHAR(5),
  apartment         VARCHAR(5),

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- TABLA: CATEGORY
CREATE TABLE category (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(1000),
  state       category_state DEFAULT 'Activo',
  "order"     INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- TABLA: PRODUCT
CREATE TABLE product (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  brand       VARCHAR(100) NOT NULL,
  total_sold  INTEGER DEFAULT 0,
  state       product_state DEFAULT 'Activo',
  stock       INTEGER NOT NULL CHECK (stock >= 0),
  category_id INTEGER NOT NULL REFERENCES category(id) ON UPDATE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- TABLA: PRICE_CHANGE_BATCH (Lotes de actualización masiva)
CREATE TABLE price_change_batch (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES "user"(id),
  adjustment_type  adjustment_type NOT NULL,
  adjustment_value NUMERIC(10,2) NOT NULL,
  rounding_rule    VARCHAR(50),
  is_reverted      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- TABLA: PRICE (Historial de precios)
CREATE TABLE price (
  id         SERIAL PRIMARY KEY,
  amount     NUMERIC(10,2) NOT NULL,
  currency   currency DEFAULT 'ARS',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT TRUE,
  product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  batch_id   INTEGER REFERENCES price_change_batch(id)
);

-- TABLA: PHOTO (Metadatos de imágenes en R2)
CREATE TABLE photo (
  id            SERIAL PRIMARY KEY,
  type          photo_type NOT NULL,
  file_name     VARCHAR(255) NOT NULL UNIQUE,          -- Key del archivo .webp en R2
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(50) NOT NULL DEFAULT 'image/webp',
  "order"       INTEGER DEFAULT 0,
  product_id    INTEGER REFERENCES product(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES "user"(id) ON DELETE CASCADE
);

-- TABLA: ORDER
CREATE TABLE "order" (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES "user"(id),
  status          order_state DEFAULT 'Pendiente',
  delivery_method delivery_method DEFAULT 'RetiroSucursal',
  total_amount    NUMERIC(10,2) DEFAULT 0,
  date_time       TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- TABLA: ORDER_LINE
CREATE TABLE order_line (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES product(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  price      NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- TABLA: AUDIT_LOG
CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES "user"(id),
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id   INTEGER,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- FUNCIÓN Y TRIGGER: Auto-actualización de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_category_updated_at BEFORE UPDATE ON category FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_product_updated_at BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_order_updated_at BEFORE UPDATE ON "order" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_order_line_updated_at BEFORE UPDATE ON order_line FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Tarea 1.2 — Crear Trigger de sincronización para Supabase Auth (OAuth2 y Email)
En el SQL Editor, crear la función y el trigger que sincronizan las altas de `auth.users` hacia `public.user`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name VARCHAR(100);
  v_last_name  VARCHAR(100);
  v_username   VARCHAR(50);
BEGIN
  -- Extraer nombre desde metadata de OAuth o email
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_username := COALESCE(NEW.raw_user_meta_data->>'user_name', split_part(NEW.email, '@', 1));

  -- Insertar o asociar si ya existía el email
  INSERT INTO public.user (
    supabase_uid,
    dtype,
    role,
    email,
    name,
    last_name,
    username,
    password
  )
  VALUES (
    NEW.id,
    'Client',
    'Client',
    NEW.email,
    v_first_name,
    v_last_name,
    v_username,
    NULL
  )
  ON CONFLICT (email) DO UPDATE
  SET supabase_uid = EXCLUDED.supabase_uid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

### Tarea 1.3 — Crear funciones RPC de validación y transacciones atómicas
Reemplaza endpoints de validación de unicidad (`/api/validate-unique`) y garantiza atomicidad en compras y control de stock:

```sql
-- 1. Verificación segura de unicidad de campos
CREATE OR REPLACE FUNCTION check_field_unique(
  p_field VARCHAR,
  p_value VARCHAR,
  p_exclude_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF p_field NOT IN ('email', 'username', 'dni', 'cuit') THEN
    RAISE EXCEPTION 'Campo no permitido para validación de unicidad';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM public.user WHERE %I = $1 AND ($2 IS NULL OR id != $2))',
    p_field
  )
  INTO v_exists
  USING p_value, p_exclude_id;

  RETURN NOT v_exists; -- True si es único (no existe)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Transacción Atómica: Creación de Órdenes y Reserva de Stock
CREATE OR REPLACE FUNCTION create_order(
  p_delivery_method delivery_method,
  p_items JSONB -- Array de [{ "productId": 1, "quantity": 2 }]
)
RETURNS INTEGER AS $$
DECLARE
  v_user_id INTEGER;
  v_order_id INTEGER;
  v_item JSONB;
  v_product RECORD;
  v_price NUMERIC;
BEGIN
  -- Obtener el ID del usuario en public.user a partir del JWT de Supabase
  SELECT id INTO v_user_id FROM public.user WHERE supabase_uid = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado o no registrado en el sistema';
  END IF;

  -- Crear la cabecera de la orden
  INSERT INTO "order" (client_id, delivery_method, status)
  VALUES (v_user_id, p_delivery_method, 'Pendiente')
  RETURNING id INTO v_order_id;

  -- Procesar cada producto con bloqueo FOR UPDATE contra condiciones de carrera
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM product 
    WHERE id = (v_item->>'productId')::int FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado', (v_item->>'productId');
    END IF;

    IF v_product.stock < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto: %', v_product.name;
    END IF;

    -- Obtener precio activo actual
    SELECT amount INTO v_price FROM price 
    WHERE product_id = v_product.id AND is_current = TRUE LIMIT 1;

    IF v_price IS NULL THEN
      RAISE EXCEPTION 'El producto % no posee un precio activo', v_product.name;
    END IF;

    -- Descontar stock e incrementar ventas
    UPDATE product 
    SET stock = stock - (v_item->>'quantity')::int,
        total_sold = total_sold + (v_item->>'quantity')::int
    WHERE id = v_product.id;

    -- Insertar línea de orden
    INSERT INTO order_line (order_id, product_id, quantity, price)
    VALUES (v_order_id, v_product.id, (v_item->>'quantity')::int, v_price);
  END LOOP;

  -- Recalcular el importe total de la orden
  UPDATE "order" 
  SET total_amount = (
    SELECT COALESCE(SUM(quantity * price), 0) FROM order_line WHERE order_id = v_order_id
  )
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Transacción Atómica: Cancelación de Orden y Restauración de Stock
CREATE OR REPLACE FUNCTION cancel_order(p_order_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_user_id INTEGER;
  v_role user_role;
  v_order RECORD;
  v_line RECORD;
BEGIN
  SELECT id, role INTO v_user_id, v_role FROM public.user WHERE supabase_uid = auth.uid();
  SELECT * INTO v_order FROM "order" WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  -- Solo el cliente dueño o un Administrador pueden cancelar la orden
  IF v_order.client_id != v_user_id AND v_role != 'Admin' THEN
    RAISE EXCEPTION 'No posee permisos para cancelar esta orden';
  END IF;

  IF v_order.status IN ('Entregado', 'Cancelado') THEN
    RAISE EXCEPTION 'La orden no se puede cancelar en su estado actual: %', v_order.status;
  END IF;

  -- Restaurar stock de cada producto
  FOR v_line IN SELECT * FROM order_line WHERE order_id = p_order_id
  LOOP
    UPDATE product 
    SET stock = stock + v_line.quantity,
        total_sold = GREATEST(0, total_sold - v_line.quantity)
    WHERE id = v_line.product_id;
  END LOOP;

  UPDATE "order" SET status = 'Cancelado' WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Tarea 1.4 — Configurar Row Level Security (RLS) Nativo
Habilitar RLS en todas las tablas para garantizar seguridad en profundidad mediante el contexto `auth.uid()`:

```sql
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE category ENABLE ROW LEVEL SECURITY;
ALTER TABLE product ENABLE ROW LEVEL SECURITY;
ALTER TABLE price ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_batch ENABLE ROW LEVEL SECURITY;

-- Helper para verificar rol de Administrador
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user 
    WHERE supabase_uid = auth.uid() AND role = 'Admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Catálogo: lectura pública de productos y categorías activas
CREATE POLICY "Catálogo productos público" ON product FOR SELECT USING (state = 'Activo' OR is_admin());
CREATE POLICY "Categorías públicas" ON category FOR SELECT USING (state = 'Activo' OR is_admin());
CREATE POLICY "Precios actuales públicos" ON price FOR SELECT USING (is_current = TRUE OR is_admin());
CREATE POLICY "Fotos de catálogo públicas" ON photo FOR SELECT USING (true);

-- Administradores: control total de productos, categorías, precios y lotes
CREATE POLICY "Admin gestiona productos" ON product FOR ALL USING (is_admin());
CREATE POLICY "Admin gestiona categorías" ON category FOR ALL USING (is_admin());
CREATE POLICY "Admin gestiona precios" ON price FOR ALL USING (is_admin());
CREATE POLICY "Admin gestiona lotes de precio" ON price_change_batch FOR ALL USING (is_admin());
CREATE POLICY "Admin gestiona fotos" ON photo FOR ALL USING (is_admin());

-- Usuarios: perfil propio o lectura/edición por Admin
CREATE POLICY "Usuario gestiona su propio perfil" ON "user"
  FOR ALL USING (supabase_uid = auth.uid() OR is_admin());

-- Órdenes: clientes ven y gestionan sus propias órdenes
CREATE POLICY "Clientes ven sus órdenes" ON "order"
  FOR SELECT USING (client_id = (SELECT id FROM public.user WHERE supabase_uid = auth.uid()) OR is_admin());
CREATE POLICY "Clientes ven sus líneas de orden" ON order_line
  FOR SELECT USING (
    order_id IN (SELECT id FROM "order" WHERE client_id = (SELECT id FROM public.user WHERE supabase_uid = auth.uid()))
    OR is_admin()
  );

-- Auditoría: solo accesible para administradores
CREATE POLICY "Admin accede a auditoría" ON audit_log FOR ALL USING (is_admin());
```

### Tarea 1.5 — Crear Script de Seed Inicial
Crear el seed para insertar administradores y categorías iniciales en Supabase, vinculando las credenciales iniciales de administrador mediante Supabase Auth o contraseñas encriptadas con `pgcrypto`.

---

## BLOQUE 2 — Almacenamiento en Cloudflare R2 y Optimización WebP

### Tarea 2.1 — Migrar imágenes existentes de `be/uploads/` a Cloudflare R2
Subir los archivos locales existentes hacia los buckets `laelsi-products` y `laelsi-users` en Cloudflare R2 usando Wrangler CLI o un script con `@aws-sdk/client-s3`:
```bash
npx wrangler r2 object put laelsi-products/<file.webp> --file=./be/uploads/products/<file.webp>
```

### Tarea 2.2 — Eliminar Multer y procesamiento en disco del backend
Eliminar `multer`, `multer.config.ts` y dependencias de subida a disco. Toda la transferencia binaria de imágenes se realiza **directamente entre el cliente y Cloudflare R2**.

### Tarea 2.3 — Optimización y conversión a WebP en el Frontend (Angular)
*Solución al servicio faltante*: Para reemplazar el middleware de `sharp` del backend Express, implementar en el frontend un servicio de compresión y conversión (`image-compressor.service.ts` usando HTML5 Canvas API o `browser-image-compression`):
* Convierte automáticamente cualquier archivo PNG, JPG o WEBP a **WebP con calidad 80%**.
* Redimensiona imágenes a un ancho máximo de 1200px para productos y 400px para avatares de usuario.
* Asegura que los archivos pesen típicamente menos de 150 KB antes de ser transmitidos a Cloudflare R2.

### Tarea 2.4 — Edge Function: Generador de URLs prefirmadas de R2 (`get-upload-url`)
Crear la Edge Function en `supabase/functions/get-upload-url/index.ts` usando `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner`.
* Valida el token del usuario (solo Admin para fotos de productos; dueño o Admin para foto de perfil).
* Genera un UUID único con extensión `.webp`.
* Devuelve una presigned URL HTTP `PUT` con validez de 5 minutos y la `key` asignada.

### Tarea 2.5 — Edge Function: Eliminación de archivos en R2 (`delete-r2-object`)
Crear la Edge Function en `supabase/functions/delete-r2-object/index.ts` para eliminar objetos del bucket cuando se borre un producto o foto.

---

## BLOQUE 3 — Backend: Supabase Auth y Edge Functions

### Tarea 3.1 — Autenticación Nativa y Migración de Sesiones (Supabase Auth)
* No se requieren Edge Functions para `login`, `register` ni `refresh-token`.
* Toda la autenticación la gestiona Supabase Auth en el cliente:
  * Google OAuth vía `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  * Email y contraseña vía `supabase.auth.signInWithPassword()`.
  * Registro vía `supabase.auth.signUp()`, disparando el trigger `trg_on_auth_user_created`.

### Tarea 3.2 — Edge Function: Categorías (`categories`)
Endpoints para listar (público con filtro de activas), crear, actualizar orden y eliminar (solo Admin).

### Tarea 3.3 — Edge Function: Productos (`products`)
Endpoints para catálogo paginado, filtros por categoría, búsqueda por texto con `ilike`, productos más vendidos y gestión CRUD (solo Admin). Al borrar un producto, invoca la eliminación de sus fotos en R2.

### Tarea 3.4 — Edge Function: Lotes de Precios Masivos (`bulk-prices`)
Endpoints para cálculo previo (`preview`), aplicación atómica en base de datos (`apply` creando lote en `price_change_batch` y actualizando tabla `price`), reversión (`rollback`) e historial.

### Tarea 3.5 — Edge Function: Metadatos de Fotos (`photos`)
Registrar la foto en la tabla `photo` tras la subida exitosa a R2 (`photo-product-register`), reordenar fotos del producto y eliminar fotos.

### Tarea 3.6 — Edge Function: Clientes y Administradores (`clients`, `admins`)
Endpoints administrativos para consultar perfiles, listar clientes, actualizar datos fiscales y gestión de usuarios.

### Tarea 3.7 — Edge Function: Órdenes y Máquina de Estados (`orders`)
Endpoints para:
* Consultar listado de órdenes (Admin) o historial del cliente autenticado.
* Cambiar estado de orden (`Pendiente` → `Pagado` → `Enviado` / `Entregado`) validando la máquina de estados según el método de entrega (`RetiroSucursal` vs `Envio`).
* Crear orden llamando a la función RPC `create_order`.
* Cancelar orden llamando a la función RPC `cancel_order`.

---

## BLOQUE 4 — Frontend Angular: Adaptación y Seguridad

### Tarea 4.1 — Actualizar `environment.ts` y `environment.development.ts`
Configurar las credenciales públicas de Supabase, Cloudflare R2 y Cloudflare Turnstile:
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://<project-ref>.supabase.co',
  supabaseAnonKey: '<SUPABASE_ANON_KEY>',
  apiUrl: 'https://<project-ref>.supabase.co/functions/v1',
  productImagesUrl: 'https://pub-xxxx.r2.dev/',
  userImagesUrl: 'https://pub-xxxx.r2.dev/',
  turnstileSiteKey: '<TURNSTILE_SITE_KEY>'
};
```

### Tarea 4.2 — Refactorizar `AuthService` a Supabase Auth nativo
1. Instalar `@supabase/supabase-js`.
2. Reemplazar las peticiones HTTP manuales a `/login` y `/register` por llamadas directas al cliente Supabase.
3. Conectar el listener `supabase.auth.onAuthStateChange()` a Signals reactivos (`currentUser`, `isLoggedIn`, `isAdmin`).
4. Implementar método `loginWithGoogle()` usando `signInWithOAuth`.

### Tarea 4.3 — Actualizar `AuthInterceptor` y Guards de Angular
* El interceptor inyecta el token Bearer emitido por Supabase Session en cada petición a las Edge Functions.
* Adaptar `admin.guard.ts` y `auth.guard.ts` para consultar el Signal de usuario autenticado de Supabase.

### Tarea 4.4 — Actualizar `ApiPhotoService` con flujo de subida directa a R2
Implementar el flujo de 3 pasos:
1. `ImageCompressorService.compressToWebP(file)`: Compresión y conversión local en el navegador.
2. `getUploadUrl(fileName, mimeType)`: Llama a la Edge Function para obtener presigned URL.
3. `HttpClient.put(uploadUrl, compressedBlob)`: Envío directo del archivo binario a Cloudflare R2.
4. `registerPhoto(key, productId)`: Registro del enlace en la tabla `photo` de Supabase.

### Tarea 4.5 — Integrar Cloudflare Turnstile en Checkout
Agregar el componente/widget de Turnstile en la pantalla de finalización de compra para verificar que la transacción proviene de un usuario legítimo antes de invocar `create_order`.

### Tarea 4.6 — Actualizar servicios de catálogo y validación reactiva
Actualizar `api-product.service.ts`, `api-category.service.ts`, `api-order.service.ts` para consumir las nuevas Edge Functions y reemplazar validaciones únicas con la RPC `check_field_unique`.

---

## BLOQUE 5 — Despliegue y Seguridad Perimetral

### Tarea 5.1 — Configurar Secrets en Supabase Edge Functions
Registrar las variables de entorno sensibles en Supabase CLI / Dashboard:
* `R2_ACCOUNT_ID`
* `R2_ACCESS_KEY_ID`
* `R2_SECRET_ACCESS_KEY`
* `R2_BUCKET_PRODUCTS`
* `R2_BUCKET_USERS`
* `TURNSTILE_SECRET_KEY`

### Tarea 5.2 — Desplegar Edge Functions con Supabase CLI
```bash
supabase functions deploy get-upload-url
supabase functions deploy delete-r2-object
supabase functions deploy products
supabase functions deploy categories
supabase functions deploy orders
supabase functions deploy photos
supabase functions deploy clients
supabase functions deploy admins
supabase functions deploy bulk-prices
```

### Tarea 5.3 — Configurar Cabeceras de Seguridad y SPA en `fe/vercel.json`
Crear `fe/vercel.json` con rewrites para Angular SPA y cabeceras estrictas de seguridad perimetral:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

### Tarea 5.4 — Configurar Reglas de WAF y Rate Limiting en Cloudflare Edge
En el panel de Cloudflare (Security → WAF → Rate limiting rules):
* Crear regla de protección en el borde: limitar peticiones excesivas (más de 30 por minuto) por IP hacia rutas de API críticas.
* Habilitar mitigación automática de DDoS en modo Managed.

### Tarea 5.5 — Configurar CORS en Edge Functions
Asegurar que todas las Edge Functions retornen cabeceras CORS admitiendo el dominio de producción en Vercel (`https://*.vercel.app` y dominio personalizado) y `http://localhost:4200` para desarrollo local.

---

## BLOQUE 6 — Limpieza y Cierre del Proyecto

### Tarea 6.1 — Retiro del backend Express obsoleto
Mover o archivar la carpeta `be/` a una rama de archivo histórico (`legacy/express-backend`) o eliminarla del repositorio activo.

### Tarea 6.2 — Limpieza de dependencias en `package.json` raíz
Eliminar referencias a Express, MikroORM, MySQL2, Multer, Sharp y Jsonwebtoken del monorepo.

### Tarea 6.3 — Actualizar `.gitignore` y `.env.example`
Limpiar rutas obsoletas de `/be/uploads/` y registrar el nuevo formato de variables de entorno para Supabase, R2 y Vercel.

### Tarea 6.4 — Actualizar el `README.md`
Documentar el stack tecnológico modernizado, instrucciones de arranque local de Angular con Supabase, y procedimiento de despliegue.

---

## Resumen y Ruta Crítica de Ejecución

```
Bloque 0 (Cuentas Supabase + Cloudflare R2/Turnstile + Vercel)
  ↓
Bloque 1 (Schema SQL + Trigger Auth OAuth2 + RPC Atómicas + RLS)
  ↓
Bloque 2 (Migración a R2 + Edge Functions de Presigned URLs)
  ↓
Bloque 3 (Edge Functions de Negocio)
  ↓
Bloque 4 (Frontend: Supabase Auth Google/Email + Upload R2 WebP + Turnstile)
  ↓
Bloque 5 (Despliegue: Secrets + Supabase CLI + vercel.json + Cloudflare WAF)
  ↓
Bloque 6 (Limpieza de Express y cierre)
```

---

## Ajustes aplicados al ejecutar el plan

Al auditar el código (Prompts 1 a 4) aparecieron diferencias entre este plan y lo que la aplicación hace realmente. El código del repositorio ya refleja estos ajustes; los bloques SQL de más arriba quedan como borrador histórico y **la fuente de verdad es `supabase/migrations/`**.

### Bloque 1 — Base de datos

| Tarea | Ajuste | Motivo |
| --- | --- | --- |
| 1.1 | Los ENUM usan los valores reales: `'Envío'`, `'Retiro en sucursal'`, `'Consumidor Final'`, `'Responsable Inscripto'`; `currency` incluye `EUR` | Son los textos que envía y espera el frontend. Con los del borrador, toda orden o cliente fallaba |
| 1.1 | `category` suma `parent_id` y `depth`; `"order"` suma `payment_method` | Existían en las entidades y faltaban en el borrador (sin ellos no hay subcategorías) |
| 1.1 | `"user"` no tiene `password` ni `dtype` | Las contraseñas las guarda Supabase Auth; `dtype` era el discriminador del ORM, redundante con `role` |
| 1.1 | Unicidad sin distinguir mayúsculas (`lower(name)`, `lower(email)`...) e índice de "un solo precio vigente por producto" | MySQL comparaba sin distinguir mayúsculas; PostgreSQL no |
| 1.2 | El trigger toma el rol solo de `raw_app_meta_data` y genera un `username` que no choque | `raw_user_meta_data` lo controla el usuario: leer el rol de ahí permitía registrarse como Admin. Además, dos emails con la misma parte local rompían el alta con Google |
| 1.3 | `check_field_unique` recibe la entidad y cubre `Category.name` y `Product.name`; devuelve `{ available, message }` | El borrador solo validaba campos de usuario |
| 1.3 | `create_order` y `cancel_order` reciben el cliente por parámetro y solo las ejecuta la service role | Si fueran públicas, un bot las llamaría directo y se saltearía Turnstile |
| 1.4 | Las políticas RLS son solo de lectura (`FOR SELECT`) | La política `FOR ALL` sobre `"user"` permitía que un cliente hiciera `UPDATE "user" SET role = 'Admin'` sobre su propia fila |
| 1.5 | El seed es un script (`supabase/seed/seed.mjs`) y las contraseñas salen de variables de entorno | Los usuarios deben crearse con la API de Supabase Auth; y un sitio público no puede tener contraseñas conocidas |

### Bloque 2 — Almacenamiento

| Tarea | Ajuste | Motivo |
| --- | --- | --- |
| 2.4 | Se usa `aws4fetch` en lugar de `@aws-sdk/*`; la URL firma `Content-Type` y `Cache-Control` | Es la librería que recomienda Cloudflare para Deno/Workers. Firmar los headers impide subir otra cosa que no sea WebP y deja las imágenes cacheables por un año |
| 2.5 | `delete-r2-object` solo borra archivos huérfanos | Las fotos registradas se borran desde `photos`, que elimina el registro y el archivo juntos |

### Bloque 3 — Backend

| Tarea | Ajuste | Motivo |
| --- | --- | --- |
| 3.1 | Se agrega la Edge Function `auth` (`login`, `register`, `me`, `verify-password`) | La app permite entrar con nombre de usuario y Supabase Auth solo acepta email. Resolverlo en el servidor evita exponer los emails. Google OAuth sí va directo desde el navegador |
| 3.x | Las funciones se conectan a PostgreSQL con `postgres.js` (`SUPABASE_DB_URL`) | Permite transacciones reales para las operaciones que antes dependían de `em.flush()` (categorías, productos, precios masivos) |
| 3.x | Las funciones conservan las rutas y respuestas del backend Express | El frontend casi no cambia: solo cambia la URL base. Excepción: `/products/bulk/*` pasa a `/bulk-prices/*` |
| 3.6 / 3.7 | Se agregan validaciones de permisos que el backend anterior no tenía | Las rutas de órdenes no verificaban la sesión, y un cliente podía ver o editar la cuenta de otro |
| 3.7 | Cancelar una orden cambiando su estado también devuelve el stock | Antes solo lo hacía la ruta `/cancel` |

### Bloque 5 — Despliegue

| Tarea | Ajuste | Motivo |
| --- | --- | --- |
| 5.1 | Los secrets van en `supabase/functions/.env`; se suman `ALLOWED_ORIGINS` y `MAX_BULK_DISCOUNT_PERCENTAGE` | — |
| 5.2 | Se agrega la función `auth`; todas se despliegan con `verify_jwt = false` (`supabase/config.toml`) | El catálogo es público. Cada función valida el token por su cuenta |
| 5.4 | **Las reglas de WAF no protegen la API** | Las Edge Functions se sirven desde `*.supabase.co`, que no pasa por la zona de Cloudflare. Solo protegen el sitio. La API se protege con Turnstile, el límite de intentos de login y las validaciones de cada función |

### Bloque 6 — Limpieza

No se eliminó `be/` ni sus dependencias (Tareas 6.1 y 6.2): `be/uploads/` es el origen de la migración de imágenes y conviene conservar el backend hasta verificar el nuevo entorno. El `.env.example` (Tarea 6.3) se reemplazó por las plantillas del README.