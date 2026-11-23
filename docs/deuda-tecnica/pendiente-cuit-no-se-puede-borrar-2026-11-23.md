# Pendiente: el CUIT de un cliente no se puede borrar (2026-11-23)

Surgió de una revisión de `clients-form` (panel) y `profile-details` (perfil del cliente). El dueño del proyecto decidió **solo documentarlo**: nada de esto está implementado. Este documento tiene lo necesario para que otra persona o IA lo retome sin el contexto de esa sesión.

Sale de **leer el código**. No está confirmado en el navegador.

## Motivo

`sanitizeUserInput`, en `supabase/functions/_shared/usuarios.ts`, hace:

```ts
if (input.cuit === '') delete input.cuit;
```

Lo hace para que un CUIT vacío (`''`) no choque con otro en el índice único `user_cuit_key` (`supabase/migrations/20261012000100_esquema.sql`): el índice trata `''` como un valor, a diferencia de `NULL`, que se puede repetir. Pero al borrar la clave, `updateUser` no toca la columna y **el CUIT guardado queda como estaba**.

Pasa en las dos pantallas que editan clientes:

- **Panel, `clients-form`**: además, en el front se manda `cuit: formValue.cuit || undefined`, así que el CUIT vacío ni siquiera viaja.
- **Perfil del cliente, `profile-details`**: manda `cuit: rawValue.cuit` (`''`), y el servidor lo descarta.

En los dos casos se muestra "Guardado exitosamente".

## Cómo reproducirlo

1. Editar un cliente que tenga CUIT, desde el panel o desde "Mi perfil".
2. Borrar el CUIT y guardar. Aparece el aviso de éxito.
3. Volver a abrir el cliente: el CUIT sigue ahí.

## Arreglo propuesto

1. `supabase/functions/_shared/campos-usuario.ts`: agregar `'cuit'` a `CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO`. Actualizar su comentario y el de la cabecera, que hoy hablan de "nombre, apellido, teléfono y DNI". `textosVaciosANulos` pasa el `''` a `NULL`.
2. `supabase/functions/_shared/usuarios.ts`: borrar la línea `if (input.cuit === '') delete input.cuit;` y actualizar el comentario de `sanitizeUserInput`.
3. `fe/src/app/pages/admin/pages/clients-page/clients-form/clients-form.component.ts`, en `onSubmit`: en edición, mandar `cuit: formValue.cuit` en vez de `formValue.cuit || undefined`, igual que los campos de la dirección (ver `optionalText`). En alta puede seguir `undefined`.

`profile-details` no necesita cambios: ya manda `''`.

## Riesgos

- La búsqueda de duplicados en el alta (`${columns.cuit ? sql\`or cuit = …\` : sql\`\`}`, en `usuarios.ts`) ya ignora `null`.
- `sanitizeUserInput` lo usan también el registro y las otras rutas que crean o editan usuarios: revisar que ninguna dependa de que el `cuit` vacío desaparezca. Para los administradores no aplica, porque el campo no está entre los permitidos.
- El validador asíncrono `check_field_unique` (`supabase/migrations/20261021000100_limite_check_field_unique.sql`) no se llama con el campo vacío (`FormUtils.uniqueFieldValidator` corta antes).

## Pruebas

- En `supabase/functions/_tests/campos_usuario_unit_test.ts` (se conserva, es lógica pura del servidor): `textosVaciosANulos({ cuit: '' }, CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO)` devuelve `cuit: null`, y un CUIT con valor queda igual. Escribirla primero, en rojo.
- Front (temporal): en edición, `clients-form` manda `cuit: ''` cuando se borra.

## Despliegue y verificación

1. `deno test` de `supabase/functions/_tests/` en verde.
2. Con la pila local (Docker): borrar el CUIT de un cliente desde el panel y desde "Mi perfil", reabrirlo → queda vacío. Dos clientes sin CUIT conviven sin error 409.
3. Hay que desplegar en Supabase las funciones que usan `sanitizeUserInput` con clientes: `clients` (alta y edición desde el panel y el perfil) y `auth` (registro). `admins` también la usa, pero con el rol `Admin`, que no incluye el CUIT. Escribir en el proyecto remoto requiere un **pedido expreso** del dueño del proyecto.

## Reglas del proyecto para quien lo implemente

- Leer `CLAUDE.md` en la raíz.
- Pruebas primero (TDD).
- Comentarios en español, `/* */` sin asteriscos o `//`, sin JSDoc.
- No se commitea ni se despliega sin pedido. `be/` está fuera de alcance.
