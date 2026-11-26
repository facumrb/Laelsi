# Pendiente: la altura de la dirección debería ser texto (2026-11-23)

Surgió al revisar cómo se borra la altura en `clients-form` (panel) y `profile-details` (perfil del cliente). El dueño del proyecto decidió **dejarlo planificado**: nada de esto está implementado. Este documento tiene lo necesario para que otra persona o IA lo retome sin el contexto de esa sesión.

Sale de **leer el código**. No está confirmado en el navegador.

## Motivo

La altura (`streetNumber` / `street_number`) es numérica en todas las capas. Así no se pueden cargar direcciones comunes en Argentina:

- "S/N" (sin número);
- "1234 bis";
- "Km 12" o "Km 12,5", en rutas;
- "123 A".

Hoy la persona no tiene forma de escribirlas: la directiva `appNumericInput` bloquea las letras al teclear.

Hay además un error colateral. El input tiene `maxlength="10"`, pero el `INTEGER` de Postgres llega hasta 2.147.483.647. Una altura como `9999999999` pasa la validación del front y la del servidor (`Number.isInteger`), pero la base la rechaza por desborde. Ese error no es de unicidad, así que `rethrowUnique` lo deja pasar y lo más probable es que termine en un 500 genérico. No está probado.

## Cómo está hoy

| Capa | Archivo | Definición |
| --- | --- | --- |
| Base | `supabase/migrations/20261012000100_esquema.sql:48` | `street_number INTEGER` (al lado, `floor` y `apartment` son `VARCHAR(5)`) |
| Servidor | `supabase/functions/_shared/usuarios.ts`, `toProfileColumns` (líneas 161-166) | `Number()` + `Number.isInteger`, si no, 400 "El número de calle debe ser un número entero"; `''` pasa a `null` |
| Modelo | `fe/src/app/models/user.model.ts` | `IApiClient.streetNumber?: number`; `IUpdateClient.streetNumber?: number \| null` |
| Panel | `fe/src/app/pages/admin/pages/clients-page/clients-form/clients-form.component.ts` y `.html` | control de texto con `FormUtils.maxLength(10)`, input con `appNumericInput`; al cargar `.toString()`, al guardar `Number(...)` (en edición, vacío → `null`; en alta, `undefined`) |
| Perfil del cliente | `fe/src/app/pages/client/pages/profile-page/components/profile-details/profile-details.component.ts` y `.html` | control `''`, input con `appNumericInput`; al cargar `String(...)`, al guardar `Number(...)` o `null` |

Los pedidos no guardan ni leen la dirección del cliente. Pasarla a texto no afecta otros flujos. Para confirmarlo, buscar `street` en `fe/src` y `supabase/functions`.

## Diseño propuesto

### 1. Base: migración nueva

Archivo `supabase/migrations/<fecha>000100_altura_como_texto.sql`, siguiendo la numeración de las existentes (la última es `20261106000300_estado_pausado.sql`):

```sql
-- La altura admite letras ("S/N", "1234 bis", "Km 12"): pasa de INTEGER a texto
ALTER TABLE "user"
  ALTER COLUMN street_number TYPE VARCHAR(10) USING street_number::text;
```

Los valores actuales se conservan como texto y los `NULL` siguen en `NULL`. Revisar si alguna vista, función SQL o política RLS menciona `street_number`:

```
grep -rn street_number supabase/migrations
```

Hoy solo aparece en el esquema.

### 2. Servidor

- `usuarios.ts`, `toProfileColumns`: borrar el bloque que convierte a entero y responde 400.
- `campos-usuario.ts`: agregar `'streetNumber'` a `CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO`, para que `''` y los textos de solo espacios pasen a `NULL`. Actualizar sus comentarios.
- Opcional: aprovechar y pasar también a `NULL` el resto de la dirección (`street`, `city`, `province`, `postalCode`, `floor`, `apartment`). Hoy borrarlos guarda `''` en la base, y cualquier edición desde el panel deja en `''` los campos que estaban en `NULL`. No se nota en pantalla, pero deja datos mezclados.
- **Relación con B4:** el pendiente `docs/deuda-tecnica/pendiente-cuit-no-se-puede-borrar-2026-11-23.md` toca la misma lista y el mismo `sanitizeUserInput`. Conviene hacerlos juntos y desplegar una sola vez.

### 3. Front

- `user.model.ts`:
  - `IApiClient.streetNumber?: string`;
  - en `IUpdateClient`, quitar el `Omit` de `'streetNumber'` y el campo `streetNumber?: number | null` que se agregó para poder borrarla (con texto alcanza con `''`).
- `clients-form.component.ts`:
  - al cargar, `client.streetNumber ?? ''`;
  - al guardar, `streetNumber: optionalText(formValue.streetNumber)`, como el resto de la dirección. Sin `Number(...)` ni `null`.
- `clients-form.component.html`:
  - quitar `appNumericInput` e `inputmode="numeric"` del input `streetNumber`, y `NumericInputDirective` de `imports` si deja de usarse (DNI y CUIT lo siguen usando);
  - el placeholder puede pasar a "Ej: 1234 o S/N".
- `profile-details.component.ts` y `.html`: lo mismo. Al cargar `fullUser.streetNumber ?? ''`, al guardar `rawValue.streetNumber` y sin la directiva.
- Validación (opcional): además de `FormUtils.maxLength(10)`, un patrón suave en `FormUtils`, por ejemplo `^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s/.,-]*$`, con su mensaje en `getTextError`. Si se agrega, el servidor debería validar lo mismo, y entonces es una constante compartida entre capas: lleva prueba de concordancia en `supabase/functions/_tests/` (patrón de `tipo_ajuste_precios_unit_test.ts`) y comentarios cruzados en cada lado.

## Riesgos

- **Orden del despliegue.** Si se despliega el front antes que la migración, un valor como "S/N" fallaría en la base. Si se despliega la migración antes que el servidor, el servidor viejo sigue convirtiendo a entero (no rompe, pero rechaza letras). Orden recomendado: migración → funciones → front.
- **Migraciones en producción** (`CLAUDE.md`):
  - aplicar esta migración aislada, sin otras pendientes de desarrollo;
  - revisar antes el estado de las migraciones en producción;
  - hacerlo solo con pedido expreso del dueño del proyecto.
- **Orden de los datos.** Un listado ordenado por altura pasaría de orden numérico a alfabético. Hoy no hay ninguno.
- **Prueba existente.** `supabase/functions/_tests/campos_usuario_unit_test.ts` usa `streetNumber: 0` como ejemplo de campo "que no es texto". Si `streetNumber` pasa a la lista de opcionales, hay que cambiar ese ejemplo por otro campo, sin alterar lo que la prueba comprueba.

## Pruebas (TDD)

- **Servidor (se conservan, lógica pura):**
  - en `campos_usuario_unit_test.ts`, `textosVaciosANulos({ streetNumber: '' }, CAMPOS_CLIENTE_OPCIONALES_DE_TEXTO)` devuelve `streetNumber: null`;
  - con `'S/N'` queda igual.

  Escribirlas primero, en rojo.

- **Front (temporales, se borran al terminar):**
  - clients-form y profile-details cargan `'S/N'` tal cual;
  - al guardar mandan `streetNumber: 'S/N'`;
  - borrarla manda `''` en edición;
  - el input acepta letras (sin `appNumericInput`).

## Verificación

1. `npx tsc -p tsconfig.app.json --noEmit` y `npx ngc -p tsconfig.app.json --noEmit` sin errores, desde `fe/`.
2. `ng test --watch=false` en verde y `deno test` de `supabase/functions/_tests/` en verde.
3. Con la pila local (Docker) y la migración aplicada:
   - cargar "S/N", "1234 bis" y "Km 12" desde el panel y desde "Mi perfil", reabrir → se conservan;
   - borrar la altura → queda vacía (NULL en la base);
   - un cliente con altura numérica anterior (por ejemplo 1234) la sigue viendo igual.
4. Recién después, y con pedido expreso: migración en producción (aislada), despliegue de `clients` y `auth`, y despliegue del front.

## Reglas del proyecto para quien lo implemente

- Leer `CLAUDE.md` en la raíz.
- Pruebas primero (TDD).
- Comentarios en español, `/* */` sin asteriscos o `//`, sin JSDoc.
- No se commitea ni se despliega sin pedido. `be/` está fuera de alcance.
