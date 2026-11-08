# 🚀 Plan de Migración: Laelsi

## _Supabase + Vercel + Cloudflare R2_

Este documento detalla los pasos necesarios para migrar el proyecto **Laelsi** desde un entorno local (Express + MySQL + MikroORM) a una arquitectura moderna, escalable y serverless.

---

## 📊 Resumen de Tareas

|   #   | Bloque                              | Tareas | Complejidad |
| :---: | :---------------------------------- | :----: | :---------: |
| **0** | Preparación y Cuentas               |   3    |   🟢 Baja   |
| **1** | Base de Datos (Schema + Seed + RLS) |   3    |  🟡 Media   |
| **2** | Storage R2                          |   5    |   🔴 Alta   |
| **3** | Edge Functions (Backend)            |   11   |   🔴 Alta   |
| **4** | Frontend Angular                    |   8    |  🟡 Media   |
| **5** | Despliegue                          |   5    |   🟢 Baja   |
| **6** | Limpieza y Optimización             |   4    |   🟢 Baja   |
|       | **Total**                           | **39** |             |

> [!IMPORTANT] **Orden Crítico de Ejecución:** `0.1 → 0.2 → 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.1 → (Resto de Edge Functions) → 4.x → 1.3 → 5.x → 6.x` _(RLS se configura al final para no bloquear el desarrollo inicial)._

---

# 📦 BLOQUE 0 — Preparación y Cuentas

### Tarea 0.1 — Crear cuenta y proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) y crear una organización y un proyecto nuevo.
2. Anotar los siguientes valores (**Project Settings → API**):
   - `SUPABASE_URL`: URL del proyecto (`https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY`: Clave pública (para el Frontend).
   - `SUPABASE_SERVICE_ROLE_KEY`: Clave privada con permisos totales (solo para Edge Functions, **nunca** exponerla en el Frontend).

### Tarea 0.2 — Crear cuenta en Cloudflare y configurar R2

1. Ir a [cloudflare.com](https://cloudflare.com) y crear una cuenta.
2. Activar **R2 Object Storage** (requiere tarjeta, pero es gratuito hasta 10 GB).
3. Crear dos buckets:
   - `laelsi-products`: Para fotos de productos.
   - `laelsi-users`: Para fotos de perfil de usuarios.
4. En cada bucket, configurar **Public Access → Allow Access**. Esto genera una URL base como `https://pub-xxxx.r2.dev`.
5. Crear un **API Token de R2** con permisos de lectura/escritura y guardar:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`

### Tarea 0.3 — Configurar Vercel

1. Vincular tu cuenta de GitHub/GitLab en [vercel.com](https://vercel.com).
2. Importar el repositorio y configurar la carpeta `fe/` como root del proyecto Angular.
3. No realizar el deploy todavía; se requiere actualizar el código primero.

---

## 🗄️ BLOQUE 1 — Base de Datos en Supabase (SQL)

### Tarea 1.1 — Crear el Schema SQL

Ejecutar este script en el **SQL Editor** de Supabase para traducir las entidades de MikroORM a PostgreSQL:

```sql
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
CREATE TYPE payment_method AS ENUM ('Transferencia', 'Local');

-- TABLA: USER
CREATE TABLE "user" (
  id                SERIAL PRIMARY KEY,
  dtype             user_role NOT NULL,
  name              VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  dni               VARCHAR(15) NOT NULL UNIQUE,
  phone             VARCHAR(20) NOT NULL,
  username          VARCHAR(30) NOT NULL UNIQUE,
  password          VARCHAR(100) NOT NULL,
  email             VARCHAR(255) NOT NULL UNIQUE,
  role              user_role NOT NULL,
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
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- TABLA: PRODUCT
CREATE TABLE product (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
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

-- TABLA: PRICE_CHANGE_BATCH
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

-- TABLA: PRICE
CREATE TABLE price (
  id         SERIAL PRIMARY KEY,
  amount     NUMERIC(10,2) NOT NULL,
  currency   currency DEFAULT 'ARS',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT TRUE,
  product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  batch_id   INTEGER REFERENCES price_change_batch(id)
);

-- TABLA: PHOTO
CREATE TABLE photo (
  id            SERIAL PRIMARY KEY,
  type          photo_type NOT NULL,
  file_name     VARCHAR(255) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(50) NOT NULL,
  "order"       INTEGER,
  product_id    INTEGER REFERENCES product(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES "user"(id) ON DELETE CASCADE
);

-- TABLA: ORDER
CREATE TABLE "order" (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES "user"(id),
  status          order_state DEFAULT 'Pendiente',
  delivery_method delivery_method DEFAULT 'RetiroSucursal',
  payment_method  payment_method DEFAULT 'Transferencia',
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

-- AUTOMATIZACIÓN: updated_at
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
CREATE TRIGGER trg_price_change_batch_updated_at BEFORE UPDATE ON price_change_batch FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_order_updated_at BEFORE UPDATE ON "order" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_order_line_updated_at BEFORE UPDATE ON order_line FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_audit_log_updated_at BEFORE UPDATE ON audit_log FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Tarea 1.2 — Semilla de Datos (Seed)

Insertar datos iniciales traduciendo el `seed.ts` a SQL.

> [!NOTE] Usar `pgcrypto` para hashear contraseñas fuera de Supabase Auth.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Administradores
-- Los administradores NO se insertan con SQL: los crea `npm run seed` con la API de administración
-- de Supabase Auth, tomando el email y la contraseña de SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD
-- (variables que no se versionan). Una contraseña escrita acá quedaría publicada en el repositorio.

-- Categorías
INSERT INTO category (name, description, state) VALUES
 ('Libreria', 'Productos de Libreria', 'Activo'),
 ('Jugueteria', 'Productos de Jugueteria', 'Activo'),
 ('Tecnologia', 'Productos de Tecnologia', 'Activo'),
 ('Indumentaria', 'Productos de Indumentaria', 'Inactivo');
```

### Tarea 1.3 — Configurar Row Level Security (RLS)

Habilitar políticas de seguridad para proteger los datos:

```sql
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE product ENABLE ROW LEVEL SECURITY;

-- Ejemplo: Lectura pública para productos activos
CREATE POLICY "Productos activos son públicos" ON product
 FOR SELECT USING (state = 'Activo');

-- Ejemplo: Solo Admins gestionan productos
CREATE POLICY "Admins gestionan productos" ON product
 FOR ALL USING (
   EXISTS (
     SELECT 1 FROM "user"
     WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::int
       AND role = 'Admin'
   )
 );
```

---

## 🖼️ BLOQUE 2 — Storage en Cloudflare R2

### Tarea 2.1 — Migración de Imágenes

Subir imágenes de `be/uploads/` a R2.

- **Opción Rápida:** `wrangler r2 object put laelsi-products/<name> --file=./path/to/file`
- **Script Recomendado:** Usar un script Node.js con `@aws-sdk/client-s3` para subida masiva.

### Tarea 2.2 — Eliminar Multer

Eliminar `be/src/photo/multer.config.ts` y referencias en rutas/controladores. El Frontend ahora subirá directamente a R2 vía **Presigned URLs**.

### Tarea 2.3 — Edge Function: Generar Presigned URLs

Crear función `get-upload-url` en Supabase para otorgar permisos temporales de subida al cliente.

---

## ⚡ BLOQUE 3 — Backend: Edge Functions

Las Edge Functions de Supabase son funciones TypeScript que corren en Deno. Cada una reemplaza un conjunto de rutas Express actuales.

### Tarea 3.1 — Estrategia de Autenticación y Login

- **Opción A (Recomendada):** Mantener JWT custom pero validado por Supabase. Configurar el `JWT Secret` igual al actual.
- **Opción B:** Migrar a Supabase Auth.
- Crear función `user-login`: recibe credenciales, busca en la tabla `user`, verifica password con `crypt()` y devuelve `{ token, user }`.

### Tarea 3.2 — Función `user-register`

- Reemplaza `POST /api/users/register`. Hashea la contraseña con `pgcrypto` (`gen_salt('bf')`) e inserta en la tabla `user` con `dtype = 'Client'`.

### Tarea 3.3 — Funciones para Categorías

- Reemplaza `categoryRouter`. Implementar:
  - `category-list` (Público)
  - `category-create`, `category-update`, `category-delete` (Solo Admin).

### Tarea 3.4 — Funciones para Productos

- Reemplaza `productRouter`. Implementar:
  - `product-list`: Soportar variantes (`/active`, `/page`, `/search`, `/category/:id`).
  - `product-create`, `product-update`, `product-delete`.
  - Al eliminar, llamar a la Edge Function de eliminación en R2.

### Tarea 3.5 — Funciones para Bulk Price Update

- `bulk-price-preview`: Lógica de cálculo.
- `bulk-price-apply` y `bulk-price-rollback`: Usar `supabase.rpc()` para transacciones atómicas.

### Tarea 3.6 — Funciones para Fotos de Productos

- `photo-product-register`: Crea el registro tras el upload exitoso a R2.
- `photo-product-reorder`: Actualiza el campo `order`.
- `photo-product-delete`: Elimina de DB y R2.

### Tarea 3.7 — Funciones para Fotos de Usuarios

- `photo-user-upload` y `photo-user-delete`: Gestión de la foto de perfil.

### Tarea 3.8 — Funciones para Clientes

- Gestión completa de clientes (`list`, `search`, `get`, `create`, `update`, `delete`).

### Tarea 3.9 — Funciones para Administradores

- Gestión de admins (CRUD protegido).

### Tarea 3.10 — Funciones para Órdenes

- `order-create`: **Crítico.** Usar `rpc` para validar stock y crear líneas atómicamente.
- `order-update-status`: Implementar lógica de máquinas de estado.
- `order-cancel`: Restaurar stock y totales.

### Tarea 3.11 — Función SQL para Creación de Orden

Implementar en PostgreSQL para ser llamada vía `rpc`:

```sql
CREATE OR REPLACE FUNCTION create_order(
  p_client_id INTEGER,
  p_delivery_method delivery_method,
  p_payment_method payment_method,
  p_items JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_order_id INTEGER;
  v_item JSONB;
  v_product RECORD;
  v_current_price NUMERIC;
BEGIN
  INSERT INTO "order" (client_id, delivery_method, payment_method)
  VALUES (p_client_id, p_delivery_method, p_payment_method)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM product WHERE id = (v_item->>'productId')::int FOR UPDATE;
    IF v_product.stock < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Stock insuficiente';
    END IF;

    SELECT amount INTO v_current_price FROM price WHERE product_id = v_product.id AND is_current = TRUE;

    UPDATE product SET stock = stock - (v_item->>'quantity')::int,
                       total_sold = total_sold + (v_item->>'quantity')::int
    WHERE id = v_product.id;

    INSERT INTO order_line (order_id, product_id, quantity, price)
    VALUES (v_order_id, v_product.id, (v_item->>'quantity')::int, v_current_price);
  END LOOP;

  UPDATE "order" SET total_amount = (
    SELECT SUM(quantity * price) FROM order_line WHERE order_id = v_order_id
  ) WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 💻 BLOQUE 4 — Frontend Angular

### Tarea 4.1 — Actualizar Environments

Configurar `apiUrl` apuntando a Supabase Edge Functions y las URLs públicas de R2.

### Tarea 4.2 — Nuevo Flujo de Upload

Refactorizar `api-photo.service.ts`:

1. Pedir URL de subida al Backend.
2. Hacer `PUT` binario directo a R2.
3. Notificar al Backend para registrar la asociación en DB.

### Tarea 4.3 — Actualizar Servicios de API

Cambiar los endpoints de todos los servicios para que coincidan con los nombres de las Edge Functions (ej: `/api/products` → `/functions/v1/product-list`).

---

## 🚀 BLOQUE 5 — Despliegue

1. **Secrets:** Configurar `JWT_SECRET`, `R2_ACCESS_KEY`, etc., en **Supabase Dashboard → Edge Functions → Secrets**.
2. **CLI Deploy:** `supabase functions deploy <nombre-funcion>`.
3. **Vercel Routing:** Crear `fe/vercel.json` para manejar el routing de SPA:

   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

4. **CORS:** Asegurar que las Edge Functions devuelvan los headers correctos para permitir el origen de Vercel.

---

## 🧹 BLOQUE 6 — Limpieza

1. **Mover Backend Legacy:** Renombrar `be/` a `be-legacy/`.
2. **Depurar Dependencies:** Eliminar `express`, `multer`, `mikro-orm` y `mysql2` del `package.json` raíz.
3. **Actualizar README:** Documentar la nueva arquitectura Serverless.
4. **Actualizar .gitignore:** Quitar `/be/uploads/`.
