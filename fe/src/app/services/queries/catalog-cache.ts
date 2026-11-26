import { inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';

/*
 Devuelve una función que invalida todo el caché del catálogo (productos y categorías).

 Se invalidan siempre los dos juntos porque están acoplados:
 - El listado de categorías trae sus productos asociados (de ahí sale el contador del panel admin).
 - Los listados públicos de productos dependen del estado de su categoría.

 Sirve para las pantallas que modifican datos llamando a la API directamente
 (formularios, modales, pedidos), ya que en ese caso TanStack Query no se entera del cambio.

 Debe llamarse en un contexto de inyección (inicializador de campo o constructor).
*/
export function injectInvalidateCatalog(): () => void {
  const queryClient = inject(QueryClient);

  return () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };
}
