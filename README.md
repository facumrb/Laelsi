# LAELSI

La librería “Laelsi” es un negocio dedicado a la venta de productos de librería, juguetería, computación, imprenta digital y sellos. El sitio web contempla ventas, administración y distribución de pedidos desde cualquier parte de Rosario, con el objetivo de ofrecer y expandir los servicios del negocio a más personas.

Trabajo práctico de Desarrollo de Software (UTN FRRo), según las consignas de [utnfrrodsw/tp](https://github.com/utnfrrodsw/tp).

| | |
| :-- | :-- |
| Sitio | [laelsi.com.ar](https://laelsi.com.ar) |
| Propuesta | [docs/catedra/proposal.md](docs/catedra/proposal.md) |
| Documentación | [docs/README.md](docs/README.md) |
| Video demostración | [Google Drive](https://drive.google.com/file/d/1qXaOcWWohlrfDlq3GMMrZ0Pog4uzKca6/view?usp=drive_link) |

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
# Frontend (componentes y servicios)
cd fe
npm test

# Edge Functions y concordancia entre capas (requiere Deno)
deno test --allow-read --allow-run=git supabase/functions/_tests/
```

## Más información

- [Puesta en marcha de la infraestructura](docs/guias/infraestructura.md): crear un entorno nuevo (Supabase, Cloudflare, Resend, Vercel y variables secretas).
- [Seguridad](docs/guias/seguridad.md)
- [Textos legales y verificación de Google](docs/guias/textos-legales-y-google.md)
- [Cómo se armó el proyecto](docs/proceso/historia.md)
