# Páginas legales, aceptación de términos, botón de arrepentimiento y pre-renderizado

Fecha: 2026-10-21 · Rama: `main` · Estado: **sin commit y sin `ng build`**. Nada aplicado en producción.

Para qué: verificar el OAuth de Google (que exige una política de privacidad propia, enlazada desde el inicio y legible) y dejar el comercio en regla con la normativa de comercio electrónico de Argentina.

## Orden de despliegue (importante)

1. `npm run db:push` — aplica `20261022000100_aceptacion_terminos_y_arrepentimiento.sql` (columnas `terms_*` en `user` y tabla `revocation_request`). Tiene que ir **antes** de las funciones: `POST /auth/register` ya escribe las columnas nuevas.
2. Agregar `REVOCATION_NOTIFY_EMAIL=<email del comercio>` en `supabase/functions/.env` y correr `npm run functions:secrets`. Sin eso el botón de arrepentimiento funciona y guarda la solicitud, pero nadie recibe el aviso por correo.
3. `npm run functions:deploy` — despliega la función nueva `revocations` y `auth` modificada.
4. Frontend (Vercel). **El build ahora pre-renderiza dos rutas**: mirá que termine bien (ver "Qué no se pudo verificar").

Entre los pasos 3 y 4 el frontend viejo no manda la casilla de aceptación y `POST /auth/register` responde `400` con un mensaje que pide recargar. Hacelos seguidos. El orden inverso (frontend primero) no rompe el registro, pero el botón de arrepentimiento no andaría hasta desplegar las funciones.

## Qué se hizo

| Tema | Qué | Dónde |
| --- | --- | --- |
| Páginas legales | `/privacidad` y `/terminos`, pre-renderizadas, con marco propio | `fe/src/app/pages/client/pages/footer-pages/` |
| Datos legales | Titular, CUIT, email, versión de los textos | `footer-pages/legal-info.ts` |
| Aceptación | Casilla obligatoria en el registro; el servidor la exige y guarda fecha y versión | `register-page.*`, `auth/index.ts`, `_shared/usuarios.ts` |
| Arrepentimiento | Página `/arrepentimiento`, link compacto arriba del inicio (ver "Actualización 2026-10-22"), enlace en el pie, función `revocations`, tabla `revocation_request`, correos | `revocation-page/`, `supabase/functions/revocations/` |
| Coherencia | FAQ y "¿Quiénes somos?" ya no prometen envíos nacionales, cobro online ni email de confirmación | `faq-page`, `about-us-page` |
| Pre-renderizado | `outputMode: "static"` + `server`; solo las dos páginas legales | `angular.json`, `main.server.ts`, `app.config.server.ts`, `app.routes.server.ts` |
| Hosting | Rewrites a `index.csr.html` (ya no existe `index.html`) y a las páginas pre-renderizadas | `fe/vercel.json`, `fe/ngsw-config.json` |
| Dependencias | `@angular/ssr` y `@angular/platform-server` 21.2.21; el resto de Angular quedó fijado en `^21.2.21` | `fe/package.json`, `package-lock.json` |

## Cómo verificar

**Ya verificado (2026-10-21):**

- `cd fe && npx ng test --no-watch` → 12 archivos, 72 tests en verde (30 previos + 42 nuevos).
- Servidor de desarrollo (`ng serve`): `/privacidad` y `/terminos` devuelven el texto completo en el HTML (`ng-server-context="ssg"`, título, `h1`/`h2`, leyendas); `/`, `/search` y `/arrepentimiento` siguen devolviendo el shell vacío de la SPA.
- Migración aplicada sobre Postgres (PGlite): idempotente, restricciones y límite por IP correctos, rollback correcto.
- Lógica de `revocations` (37 comprobaciones) y de `createUser`/`assertTermsAccepted` (17), ejecutando el código real con dobles de base, Turnstile y Resend. `tsc --strict` sobre las funciones tocadas, sin errores.

**Después de desplegar:**

1. Páginas legales (en PowerShell hay que escribir `curl.exe`, porque `curl` es un alias de `Invoke-WebRequest`):

   ```powershell
   curl.exe -I https://www.laelsi.com.ar/privacidad          # HTTP 200
   curl.exe -s https://www.laelsi.com.ar/privacidad | findstr "Política"
   curl.exe -I https://www.laelsi.com.ar/terminos
   ```

   La segunda tiene que mostrar texto de la política: eso prueba que el HTML ya no está vacío.
2. Registro: sin tildar la casilla el botón "Crear Cuenta" no se habilita. Después de registrar una cuenta:

   ```sql
   select username, terms_accepted_at, terms_version from "user" order by id desc limit 3;
   ```

3. Arrepentimiento: enviar una solicitud en `/arrepentimiento`. Tiene que mostrar el código `ARR-0000NN` al instante, llegar la constancia al email de la persona y el aviso a `REVOCATION_NOTIFY_EMAIL`, y quedar en `select * from revocation_request order by id desc limit 1;`. La sexta solicitud en una hora desde la misma IP responde `429`.
4. Permisos de la tabla nueva (esperado: ninguna fila):

   ```sql
   select grantee, privilege_type from information_schema.role_table_grants
   where table_name = 'revocation_request' and grantee in ('anon', 'authenticated');
   ```

5. Google Cloud: cargar las URLs de la tabla del README y enviar la verificación.

## Qué no se pudo verificar

- **`ng build` de producción.** La regla del proyecto es no buildear, así que el paso real de pre-renderizado en Node/Vercel no se ejecutó. Lo más cercano que se probó fue el renderizado en el servidor de desarrollo, que usa el mismo código de la app. Antes de confiar en el deploy, corré `cd fe && npx ng build` y comprobá que existan `dist/frontend/browser/privacidad/index.html`, `terminos/index.html` e `index.csr.html`, y que **no** exista `index.html`.
  Si el build falla en Vercel, el sitio queda en el deploy anterior (no se cae). Para volver atrás: quitar `"server"` y `"outputMode"` de `fe/angular.json`, y en `fe/vercel.json` apuntar el rewrite final a `/index.html` y borrar los dos rewrites de `privacidad` y `terminos`.
- **El envío real de correos** (Resend) y el widget de Turnstile en `/arrepentimiento`: solo se probaron con dobles.
- **El comportamiento de Vercel** con los rewrites a `privacidad/index.html`. Está pensado para que funcione con y sin trailing slash, pero se confirma con el `curl.exe` de arriba.

## Hallazgo: `laelsi.com.ar` redirige a `www.laelsi.com.ar`

`curl.exe -I https://laelsi.com.ar/privacidad` respondía `308` hacia `www.laelsi.com.ar` (verificado el 2026-10-21), o sea que Vercel tenía a `www` como dominio principal. **Los datos de despliegue definitivos dicen lo contrario:** el principal es `https://laelsi.com.ar` y `www` es solo el alias. Qué hay que cambiar en Vercel y en cada servicio externo está en `docs/seguridad/cierre-revision-seguridad-y-datos-definitivos-2026-10-22.md`.

## Actualización 2026-10-22: la norma del botón de arrepentimiento cambió

La **Disposición 954/2025** de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial (publicada el 04/09/2025) **derogó la Resolución 424/2020** (su art. 10). Todo el proyecto citaba la 424/2020; las citas ya están corregidas (README, migración, función `revocations`, plantillas de correo, modelo, página y rutas).

Qué dice ahora ([texto en InfoLEG](https://servicios.infoleg.gob.ar/infolegInternet/anexos/415000-419999/417152/norma.htm)):

- **Art. 1:** el link "Botón de arrepentimiento" tiene que estar *"a simple vista, en lugar destacado y en el primer acceso"*, sin pedir registro previo ni otro trámite. No exige un banner ni explicar el plazo.
- **Art. 5:** dentro de las 24 horas se informa un código de identificación por el mismo medio. Ya se cumple: el código sale en pantalla al instante y por correo.
- **Art. 6 (nuevo):** el horario de consultas y reclamos no puede ser menor al comercial, y la web tiene que informar un canal de contacto y **el área responsable**.
- **Art. 4 (botón de baja de servicios):** corresponde a servicios contratados. La tienda vende bienes, así que no aplica.

Qué se cambió:

- **Inicio:** el banner grande (con "Tenés 10 días…" y "No necesitás cuenta…") se reemplazó por una línea chica y neutra, arriba de todo y antes del mensaje de bienvenida, para que quede en el primer acceso. El plazo de 10 días se explica solo en `/arrepentimiento` (donde ya estaba), porque en el inicio lo ve cualquier visitante, haya comprado o no.
- **Pie:** se agregó "Consultas y reclamos: Atención al Cliente" debajo de los horarios (`areaConsultasSignal` en `footer.component.ts`).

**A confirmar con la librería:** "Atención al Cliente" es el nombre que puse yo para el área responsable. Si se llama distinto, se cambia en un solo lugar (`areaConsultasSignal`). Tampoco se verificó que los horarios del pie coincidan con el horario comercial real.

Los textos de Privacidad y Términos no cambiaron, así que `LEGAL_VERSION` queda igual. La interpretación de "a simple vista, en lugar destacado" no es asesoramiento legal: que lo valide un abogado junto con el resto de los textos.

## Pendiente y decisiones

1. **Pantalla de administración para las solicitudes de arrepentimiento.** Hoy se gestionan desde el email de aviso y la tabla `revocation_request` (la columna `resolved_at` queda para que el comercio marque las resueltas). Es la mejora más útil que sigue.
2. ~~**Constancia de aceptación con Google.**~~ **Resuelto el 2026-10-22:** la primera vez que una cuenta de cliente entra sin aceptación registrada, el layout de la tienda le muestra un diálogo con una casilla explícita y el servidor guarda la fecha y la versión (`POST /auth/accept-terms`). Ver `docs/seguridad/cierre-revision-seguridad-y-datos-definitivos-2026-10-22.md`.
3. **El Botón de arrepentimiento solo está donde pide la norma** (inicio) más el pie y las páginas legales. No está en "Mis Pedidos" ni en el carrito; se puede agregar.
4. **Revisión profesional.** Los textos son una base adaptada al proyecto, no asesoramiento legal. Conviene que los revise un abogado, sobre todo la transferencia internacional de datos, y consultar si corresponde inscribir la base en el Registro Nacional de Bases de Datos de la AAIP.
5. Las políticas del negocio que quedaron escritas en los Términos (causas de cancelación por parte del comercio, devolución del importe por el mismo medio, "plazo razonable" para pagar o retirar) hay que confirmarlas con la librería.
