# Textos legales y verificación de Google

[Volver al índice de la documentación](../README.md)

La Política de Privacidad y los Términos y Condiciones son rutas públicas de la SPA:

| Ruta | Contenido | Código |
| --- | --- | --- |
| `/privacidad` | Política de Privacidad (incluye la sección sobre los datos de Google) | `fe/src/app/pages/client/pages/footer-pages/privacy-page/` |
| `/terminos` | Términos y Condiciones | `fe/src/app/pages/client/pages/footer-pages/terms-page/` |
| `/arrepentimiento` | Botón de arrepentimiento (Disp. 954/2025) | `fe/src/app/pages/client/pages/revocation-page/` y Edge Function `revocations` |

- Los datos que comparten las páginas (domicilio, WhatsApp, titular, CUIT, email de contacto) y la **versión** de los textos están en `footer-pages/legal-info.ts`. Los campos opcionales no se muestran mientras estén vacíos.
- **Los textos describen lo que el código hace hoy** (qué datos se piden, quién los recibe, cuánto se guardan, cómo se compra). Si cambia algo de eso (un proveedor nuevo, un dato nuevo en el perfil, analítica, pagos en línea, envíos a domicilio), hay que actualizar el texto **y** `LEGAL_VERSION` en `legal-info.ts`. Esa versión se guarda con la aceptación de cada persona que se registra (`user.terms_accepted_at` y `user.terms_version`).
- **Aceptación al registrarse:** casilla obligatoria que el servidor vuelve a exigir (`POST /auth/register` responde 400 sin ella).
- **Aceptación con Google:** la cuenta se crea al volver de Google, sin casilla. Por eso, mientras una cuenta de cliente tenga `termsAccepted = false` (cuentas de Google y cuentas anteriores a la casilla), el layout de la tienda muestra un diálogo bloqueante (`terms-gate`) con una casilla explícita. Al aceptar, `POST /auth/accept-terms` guarda la fecha y la versión en `user.terms_accepted_at` y `user.terms_version`. Las cuentas de administración no pasan por acá.
- **Botón de arrepentimiento:** está en el inicio (banner), en el pie de página y en el marco de las páginas legales. No pide cuenta: guarda la solicitud en `revocation_request`, devuelve un código de identificación (`ARR-000123`) que se muestra al instante y se envía por email, y avisa al comercio a `REVOCATION_NOTIFY_EMAIL`. Protegido con Turnstile y un tope de 5 solicitudes por hora por IP. **Todavía no hay una pantalla de administración para estas solicitudes:** se gestionan desde el email de aviso y la tabla.
- Enlaces a las páginas legales: pie de página, casilla del registro y aviso bajo "Continuar con Google". El `index.html` repite los dos enlaces dentro de un `<noscript>`.

## Pre-renderizado de las dos páginas legales

El sitio es una SPA: el HTML que baja el navegador está vacío y el texto aparece al ejecutar JavaScript. Para que los robots que no ejecutan JavaScript (como los que verifica Google) vean el texto, `/privacidad` y `/terminos` se **pre-renderizan en el build** (`outputMode: "static"` en `fe/angular.json`). El resto del sitio sigue siendo una SPA.

- Qué rutas se pre-renderizan: `fe/src/app/app.routes.server.ts`. El build genera `privacidad/index.html` y `terminos/index.html`, y el resto de las rutas usa `index.csr.html` (**ya no existe `index.html`**; por eso `fe/vercel.json` apunta ahí).
- Las páginas legales viven **fuera del layout de la tienda** (`app.routes.ts`) y usan su propio marco liviano (`legal-shell`). El navbar de la tienda depende de `localStorage` y del API, que no existen en el build. **Regla:** nada de lo que usen estas páginas puede depender del navegador (`localStorage`, `window`, `HttpClient`, `AuthService`, `CartService`); si hace falta, va dentro de `afterNextRender`. Un test lo vigila (`legal-pages.spec.ts`).
- Verificarlo sin buildear: `npm run start:dev` y abrir `http://localhost:4200/privacidad` → _Ver código fuente de la página_ tiene que mostrar el texto de la política (y `ng-server-context="ssg"`).
- Verificarlo después de un build (`cd fe && npx ng build`): tienen que existir `dist/frontend/browser/privacidad/index.html`, `terminos/index.html` e `index.csr.html`.

## Google Cloud → Google Auth Platform

Antes llamada "Pantalla de consentimiento de OAuth". El dominio principal es `https://laelsi.com.ar` (sin `www`); `www.laelsi.com.ar` es solo un alias que tiene que **redirigir al principal** (Vercel → Project → Settings → Domains). Usá las URLs finales, sin redirecciones.

| Campo | Valor |
| --- | --- |
| Página principal de la aplicación | `https://laelsi.com.ar` |
| Vínculo a la política de privacidad | `https://laelsi.com.ar/privacidad` |
| Vínculo a las condiciones del servicio | `https://laelsi.com.ar/terminos` |
| Dominios autorizados | `laelsi.com.ar` |
| Orígenes de JavaScript autorizados (cliente OAuth) | `https://laelsi.com.ar` y `https://www.laelsi.com.ar` |

- El dominio tiene que estar verificado en Google Search Console con la misma cuenta propietaria del proyecto de Google Cloud.
- Los permisos solicitados deben ser solo los básicos (`openid`, `email`, `profile`), que es lo que pide Supabase. Si se agrega otro, hay que ampliar la sección 4 de la política.
- Los dos enlaces tienen que responder `200` en producción antes de enviar la solicitud de verificación. En PowerShell usá `curl.exe -I https://laelsi.com.ar/privacidad` (`curl` a secas es un alias de otro comando). Tiene que responder `200` directo, **sin** `308`.
- Mientras `www` siga activo como alias, su origen también tiene que figurar en `ALLOWED_ORIGINS`, en las _Redirect URLs_ de Supabase, en el CORS de los buckets de R2 y en los hostnames de Turnstile. Detalle de qué cargar en cada servicio: [cierre de la revisión de seguridad](../seguridad/cierre-revision-seguridad-y-datos-definitivos-2026-10-22.md).
