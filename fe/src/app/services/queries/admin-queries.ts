import { inject, Signal } from '@angular/core';
import {
  injectMutation,
  injectQuery,
  keepPreviousData,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ApiAdminService } from '../api-services/api-admin.service';
import { UserState, UserStateFilter } from '@models/user.model';

export interface IAdminQueryFilters {
  query: string;
  state: UserStateFilter;
  page: number;
  limit: number;
}

/**
 * Query reactiva del listado de administradores (Panel Admin).
 * Son datos personales: se quitan de memoria a los 5 minutos sin uso (no 15 como el catálogo)
 * y nunca se persisten en el navegador. El logout vacía la caché entera.
 */
export function injectAllAdminsQuery(
  filtersSignal: Signal<IAdminQueryFilters>,
) {
  const apiAdminService = inject(ApiAdminService);

  return injectQuery(() => {
    const filters = filtersSignal();
    const query = filters.query.trim();

    return {
      queryKey: ['admins', 'list', { ...filters, query }],
      queryFn: () =>
        firstValueFrom(
          query
            ? apiAdminService.searchAdmins(
                query,
                filters.page,
                filters.limit,
                filters.state,
              )
            : apiAdminService.getAllAdmins(
                filters.page,
                filters.limit,
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
 * Devuelve una función que invalida los listados de administradores. La usan las pantallas
 * que escriben llamando a la API directamente (formulario de alta/edición y perfil).
 */
export function injectInvalidateAdmins(): () => void {
  const queryClient = inject(QueryClient);
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admins'] });
  };
}

/**
 * Mutación para desactivar o reactivar un administrador
 */
export function injectSetAdminStateMutation() {
  const apiAdminService = inject(ApiAdminService);
  const invalidateAdmins = injectInvalidateAdmins();

  return injectMutation(() => ({
    mutationFn: ({ id, state }: { id: number; state: UserState }) =>
      firstValueFrom(apiAdminService.setAdminState(id, state)),
    onSuccess: () => {
      invalidateAdmins();
    },
  }));
}
