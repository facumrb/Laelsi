import { inject, Signal } from '@angular/core';
import {
  injectMutation,
  injectQuery,
  keepPreviousData,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../api-services/api-client.service';
import { UserState, UserStateFilter } from '../../models/user.model';

export interface IClientQueryFilters {
  query: string;
  fiscalCondition: string;
  state: UserStateFilter;
  page: number;
  limit: number;
}

/**
 * Query reactiva del listado de clientes (Panel Admin).
 * Son datos personales: se quitan de memoria a los 5 minutos sin uso (no 15 como el catálogo)
 * y nunca se persisten en el navegador. El logout vacía la caché entera.
 */
export function injectAllClientsQuery(
  filtersSignal: Signal<IClientQueryFilters>,
) {
  const apiClientService = inject(ApiClientService);

  return injectQuery(() => {
    const filters = filtersSignal();
    const query = filters.query.trim();

    return {
      queryKey: ['clients', 'list', { ...filters, query }],
      queryFn: () =>
        firstValueFrom(
          // El endpoint de búsqueda no recibe la condición fiscal
          query
            ? apiClientService.searchClients(
                query,
                filters.page,
                filters.limit,
                filters.state,
              )
            : apiClientService.getAllClients(
                filters.page,
                filters.limit,
                filters.fiscalCondition,
                filters.state,
              ),
        ),
      staleTime: 1000 * 60 * 2, // 2 minutos
      gcTime: 1000 * 60 * 5, // 5 minutos
      placeholderData: keepPreviousData,
    };
  });
}

/**
 * Devuelve una función que invalida los listados de clientes. La usa el formulario de
 * alta/edición, que escribe llamando a la API directamente.
 */
export function injectInvalidateClients(): () => void {
  const queryClient = inject(QueryClient);
  return () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };
}

/**
 * Mutación para desactivar o reactivar un cliente
 */
export function injectSetClientStateMutation() {
  const apiClientService = inject(ApiClientService);
  const invalidateClients = injectInvalidateClients();

  return injectMutation(() => ({
    mutationFn: ({ id, state }: { id: number; state: UserState }) =>
      firstValueFrom(apiClientService.setClientState(id, state)),
    onSuccess: () => {
      invalidateClients();
    },
  }));
}
