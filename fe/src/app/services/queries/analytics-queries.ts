import { inject } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ApiAnalyticsService } from '@services/api-services/api-analytics.service';

// Query reactiva del resumen del panel de analíticas (Panel Admin).
export function injectAnalyticsSummaryQuery() {
  const apiAnalyticsService = inject(ApiAnalyticsService);

  return injectQuery(() => ({
    queryKey: ['analytics', 'summary'],
    queryFn: () => firstValueFrom(apiAnalyticsService.getSummary()),
    // Siempre se vuelve a pedir al entrar: las órdenes se modifican desde otras pantallas (que no
    // pasan por esta capa) y las cifras no pueden quedar viejas. Mientras llega la respuesta nueva
    // se muestra la anterior, así que no hay parpadeo.
    staleTime: 0,
  }));
}
