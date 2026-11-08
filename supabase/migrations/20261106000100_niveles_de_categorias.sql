-- ============================================================================
-- Más niveles de subcategorías
-- ============================================================================
-- Los negocios necesitan más de tres niveles de subcategorías. La restricción original,
-- CHECK (depth BETWEEN 0 AND 2), fijaba el límite en tres. Esta migración la reemplaza por un TOPE DE
-- CORDURA (0 a 9) y deja la política (cuántos niveles se permiten de verdad: hoy 5) en el código:
-- supabase/functions/_shared/profundidad-categorias.ts y fe/src/app/models/category.model.ts.
--
-- Por qué no poner acá el 4, que es lo que se permite hoy: cada vez que cambie la política (y se prevé
-- que pase a ser un ajuste del negocio o de su plan) habría que migrar la base en producción. Con un tope
-- más alto, cambiar la política es cambiar una constante. Una prueba
-- (supabase/functions/_tests/profundidad_categorias_unit_test.ts) falla si alguien sube la política por
-- encima de este tope.
--
-- La columna `depth` no se toca: ninguna fila existente tiene más de 2, así que la nueva restricción las
-- admite a todas.
--
-- ORDEN DE APLICACIÓN en producción: primero esta migración, después `functions:deploy` de `categories`
-- y por último el frontend. Al revés, la función permitiría 5 niveles y la base rechazaría el cuarto.
--
-- Esta migración lleva una versión ANTERIOR a las de la etapa E0 (20261107...) a propósito: así, cuando
-- se apliquen en orden, la CLI no se queja de migraciones "insertadas antes de la última aplicada".
--
-- Para volver atrás: recrear la restricción con un tope de 2. Solo funciona si ninguna categoría tiene
-- ya más de tres niveles; si la hay, primero hay que reubicarla.
-- ============================================================================

ALTER TABLE category DROP CONSTRAINT IF EXISTS category_depth_check;

ALTER TABLE category ADD CONSTRAINT category_depth_check CHECK (depth BETWEEN 0 AND 9);
