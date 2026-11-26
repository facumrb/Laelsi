# Puesta en marcha de la infraestructura

[Volver al índice de la documentación](../README.md)

## Arquitectura

| Capa | Tecnología | Dónde está en el repo |
| --- | --- | --- |
| Frontend | Angular 21 (SPA) desplegado en **Vercel** | `fe/` |
| Autenticación | **Supabase Auth** (usuario/email + contraseña y Google OAuth) | `fe/src/app/services/auth.service.ts` |
| Base de datos | **Supabase** (PostgreSQL con RLS) | `supabase/migrations/` |
| Backend | **Supabase Edge Functions** (TypeScript sobre Deno) | `supabase/functions/` |
| Imágenes | **Cloudflare R2** (subida directa desde el navegador) | `supabase/functions/_shared/r2.ts` |
| Correos | **Resend** (enlace para recuperar la contraseña) | `supabase/functions/_shared/correo.ts` |
| Anti-bots | **Cloudflare Turnstile** en el checkout y en "Recuperar contraseña" | `fe/src/app/shared/components/turnstile/` |

El navegador habla con dos servicios: las Edge Functions (toda la lógica de negocio) y Cloudflare R2 (solo para subir y mostrar imágenes). Resend nunca se llama desde el navegador: los correos los envían las Edge Functions.

La CLI de Supabase y Wrangler (Cloudflare) no hace falta instalarlas: se ejecutan con `npx`.

## Configuración del frontend

Para un entorno nuevo, completá `fe/src/environments/environment.development.ts` (desarrollo) y `fe/src/environments/environment.ts` (producción) con los datos del proyecto. Todos son valores públicos:

| Campo | Dónde se consigue |
| --- | --- |
| `supabaseUrl` | Supabase → Project Settings → API → Project URL |
| `supabaseAnonKey` | Supabase → Project Settings → API → anon public |
| `productImagesUrl` | Cloudflare R2 → bucket `laelsi-products` → Public URL (con `/` final) |
| `userImagesUrl` | Cloudflare R2 → bucket `laelsi-users` → Public URL (con `/` final) |
| `turnstileSiteKey` | Cloudflare → Turnstile → Site Key (vacío = sin verificación) |

## Pasos

Esto se hace **una sola vez**, al crear el entorno.

### 1. Supabase

1. Crear el proyecto en [supabase.com](https://supabase.com/) (región recomendada: `sa-east-1`).
2. **Authentication → Sign In / Providers → Google**: habilitarlo con el Client ID y el Client Secret de Google Cloud Console. La _Callback URL_ a registrar en Google es `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Authentication → URL Configuration**:
   - _Site URL_: la URL del sitio en producción.
   - _Redirect URLs_: `http://localhost:4200/**` y `https://tu-dominio.com/**`. Sin esto, el login con Google vuelve con error.

### 2. Cloudflare R2 y Turnstile

1. Crear los buckets `laelsi-products` y `laelsi-users` y habilitarles el acceso público.
2. En **cada bucket → Settings → CORS Policy**, permitir la subida desde el sitio:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:4200", "https://tu-dominio.com"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type", "cache-control"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. Crear un API Token de R2 con permiso de lectura y escritura sobre los dos buckets.
4. Crear un widget de Turnstile para el dominio del sitio.

### 3. Resend (correos de recuperación de contraseña)

[Resend](https://resend.com/) envía el correo con el enlace de "¿Olvidaste tu contraseña?" y el aviso de que la contraseña se cambió. El plan gratuito alcanza para este uso: 3.000 correos por mes, con un tope de 100 por día.

**No hay que tocar código para conectar la cuenta.** Los datos de Resend van como _secrets_ de las Edge Functions (paso 4).

1. Crear la cuenta en [resend.com](https://resend.com/).
2. **Domains → Add Domain**: agregar un dominio propio. Resend recomienda usar un subdominio (por ejemplo `correo.tu-dominio.com`) para no mezclar la reputación de los envíos con la del dominio principal.
3. Cargar en el proveedor de DNS del dominio los registros que muestra Resend y esperar a que el dominio figure como **Verified**.
4. **API Keys → Create API Key** con permiso _Sending access_. La clave empieza con `re_` y se muestra una sola vez.
5. Completar en `supabase/functions/.env`:

   | Variable | Qué poner |
   | --- | --- |
   | `RESEND_API_KEY` | La clave del paso 4 |
   | `RESEND_FROM` | El remitente, con el formato `Laelsi <no-reply@correo.tu-dominio.com>`. El dominio tiene que ser **exactamente** el verificado |
   | `SITE_URL` | La URL pública del sitio, sin barra final. Con ella se arma el enlace del correo |

**Sin dominio propio** (los dominios `*.vercel.app` no se pueden verificar) solo se puede probar: con `RESEND_FROM="Laelsi <onboarding@resend.dev>"` Resend entrega los correos únicamente a la casilla con la que creaste la cuenta, y rechaza cualquier otro destinatario.

Qué se puede ajustar y dónde:

| Qué | Archivo |
| --- | --- |
| Textos y diseño de los correos | `supabase/functions/_shared/correo-plantillas.ts` |
| Vigencia del enlace (60 min) y límites de envío | constantes al inicio de la sección "Recuperación de contraseña" en `supabase/functions/auth/index.ts` |
| Número de WhatsApp de ayuda | `fe/src/app/pages/auth/pages/recover-password-page/recover-password-page.component.ts` |

### 4. Variables secretas

Estas claves dan acceso total a los datos: no van en el frontend ni en Vercel, y los archivos que las contienen no se suben al repositorio (están cubiertos por `.gitignore`).

**`supabase/functions/.env`** — secrets de las Edge Functions:

```bash
# Cloudflare R2 (R2 → Manage API Tokens)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PRODUCTS=laelsi-products
R2_BUCKET_USERS=laelsi-users

# Cloudflare Turnstile (clave PRIVADA). Vacía = no se exige la verificación anti-bots.
TURNSTILE_SECRET_KEY=

# Resend (API Keys → Create API Key). Sin estas dos, "Recuperar contraseña" responde con error.
RESEND_API_KEY=
RESEND_FROM="Laelsi <no-reply@correo.tu-dominio.com>"

# URL pública del sitio, sin barra final. Es el destino de los enlaces que van por email.
SITE_URL=https://tu-dominio.com

# Orígenes que pueden llamar a las funciones, separados por coma.
# http://localhost:4200 y los dominios *.vercel.app ya están permitidos.
ALLOWED_ORIGINS=https://tu-dominio.com

# Descuento máximo (en %) permitido en los cambios masivos de precio
MAX_BULK_DISCOUNT_PERCENTAGE=90

# Email del comercio que recibe el aviso cuando alguien usa el Botón de arrepentimiento (Disp. 954/2025).
# Sin esto la solicitud igual se guarda (tabla revocation_request), pero nadie se entera por correo.
REVOCATION_NOTIFY_EMAIL=
```

**`supabase/.env`** — solo para los scripts de seed:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Email REAL del administrador principal: recibe el correo de "Recuperar contraseña".
# No se versiona en el repositorio a propósito.
SEED_ADMIN_EMAIL=
# Contraseña del administrador principal. Mínimo 12 caracteres.
SEED_ADMIN_PASSWORD=
# Contraseña de los usuarios de prueba (mínimo 12 caracteres y distinta de la del administrador).
# Solo hace falta con "npm run seed:demo".
SEED_DEMO_PASSWORD=
# Confirmación para cargar los datos de demostración. Poné "yes" SOLO en un proyecto de pruebas:
# en producción dejala vacía, así "npm run seed:demo" se niega a correr.
SEED_ALLOW_DEMO=
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL` no se cargan como secrets: Supabase las inyecta sola en las funciones desplegadas.

### 5. Base de datos, funciones y datos iniciales

Desde la raíz del repo:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>

# 1. Crear tablas, trigger de Auth, funciones SQL y políticas RLS
npm run db:push

# 2. Cargar los secrets y desplegar las Edge Functions
npm run functions:secrets
npm run functions:deploy

# 3. Subir las imágenes de be/uploads a R2
npx wrangler login
npm run r2:subir-imagenes

# 4. Cargar los datos iniciales
npm run seed          # administrador principal + categorías + productos
npm run seed:demo     # además: usuarios, productos y órdenes de prueba (solo en un proyecto de pruebas: exige SEED_ALLOW_DEMO=yes)
```

Si preferís no usar la CLI para la base, los archivos de `supabase/migrations/` se pueden pegar en el SQL Editor de Supabase, **en orden numérico**.

Cada vez que se agrega una migración o cambia un secret hay que repetir el paso que corresponda: `npm run db:push` aplica solo las migraciones nuevas, y `npm run functions:secrets` + `npm run functions:deploy` actualizan las funciones.

### 6. Vercel

1. Importar el repositorio y elegir `fe` como **Root Directory** (framework: Angular).
2. No hacen falta variables de entorno: la configuración pública está en `fe/src/environments/environment.ts`.
3. `fe/vercel.json` ya define el _rewrite_ de la SPA y las cabeceras de seguridad.
