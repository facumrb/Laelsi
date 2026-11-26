# Seguridad

[Volver al índice de la documentación](../README.md)

- **Las escrituras pasan siempre por las Edge Functions**, que validan la sesión y el rol antes de tocar datos. Las políticas RLS son la segunda barrera: con la clave pública solo se puede _leer_ lo que corresponde a cada usuario.
- **Las contraseñas las guarda Supabase Auth**, nunca nuestras tablas. El rol (Admin / Client) vive en la tabla `user` y solo lo puede asignar el backend.
- **Las imágenes se suben con URLs prefirmadas** que vencen a los 5 minutos y solo aceptan WebP. El nombre del archivo lo decide el servidor.
- **Límite de intentos de login**: 5 intentos fallidos por IP cada 15 minutos. La IP sale de `CF-Connecting-IP` o, si no está, del último valor de `X-Forwarded-For`, nunca del primero, que controla el navegador. Un login correcto no reinicia el contador.
- **Validación en vivo de los formularios** (`check_field_unique`, que el navegador llama directo a la API REST): 30 consultas por minuto por IP.
- **Listados completos de productos y categorías** (con inactivos, stock y ventas): solo para administradores. La tienda usa los endpoints de productos activos.
- **Recuperación de contraseña**:
  - La respuesta es siempre la misma, exista o no la cuenta: no se puede usar para averiguar qué emails están registrados.
  - El enlace vence a la hora, sirve una sola vez y queda anulado si se pide otro. En la base se guarda su hash, no el enlace.
  - El destino del enlace sale de `SITE_URL`, nunca de un dato que envíe el navegador.
  - Límites: 3 correos por hora por cuenta y 5 solicitudes cada 15 minutos por IP, más Turnstile si está configurado. Protegen la cuota de Resend.
- **Botón de arrepentimiento** (`POST /revocations`, público por exigencia de la norma): Turnstile, tope de 5 solicitudes por hora por IP y validación de todos los campos en el servidor. Los textos que escribe la persona se escapan antes de ir en el correo al comercio.
- **Pantallas de acceso**: si la persona sale y vuelve, se conserva el usuario o email que había escrito (en `sessionStorage`, hasta cerrar la pestaña). La contraseña nunca se guarda: la completa el navegador o el gestor de contraseñas.
- **Cambiar el email o la contraseña de la propia cuenta exige la contraseña actual**, verificada en el servidor (`PATCH /clients/:id` y `PATCH /admins/:id`). Con solo el token de sesión (por ejemplo, robado con un XSS) no alcanza para quedarse con la cuenta. Un administrador que edita a otra persona no la necesita, y las cuentas de solo Google (sin contraseña) tampoco. Los intentos fallidos cuentan para el mismo límite de login, que ahora también protege `verify-password`.
- **Las contraseñas se leen tal cual llegan**: el servidor ya no les recorta los espacios ni colapsa los repetidos. Las cuentas anteriores se guardaron normalizadas, así que el login prueba también esa versión (`_shared/contrasenas.ts`).
- **Turnstile falla cerrado en producción**: si falta `TURNSTILE_SECRET_KEY`, el checkout, el registro, la recuperación de contraseña y el botón de arrepentimiento responden 500 en vez de omitir la verificación. Solo se omite en el stack local de Supabase (`http://`). El registro público ahora también lleva Turnstile y un tope de 10 registros por hora por IP.
- **Una orden o una foto ajena responden igual que una inexistente (404)**, y sin sesión siempre es 401: los IDs son secuenciales y la respuesta no sirve para averiguar cuáles existen.
- **El trigger de alta de cuentas** (`handle_new_auth_user`) solo vincula por email un perfil existente si el email de la cuenta nueva está confirmado y el perfil no tiene ya otra cuenta. `create_order` rechaza productos con precio fuera de ARS, y todas las funciones `SECURITY DEFINER` fijan `search_path = public, pg_temp`.
- **Content-Security-Policy en modo solo reporte** (`fe/vercel.json`): no bloquea nada todavía. Mirá la consola del navegador durante un tiempo y, cuando no aparezcan violaciones legítimas, cambiá la cabecera a `Content-Security-Policy` para que se aplique.
- **Las reglas de WAF de Cloudflare protegen el sitio, no la API**: las Edge Functions se sirven desde `*.supabase.co`, que no pasa por tu zona de Cloudflare. La protección de la API es la de arriba (validaciones, Turnstile y límite de login).
