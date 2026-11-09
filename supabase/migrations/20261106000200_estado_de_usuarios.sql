-- ============================================================================
-- Estado Activo / Inactivo de clientes y administradores
-- ============================================================================
-- Discusión del ID 65 (docs/requerimientos/discusiones.md): por ahora no se elimina físicamente a
-- ningún cliente ni administrador, solo se los DESACTIVA. Borrar a un cliente borraba en cascada sus
-- Pedidos ("order".client_id ... ON DELETE CASCADE) y se perdía el historial de ventas.
--
-- Un usuario Inactivo conserva todos sus datos y su historial, pero no puede operar: el servidor
-- rechaza sus pedidos con 403 (requireUser en supabase/functions/_shared/auth.ts).
--
-- ORDEN DE ESTA MIGRACIÓN. Es de la línea del sistema ACTUAL (20261106…): va ANTES de las de
-- multi-tenant (20261107…), que todavía no se pueden desplegar a producción (CLAUDE.md). Tiene que
-- aplicarse a producción ANTES de desplegar las funciones `admins`, `clients` y `auth`, porque estas
-- leen la columna nueva.
--
-- Reversa (no hay datos de otras tablas involucrados):
--   DROP INDEX user_state_idx; ALTER TABLE "user" DROP COLUMN state; DROP TYPE user_state;
-- ============================================================================

CREATE TYPE user_state AS ENUM ('Activo', 'Inactivo');

-- Los usuarios existentes quedan Activos (valor por defecto constante: no reescribe la tabla)
ALTER TABLE "user" ADD COLUMN state user_state NOT NULL DEFAULT 'Activo';

CREATE INDEX user_state_idx ON "user" (state);
