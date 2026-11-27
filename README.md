# LAELSI

La librería “Laelsi” es un negocio dedicado a la venta de productos de librería, juguetería, computación, imprenta digital y sellos. El sitio web contempla ventas, administración y distribución de pedidos desde cualquier parte de Rosario, con el objetivo de ofrecer y expandir los servicios del negocio a más personas.

Trabajo práctico de Desarrollo de Software (UTN FRRo), según las consignas de [utnfrrodsw/tp](https://github.com/utnfrrodsw/tp).

|                    |                                                      |
| :----------------- | :--------------------------------------------------- |
| Sitio              | [laelsi.com.ar](https://laelsi.com.ar)               |
| Propuesta          | [docs/catedra/proposal.md](docs/catedra/proposal.md) |
| Documentación      | [docs/README.md](docs/README.md)                     |
| Video demostración | Enlace pendiente (VIDEO_URL_PENDIENTE)               |

## Integrantes

- 49831 - Nicola, Valentino (com 302)
- 48808 - Ramírez, Facundo (com 302)

## Tecnologías

- **Frontend:** Angular 21, desplegado en Vercel (`fe/`).
- **Backend:** Supabase Edge Functions en TypeScript (`supabase/functions/`).
- **Base de datos y autenticación:** Supabase, con PostgreSQL y login con contraseña o con Google (`supabase/migrations/`).
- **Servicios externos:** Cloudflare R2 para las imágenes, Resend para los correos y Cloudflare Turnstile contra bots.

La carpeta `be/` tiene el backend de la regularidad (Express + MikroORM + MySQL), que ya no se usa. El motivo del cambio está en [Cómo se armó el proyecto](docs/proceso/historia.md).

## Cómo ejecutarlo

Requisitos: **Node.js 22** o superior y **npm 10** o superior.

```bash
git clone https://github.com/facumrb/Laelsi.git
cd Laelsi
npm install
npm run start:dev
```

El sitio queda en `http://localhost:4200` y usa el backend ya publicado en Supabase: no hace falta levantar un servidor ni una base de datos local.

<details>
<summary>¿No tenés Node.js? Instalación en Windows con fnm</summary>

1. Instalar fnm (Fast Node Manager):

   ```powershell
   winget install Schniz.fnm
   ```

2. Instalar Node.js 22:

   ```powershell
   fnm install 22
   fnm use 22
   ```

3. Para que fnm cargue siempre, abrir el perfil con `notepad $profile`, agregar esta línea al final y guardar:

   ```powershell
   fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
   ```

</details>

## Pruebas

```bash
# Frontend: pruebas unitarias de componentes (Vitest)
npm run test:fe

# Frontend: prueba end-to-end (Playwright; la primera vez: cd fe && npx playwright install chromium)
npm run test:e2e

# Backend: pruebas unitarias y de concordancia entre capas (requiere Deno)
npm run test:funciones

# Backend: integración y base de datos (requieren Docker y la pila local)
npx supabase start
npx supabase functions serve   # en otra terminal
npm run test:integracion
npm run test:db
```

<details>
<summary>¿No tenés Deno? (pruebas del backend)</summary>

1. Instalar Deno:

   ```powershell
   # Windows
   winget install DenoLand.Deno
   ```

   ```bash
   # macOS o Linux
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. Verificar la instalación con `deno --version` (Deno 2 o superior). Si la terminal no lo encuentra, cerrarla y volver a abrirla.

</details>

<details>
<summary>¿No tenés Docker? (pila local de Supabase para las pruebas de integración y de base de datos)</summary>

1. Instalar Docker Desktop:

   ```powershell
   # Windows
   winget install Docker.DockerDesktop
   ```

   En macOS o Linux, descargarlo de [docker.com](https://www.docker.com/products/docker-desktop/) (en Linux también sirve Docker Engine).

2. Reiniciar si el instalador lo pide y abrir Docker Desktop. En Windows usa WSL 2: si falta, el instalador avisa (se instala con `wsl --install`).
3. Verificar con `docker --version` y `docker info`. Docker Desktop tiene que estar abierto antes de `npx supabase start`.

La CLI de Supabase no hace falta instalarla: `npx supabase` la descarga la primera vez. También la primera vez, `npx supabase start` baja las imágenes de Docker (varios GB, tarda unos minutos). Para apagar la pila local: `npx supabase stop`.

</details>

Qué cubre cada prueba y la evidencia de la última ejecución: [docs/pruebas](docs/pruebas/README.md). Documentación de la API: [docs/api](docs/api/README.md).
