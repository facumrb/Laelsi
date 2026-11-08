# Configuración inicial aplicada: Supabase, R2 y Turnstile

Fecha: 2026-10-19 · Rama: `resend`

Resumen de lo que se aplicó a partir de "Configuración inicial.md" (pasos 1 a 5, ignorando 5.3 y 5.4: sin migración de imágenes y sin seed) y "Prompts de paso 4.md". No se corrió build ni se hizo commit.

## Qué quedó aplicado

- **Environments del frontend:** en [environment.ts](../fe/src/environments/environment.ts) y [environment.development.ts](../fe/src/environments/environment.development.ts) se cargaron la URL de Supabase, la publishable key, las dos URLs de R2 y la site key de Turnstile. Se conservaron todos los comentarios y solo se adaptó el de la key.
- **`supabase/functions/.env`:** no se pudo escribir. La configuración de permisos de la sesión bloquea esa carpeta y no se esquivó con Bash. Quedó en el scratchpad de la sesión con los valores "Preparado" del documento. Para moverlo desde PowerShell:

```powershell
Move-Item "C:\Users\Facundo\AppData\Local\Temp\claude\c--Users-Facundo-Documents-Desarrollo-LaElsi-LaElsi\8e1bb581-97b5-4433-8b0a-24f423b2aba2\scratchpad\functions.env" "C:\Users\Facundo\Documents\Desarrollo LaElsi\LaElsi\supabase\functions\.env"
```

Se verificó con `git check-ignore` que esa ruta queda cubierta por `.gitignore:8`. El diff del repo son solo los dos environments.

## Decisiones donde se apartó del documento

1. **Barra final en las URLs de R2.** El documento las trae sin barra, pero [product-image.component.ts:43](../fe/src/app/shared/components/product-image/product-image.component.ts#L43) concatena `${environment.productImagesUrl}${url}`. Sin la barra, las imágenes quedaban rotas.
2. **`RESEND_API_KEY` y `RESEND_FROM` van comentadas en el `.env`.** Así `supabase secrets set` no recibe valores vacíos. El código ya trata la ausencia como "no configurado".
3. **`ALLOWED_ORIGINS=https://laelsi.vercel.app`.** `*.vercel.app` ya pasa CORS, pero `resolveSiteUrl` ([http.ts:91](../supabase/functions/_shared/http.ts#L91)) ignora el comodín para armar el enlace del correo de recuperación. Es una protección contra robo de token, así que el dominio tiene que estar explícito.
4. **No se aplicó "Prompts de paso 4.md".** Es el quickstart genérico de Ionic con módulos y una tabla `todos`, y este proyecto no encaja con él:
   - Es Angular 21 standalone.
   - Ya tiene [supabase.client.ts](../fe/src/app/services/supabase.client.ts).
   - `@supabase/supabase-js` ya está instalado (`^2.117.3`).
   - No existe una tabla `todos`.
   - Aplicarlo habría duplicado servicios y roto `AppComponent`, justo lo que advierte la sección 7 del propio documento. De ahí solo se aprovechó la URL y la key.

## CORS de R2: sin modificaciones

Usar la política del documento tal cual en los dos buckets. Verificado contra el código:

- El PUT envía `Content-Type: image/webp` y `Cache-Control: public, max-age=31536000, immutable` ([r2.ts:36](../supabase/functions/_shared/r2.ts#L36)). Eso coincide con los `AllowedHeaders`.
- El `auth.interceptor` no le agrega `Authorization` al PUT, que es lo único que lo rompería.
- No hay lecturas cross-origin de imágenes (ni `fetch`, ni `crossOrigin`, ni canvas), así que no hace falta `GET` ni `ExposeHeaders`.
- `ng serve` usa el puerto 4200 por defecto.

Los previews de Vercel (`laelsi-git-xxx.vercel.app`) no van a poder subir imágenes, porque habría que agregar cada origen a mano.

## Lo que queda pendiente

**Paso 5 (no se ejecutó):** requiere login interactivo y toca infraestructura real. El `TU_PROJECT_REF` sale de la URL de Supabase: es `tdcvpakvwstdwpbjwjpn`. Con el `.env` ya movido, el orden es:

```bash
npx supabase login
npx supabase link --project-ref vwtqkglkenogylkranzz
npm run db:push
npm run functions:secrets
npm run functions:deploy
```

**Cosas que conviene mirar ya:**

- **Turnstile:** el widget se llama `laelsi.com.ar` y tiene un solo hostname. No se pudo ver la consola, pero si no incluye `laelsi.vercel.app` (y `localhost` para desarrollo), el widget va a fallar en el checkout.
- **Sin seed no hay administrador.** El rol `Admin` solo sale de `raw_app_meta_data.role` ([migración 200](../supabase/migrations/20261012000200_auth_trigger.sql#L29)). Hay que decidir cómo crear el primero antes de que el panel sirva para algo.
- **Secretos en texto plano:** el `.md` fuente tiene la secret del R2, la de Turnstile y el token `cfat_`. Ese token no lo usa el código y no se copió a ningún archivo. Si ese `.md` se sincroniza en Drive o Notion, conviene rotar el token.

---

## Actualización: dominio propio `laelsi.com.ar`

El sitio pasó de `laelsi.vercel.app` a `laelsi.com.ar`, y las imágenes de R2 pasaron de las URLs `r2.dev` a dominios propios. Esta sección **reemplaza** todo lo anterior que mencione `laelsi.vercel.app` o `r2.dev`.

### Cambios hechos en el repo

- [environment.ts](../fe/src/environments/environment.ts) y [environment.development.ts](../fe/src/environments/environment.development.ts): `productImagesUrl` pasa a `https://productos.laelsi.com.ar/` y `userImagesUrl` a `https://usuarios.laelsi.com.ar/` (con barra final, por la misma razón de antes).
- [ngsw-config.json](../fe/ngsw-config.json): el grupo `r2-images` del Service Worker cacheaba `https://*.r2.dev/**`. Ahora cachea las dos URLs propias. Sin este cambio no habría ningún error: las imágenes simplemente dejarían de cachearse y se descargarían en cada visita.
- No cambian: la URL de Supabase, la publishable key, la site key de Turnstile ni las credenciales de R2.

### Cambios a hacer a mano en `supabase/functions/.env`

Ese archivo está bloqueado para escritura en la sesión. Reemplazar estas cuatro líneas (la API key de Resend es la que se creó en el panel, empieza con `re_`):

```bash
SITE_URL=https://laelsi.com.ar
ALLOWED_ORIGINS=https://laelsi.com.ar
RESEND_API_KEY=re_...
RESEND_FROM="Laelsi <no-reply@noresponder.laelsi.com.ar>"
```

`RESEND_FROM` lleva el nombre visible `Laelsi` (formato que documenta el README) y el dominio exacto verificado en Resend. Después de guardar: `npm run functions:secrets` y `npm run functions:deploy`.

### Pendiente en consolas externas

- **DNS del dominio principal:** al momento de escribir esto, `laelsi.com.ar` y `www` no resuelven (sin registros A, AAAA ni CNAME). Hay que agregar el dominio en Vercel (Project → Settings → Domains) y crear en Cloudflare los registros que indique Vercel.
- **Supabase → Authentication → URL Configuration:** _Site URL_ `https://laelsi.com.ar` y _Redirect URLs_ `https://laelsi.com.ar/**` (más `http://localhost:4200/**`).
- **Google Cloud → cliente OAuth:** agregar `https://laelsi.com.ar` en _Authorized JavaScript origins_. La _redirect URI_ no cambia: sigue siendo la de Supabase (`https://vwtqkglkenogylkranzz.supabase.co/auth/v1/callback`).
- **Turnstile:** el hostname del widget tiene que ser `laelsi.com.ar` (y `localhost` si se prueba en local).
- **CORS de R2, en los dos buckets:** `AllowedOrigins` pasa a `["http://localhost:4200", "https://laelsi.com.ar"]`. El resto de la política no cambia.
- **Resend:** confirmar que `noresponder.laelsi.com.ar` figure como _Verified_.

### Verificado por DNS y HTTP

- `laelsi.com.ar` está delegado a Cloudflare.
- `productos.laelsi.com.ar` y `usuarios.laelsi.com.ar` resuelven a Cloudflare y responden `404` en la raíz, que es lo esperable para un bucket de R2 sin archivo en esa ruta.
- El DKIM y los registros `send.` de Resend para `noresponder.laelsi.com.ar` están publicados. Si el dominio figura como _Verified_ en Resend, solo se puede ver desde su panel.
