import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, of, switchMap } from 'rxjs';
import { AuthService } from '@services/auth.service';
import { environment } from 'src/environments/environment';
import { PETICION_PUBLICA } from './peticion-publica';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo se autentican las peticiones a nuestro backend (Edge Functions y API de Supabase).
  // Las demás deben salir intactas: en particular, la subida de imágenes a Cloudflare R2
  // usa una URL prefirmada, y agregarle el header Authorization hace que R2 la rechace.
  if (!req.url.startsWith(environment.supabaseUrl)) {
    return next(req);
  }

  if (req.context.get(PETICION_PUBLICA)) {
    return next(req);
  }

  const authService = inject(AuthService);

  // Si ya tenemos el token en memoria, lo entregamos de forma síncrona inmediata (0ms).
  // Solo si no está en memoria (ej: recarga inicial de página), esperamos a getAccessToken().
  const cachedToken = authService.getToken();
  const token$ = cachedToken ? of(cachedToken) : from(authService.getAccessToken());

  return token$.pipe(
    switchMap((token) => {
      // apikey identifica al proyecto de Supabase (es la clave pública).
      const headers: Record<string, string> = {
        apikey: environment.supabaseAnonKey,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return next(req.clone({ setHeaders: headers }));
    }),
  );
};
