-- ============================================================================
-- 010 · Estado Activo / Inactivo de clientes y administradores
-- ============================================================================
-- Discusión del ID 65 (docs/requerimientos/discusiones.md): clientes y administradores pasan a
-- tener un estado para poder DESACTIVARLOS en vez de borrarlos. Hoy borrar a un cliente borra en
-- cascada sus Pedidos ("order".client_id ... ON DELETE CASCADE): se pierde el historial de ventas.
--
-- Esta migración es de la línea del sistema ACTUAL (20261106…): va antes de las de multi-tenant.
--
-- Pruebas: 8.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select has_enum('public', 'user_state', 'existe el tipo user_state');
select enum_has_labels('public', 'user_state', array['Activo', 'Inactivo'], 'user_state: Activo e Inactivo');
select col_type_is('public', 'user', 'state', 'user_state', 'user.state es user_state');
select col_not_null('public', 'user', 'state', 'user.state es obligatorio');
select has_index('public', 'user', 'user_state_idx', 'user.state tiene índice');

-- Un usuario nuevo nace Activo. La prueba sirve con y sin multi-tenant: si existe la tabla tenant, hace falta un
-- negocio en el contexto del pedido.
do $$
begin
  if to_regclass('public.tenant') is not null then
    perform set_config('app.tenant_id', (select id::text from public.tenant where slug = 'laelsi'), true);
  end if;
end $$;
insert into public."user" (username, email) values ('prueba_estado', 'prueba_estado@ejemplo.test');

select is(
  (select state::text from public."user" where username = 'prueba_estado'),
  'Activo',
  'un usuario nuevo nace Activo'
);

-- Se puede desactivar y reactivar
update public."user" set state = 'Inactivo' where username = 'prueba_estado';
select is(
  (select state::text from public."user" where username = 'prueba_estado'),
  'Inactivo',
  'un usuario se puede desactivar'
);

-- Un valor inválido se rechaza
select throws_ok(
  $$ update public."user" set state = 'Borrado' where username = 'prueba_estado' $$,
  '22P02', null, 'un estado inválido se rechaza'
);

select * from finish();
rollback;
