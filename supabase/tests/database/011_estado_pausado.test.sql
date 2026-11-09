-- ============================================================================
-- 011 · Estado "Pausado" de los productos
-- ============================================================================
-- Discusión del ID 54 (docs/requerimientos/discusiones.md): una publicación Pausada SE VE en la
-- tienda como "no disponible por ahora"; una Inactiva NO aparece. Son estados distintos, y el stock
-- (disponibilidad física) es independiente de la publicación (disponibilidad comercial).
--
-- Pruebas: 3.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select enum_has_labels(
  'public', 'product_state', array['Activo', 'Inactivo', 'Pausado'],
  'product_state: Activo, Inactivo y Pausado'
);

-- Un producto se puede crear Pausado, con stock (la pausa no toca el stock)
-- La prueba sirve con y sin multi-tenant: si existe la tabla tenant, hace falta un negocio en el contexto del pedido.
do $$
begin
  if to_regclass('public.tenant') is not null then
    perform set_config('app.tenant_id', (select id::text from public.tenant where slug = 'laelsi'), true);
  end if;
end $$;
insert into public.category (name) values ('Categoria de prueba pausado');
select lives_ok(
  $$ insert into public.product (name, description, brand, stock, state, category_id)
     values ('Producto pausado', 'd', 'm', 7, 'Pausado',
             (select id from public.category where name = 'Categoria de prueba pausado')) $$,
  'se puede crear un producto Pausado'
);
select is(
  (select stock from public.product where name = 'Producto pausado'),
  7,
  'la pausa no toca el stock'
);

select * from finish();
rollback;
