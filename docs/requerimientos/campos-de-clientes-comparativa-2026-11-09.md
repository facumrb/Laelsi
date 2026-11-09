# Campos de clientes: formularios, base de datos y funciones (2026-11-09)

Responde al ID 71 de [discusiones.md](./discusiones.md): comparar qué piden los formularios, cómo está hecha la base (Supabase y el `be` anterior) y cuál es el mínimo de datos posible para no abrumar al cliente. **Resultado: el alta desde el panel era la única puerta que pedía de más; ya se alineó con la base y con el registro propio** (cambio hecho y probado, ver el final).

## Respuesta corta

- **El mínimo es nombre de usuario, correo y contraseña.** Es lo que la base ya acepta (`username` y `email` son `NOT NULL`; la contraseña vive en Supabase Auth, no en la tabla), lo que pide el registro propio y lo que decía el ID 71 que se pedía.
- **Nombre, apellido, teléfono y DNI son opcionales** para un cliente. Dirección, CUIT y condición fiscal ya lo eran.
- **El panel pedía siete campos** (usuario, correo, contraseña, nombre, apellido, teléfono y DNI). Venía del `be` anterior, donde la entidad ya los aceptaba vacíos pero el servicio los exigía.

## La comparativa

| Dato | Formulario del panel (antes) | Registro propio | Acceso con Google | Base de datos (`user`) | Función `createUser` (antes) | `be` anterior |
| --- | --- | --- | --- | --- | --- | --- |
| Nombre de usuario | Obligatorio | Obligatorio | Se genera del correo | `NOT NULL`, único sin distinguir mayúsculas | Obligatorio | `nullable: false`, único |
| Correo | Obligatorio | Obligatorio | Lo da Google | `NOT NULL`, único sin distinguir mayúsculas | Obligatorio | `nullable: false`, único |
| Contraseña | Obligatoria al crear | Obligatoria | No tiene | No está en la tabla (Supabase Auth) | Obligatoria | `nullable: false` (en su propia tabla) |
| Nombre | **Obligatorio** | No lo pide | Lo da Google | Opcional (`NULL`) | **Obligatorio** | Opcional en la entidad, **obligatorio en el servicio** |
| Apellido | **Obligatorio** | No lo pide | Vacío (`''`) si Google no lo separa | Opcional (`NULL`) | **Obligatorio** | Ídem |
| Teléfono | **Obligatorio** | No lo pide | No lo da | Opcional (`NULL`) | **Obligatorio** | Ídem |
| DNI | **Obligatorio** | No lo pide | No lo da | Opcional (`NULL`), **único** | **Obligatorio** | Ídem, único |
| CUIT y condición fiscal | Opcional | No lo pide | No lo da | Opcional; condición por defecto "Consumidor Final" | Opcional | Opcional |
| Dirección (calle, número, ciudad, provincia, código postal, piso, depto.) | Opcional | No lo pide | No lo da | Opcional | Opcional | Opcional |

Datos verificados en: `fe/.../clients-form.component.ts`, `fe/.../register-page.component.ts`, `supabase/migrations/20261012000100_esquema.sql` y `20261012000200_auth_trigger.sql`, `supabase/functions/_shared/usuarios.ts` y `be/src/user/`.

## Hallazgos

1. **El panel era más estricto que todo lo demás.** El registro propio, el acceso con Google y la base ya admitían clientes sin nombre, teléfono ni DNI: por esas dos vías se pueden crear hoy.
2. **Un riesgo de datos que había que cerrar.** El DNI tiene índice único, y para ese índice `''` (texto vacío) **es un valor** que se repetiría, mientras que `NULL` se puede repetir sin problema. Al volver el DNI opcional, un DNI vacío tiene que guardarse como `NULL`, no como `''`; si no, el segundo cliente cargado sin DNI daría "ya existe". Está resuelto en el servidor (y probado).
3. **Mostrar a un cliente sin nombre.** El detalle del pedido armaba el nombre con una plantilla de texto y mostraba **"null null"** para un cliente sin nombre; las listas lo mostraban en blanco. Ya se muestra el correo (en los pedidos) o "Sin nombre" (en la lista de clientes).
4. **Quién necesita cada dato, de verdad:**
   - **Nombre y apellido:** solo para mostrar. Nada de la venta depende de ellos.
   - **Teléfono:** lo usa el botón de WhatsApp del detalle del pedido para que el negocio contacte al cliente. Ya está contemplado el caso sin teléfono: no se muestra el botón. Es el único dato que conviene tener **al hacer un pedido**, no al crear la cuenta.
   - **DNI, CUIT y condición fiscal:** solo importan para facturar. Hoy no se factura desde el sistema, y cuando se haga (ver [facturacion-electronica-arca-2026-11-09.md](./facturacion-electronica-arca-2026-11-09.md)) se piden **en ese momento**, no al registrarse. Lo que exige la ley para cada tipo de factura lo confirma el profesional de la puerta de apertura.
   - **Dirección:** solo para envíos, que hoy no se hacen ("por el momento no hacemos envíos").

## Qué se cambió en el sistema actual (hecho y probado)

- **Servidor.** `supabase/functions/_shared/campos-usuario.ts` define qué campos pide cada alta: `minimo` (usuario, correo y contraseña) para los **clientes**, tanto en el registro propio como desde el panel, y `completo` para los **administradores**, que no cambian. Los textos vacíos de nombre, apellido, teléfono y DNI pasan a `NULL`. 11 pruebas nuevas en `_tests/campos_usuario_unit_test.ts`, con rojo previo.
- **Formulario del panel.** Nombre, apellido, DNI y teléfono dejaron de ser obligatorios (sin asterisco); **si se cargan, se siguen validando** (largo y formato). 11 pruebas nuevas en `clients-form.component.spec.ts`, con rojo previo.
- **Pantallas.** El nombre de quien hizo un pedido y la lista de clientes toleran los datos faltantes (`NombrePersonaPipe`, 7 pruebas).
- **Suites:** Deno 107 pasan (más el fallo esperado de E0c) y `fe/` 253 pasan; el chequeo de tipos de toda la aplicación no da errores.

## Lo que no se tocó, y por qué

- **Los administradores siguen con el perfil completo.** Un administrador es una persona identificada que opera el negocio; la discusión del ID 71 habla solo de clientes.
- **La contraseña sigue siendo obligatoria al crear un cliente desde el panel.** Supabase Auth necesita una credencial. El diseño decidido para el sistema nuevo la elimina: el negocio carga nombre y teléfono (o correo) **sin contraseña**, como perfil de invitado con invitación opcional, y el panel no crea cuentas con contraseña de terceros (etapas E2b y E0d). Lo de hoy es el paso intermedio.
- **El formulario del perfil del propio cliente** (`profile-details`) sigue exigiendo nombre, apellido, DNI, correo y teléfono para guardar. Ver la pregunta 1.

## Para decidir

1. **¿Se relaja también el perfil del propio cliente?** Hoy, un cliente creado con lo mínimo (desde el panel o por el registro propio) que entra a "Mi perfil" tiene que completar DNI y teléfono para poder guardar cualquier cambio, aunque solo quiera cambiar el correo. Es la misma lógica de no abrumar. **Recomiendo** hacerlo igual que el panel: opcionales, y validar el formato solo si se cargan. Costo: un cambio chico en `profile-details` y sus pruebas.
2. **¿Se pide el teléfono al confirmar un pedido si el cliente no lo tiene?** El negocio lo necesita para coordinar el retiro y el pago, y es el único momento en que de verdad hace falta. **Recomiendo** pedirlo ahí (un campo, solo si falta, y que se guarde en el perfil), en la etapa del Pedido (E2b), no ahora.
