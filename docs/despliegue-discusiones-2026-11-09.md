# Despliegue a producción de las tareas de `discusiones.md` (2026-11-09)

Guía para llevar a producción lo de los IDs 54, 65, 68, 70 y 71. **Un push a `main` despliega `fe/` a producción automáticamente** (Vercel registra un despliegue "Production" por cada commit), así que el orden no es opcional: **primero la base, después las funciones y recién al final el push.**

Estado verificado antes de escribir esta guía (2026-11-09, solo lectura):

| Qué | Producción hoy | Después de desplegar |
| --- | --- | --- |
| Migraciones | hasta `20261106000100` | además `20261106000200` (estado de usuarios) y `20261106000300` (estado Pausado) |
| Funciones | versiones 18 a 20, de hoy | las 12, con el código nuevo |
| `fe/` | el último commit publicado (`e20e70c`) | los 13 commits nuevos |

## Por qué importa el orden

| Si pasa esto antes de tiempo | Qué se rompe en producción |
| --- | --- |
| Sube `fe/` sin migraciones ni funciones | El carrito pide `/products/availability` (no existe: error en cada visita al carrito); desactivar o reactivar clientes y administradores llama a `PATCH /:id/state` (no existe); el panel ofrece "Pausar" y el servidor viejo rechaza el estado |
| Se despliegan funciones sin la migración de usuarios | Todas las funciones que leen `user.state` fallan (la columna no existe): nadie podría iniciar sesión |
| Se despliega `products` sin la migración de Pausado | Las consultas de la tienda nombran el estado `Pausado` y fallan |

## Paso 1: migraciones (la base)

Aplican **solo** `20261106000200` y `20261106000300`. Son aditivas: una columna con valor por defecto y un valor más en un tipo. Se probaron con la base en el mismo estado que producción (con y sin las pruebas pgTAP).

**Cuidado:** `npm run db:push` aplica todas las migraciones que haya en la carpeta, incluidas las `20261107…` de multi-tenant (sin commitear), que **no** deben llegar a producción. Hay que apartarlas un momento. En PowerShell, desde la raíz del repositorio:

```powershell
# 1. Apartar las migraciones multi-tenant (quedan fuera de la carpeta, nada se borra)
$aparte = "$env:TEMP\migraciones-multitenant"
New-Item -ItemType Directory -Force $aparte | Out-Null
Move-Item supabase\migrations\20261107*.sql $aparte
Get-ChildItem supabase\migrations | Select-Object -Last 4 Name    # la última tiene que ser 20261106000300

# 2. Ver qué se aplicaría SIN aplicar nada: tiene que listar SOLO 20261106000200 y 20261106000300
npm run db:push -- --dry-run

# 3. Si la lista es esa, aplicar
npm run db:push

# 4. Devolver las migraciones multi-tenant a su lugar (y comprobar que son 6)
Move-Item "$aparte\*.sql" supabase\migrations\
(Get-ChildItem supabase\migrations\20261107*.sql).Count
```

Si el comando pide autenticación o la contraseña de la base: `npx supabase login` y, para la contraseña, la variable `SUPABASE_DB_PASSWORD` (el proyecto ya está vinculado: `vwtqkglkenogylkranzz`). Si el paso 2 lista algo distinto, **no sigas** y avisame.

## Paso 2: funciones

Se redespliegan **todas**, no solo las que cambiaron: `requireUser` ahora rechaza las cuentas inactivas y vive en un archivo compartido. Si `orders` quedara con el código viejo, un cliente desactivado podría seguir haciendo pedidos con un token vigente.

```powershell
npm run functions:deploy
```

(Usa Docker para empaquetar; ya está abierto.) Funciones con cambios propios: `admins`, `clients`, `products` y `categories`. Cambió también `_shared/http.ts` (las cabeceras de caché), que usan todas.

## Paso 3: comprobar en producción antes del push

Cuando termines el paso 2, avisame ("listo") y corro **solo lecturas** contra producción: la portada responde en una llamada con `Cache-Control: public, max-age=60`, `availability` funciona y no se cachea, el listado de la tienda sigue igual, y el panel (sin sesión) sigue protegido. Si algo no da, no se hace el push.

## Paso 4: el push (despliega `fe/`)

Lo último. Son 13 commits locales (`git log --oneline origin/main..HEAD` los lista); ninguno incluye multi-tenant. Cuando me avises que los pasos 1 a 3 están bien, hago:

```powershell
git push origin main
```

Vercel despliega solo. Después se mira el sitio y el carrito.

## Si algo sale mal

| Qué | Cómo se revierte |
| --- | --- |
| `fe/` | En Vercel, "Promote to Production" sobre el despliegue anterior (`e20e70c`). No toca la base |
| Funciones | `git checkout e20e70c -- supabase/functions` y `npm run functions:deploy`, y después restaurar el árbol (o redeployar desde ese commit en una copia). Con el código viejo y la base nueva todo sigue andando: las columnas nuevas tienen valor por defecto |
| Migraciones | No se deshacen: son aditivas y no estorban al código viejo. La reversa de la de usuarios está en su cabecera. El valor `Pausado` de un tipo enumerado no se puede quitar de PostgreSQL |

## Qué cambia para el cupo gratuito de Supabase

- La portada pasa de **8 a 1 invocación** por visita, y las pantallas públicas del catálogo se reutilizan durante 60 segundos en el navegador.
- Costo conocido: un cambio hecho en el panel puede tardar hasta un minuto en verse en la tienda, y el stock que muestra la tienda puede estar hasta un minuto atrasado (el servidor igual valida al confirmar el pedido).
- Nuevo: el carrito hace **1 invocación** al abrirse (`availability`) y el checkout 1 para consultar el teléfono; las dos son chicas y no se cachean a propósito.

## Pendiente de la investigación de rendimiento (no se aplica en este despliegue)

**Caché de un año para los archivos con hash, en `vercel.json`.** Un `vercel.json` inválido rompe el despliegue y no se puede validar en local: se prueba antes en una vista previa de Vercel (una rama que no sea `main`). Fragmento propuesto:

```json
{
  "source": "/:archivo((?:main|chunk|styles)-[A-Z0-9]+\\.(?:js|css))",
  "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
}
```

**Regla de caché de Cloudflare para las imágenes: NO hace falta.** Esta guía decía que las imágenes no se cacheaban en el borde (`cf-cache-status: DYNAMIC`); era un **error de medición**: se midió con `curl -I` (un pedido `HEAD`), que Cloudflare no trata como un `GET`. Con `GET` reales, una imagen de producto responde `cf-cache-status: HIT` con más de 10 días de antigüedad en el borde y `Cache-Control: public, max-age=31536000, immutable`: ya se cachea. Si en el futuro se quiere verificar, hay que usar `curl -s -D - -o /dev/null <url>` (GET), nunca `-I`.

**Clave de PageSpeed Insights** para medir antes y después: ver [rendimiento-investigacion-2026-11-09.md](./requerimientos/rendimiento-investigacion-2026-11-09.md). Se guarda como `PAGESPEED_API_KEY` en `supabase/.env` (ignorado por git).
