import {
  ApplicationConfig,
  inject,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { provideServiceWorker } from '@angular/service-worker';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { AppUpdateService } from '@services/app-update.service';
import { NavigationHistoryService } from '@services/navigation-history.service';
import { SeoService } from '@services/seo.service';

registerLocaleData(localeEsAr);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutos: tiempo por defecto en que un dato se considera fresco
      gcTime: 1000 * 60 * 15, // 15 minutos: tiempo que un dato sin uso permanece en memoria
      refetchOnWindowFocus: false, // Evita recargar al cambiar de pestaña o abrir las DevTools
      // Sin reintentos automáticos: el errorInterceptor muestra una alerta por cada
      // petición fallida, así que reintentar duplicaría el mensaje de error.
      retry: false,
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor]),
    ),
    provideTanStackQuery(queryClient),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    provideAppInitializer(() => {
      inject(NavigationHistoryService);
      inject(SeoService);
      // Pregunta si actualizar cuando hay una versión nueva del sitio (si no, el navegador sigue mostrando la vieja)
      inject(AppUpdateService).iniciar();
    }),
  ],
};
