# Pendiente: un producto con precio con centavos no se puede editar (2026-11-23)

Surgió de una revisión de `products-form`. El dueño del proyecto decidió **mantener el precio entero en el formulario y solo documentar** el problema. Nada de esto está implementado. Este documento tiene lo necesario para que otra persona o IA lo retome sin el contexto de esa sesión.

Sale de **leer el código**. No está confirmado en el navegador.

## Motivo

Cada capa trata el precio de forma distinta:

| Capa | Archivo | Qué admite |
| --- | --- | --- |
| Base | `supabase/migrations/20261012000100_esquema.sql` (tabla `price`) | `amount NUMERIC(12,2) CHECK (amount > 0)`: hasta 2 decimales |
| Servidor, alta y edición | `supabase/functions/products/index.ts` (~línea 381) | cualquier número finito mayor a 0, con decimales |
| Servidor, ajuste masivo | `supabase/functions/bulk-prices/index.ts`, `computeNewPrice` (líneas 49-53) | sin regla de redondeo, **redondea a 2 decimales** (`Math.round(newPrice * 100) / 100`); con `nearest-integer`, `ceil` o `floor` deja enteros |
| Front | `fe/src/app/pages/admin/pages/products-page/products-form/products-form.component.ts` y `.html` | solo enteros: `Validators.pattern(FormUtils.numberPattern)` (`^[0-9]*$`) y la directiva `appNumericInput`, que bloquea el punto y la coma. El input tiene `inputmode="decimal"`, que se contradice con eso |

**Efecto:** después de un ajuste masivo con el redondeo por defecto, un producto puede quedar con un precio como 1234,56. Al editarlo:

- el formulario carga `price: 1234.56`;
- el validador `pattern` lo convierte a texto (`"1234.56"`), no cumple `^[0-9]*$` y el formulario queda inválido;
- el botón "Guardar Cambios" no se habilita aunque se cambie solo el stock, la descripción o las fotos. Hay que reemplazar el precio por un entero, y eso modifica el precio sin querer.

## Cómo reproducirlo

1. En el panel, hacer un ajuste masivo de precios por porcentaje (por ejemplo +7 %) sin elegir redondeo.
2. Abrir para editar un producto cuyo precio haya quedado con decimales.
3. Cambiar solo el stock: "Guardar Cambios" sigue deshabilitado y, si se toca el precio, aparece "Este campo solo acepta números." (el mensaje de `numberPattern` en `FormUtils.getTextError`)

## Arreglo propuesto (elegir uno)

- **A. Aceptar centavos en el formulario** (coincide con la base y el servidor):
  - en `FormUtils`, un patrón `^\d+([.,]\d{1,2})?$` con su mensaje en `getTextError`, o quitar el `pattern` y validar con `min`/`max` y un validador de "como máximo 2 decimales";
  - en el precio, sacar `appNumericInput`, o una variante que admita un solo separador decimal;
  - al guardar, normalizar la coma a punto antes del `Number(...)`;
  - revisar cómo se muestran los precios en la tienda y en el panel (`CurrencyPipe` u otro), para que los centavos se vean bien.
- **B. Mantener enteros en todo el sistema:**
  - que `bulk-prices` redondee siempre a entero, por ejemplo con `nearest-integer` por defecto;
  - una migración o script que redondee los precios vigentes con decimales.

  Toca `supabase/` y datos de producción: requiere pedido expreso.

## Riesgos

- **A:** el `type="number"` del input, con la configuración regional del navegador, puede mostrar coma o punto. Probar en Chrome y en Firefox con el idioma en español.
- **B:** cambia el comportamiento de un ajuste masivo ya conocido por el negocio. El redondeo de los datos existentes se aplica aislado y con pedido expreso (`CLAUDE.md`, migraciones).
- En los dos casos: el historial de precios (`price`) crea una fila nueva cada vez que cambia el precio vigente. Un redondeo masivo generaría muchas filas.

## Pruebas

- **A (temporales, front):**
  - en edición, un producto con precio 1234,56 carga el formulario válido;
  - se puede guardar cambiando solo el stock;
  - el payload lleva `price: 1234.56`;
  - "1234,5" y "1234.567" se comportan según la regla elegida.
- **B (servidor, se conservan):** prueba unitaria de `computeNewPrice` sin regla de redondeo → entero.

## Verificación

1. `npx tsc -p tsconfig.app.json --noEmit`, `npx ngc -p tsconfig.app.json --noEmit` y `ng test --watch=false` en verde. Con la opción B, también `deno test` de `supabase/functions/_tests/`.
2. Repetir los pasos de "Cómo reproducirlo" con la pila local: el producto se puede guardar cambiando solo el stock, y el precio no cambia.

## Reglas del proyecto para quien lo implemente

- Leer `CLAUDE.md` en la raíz.
- Pruebas primero (TDD).
- Comentarios en español, `/* */` sin asteriscos o `//`, sin JSDoc.
- No se commitea ni se despliega sin pedido. `be/` está fuera de alcance.
