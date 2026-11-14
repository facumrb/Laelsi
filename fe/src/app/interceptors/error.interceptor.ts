import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap } from 'rxjs';
import { ApiErrorService } from '@services/api-services/api-error.service';
import { AuthService } from '@services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const apiErrorService = inject(ApiErrorService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Ante un 401 fuera del login se renueva el token y se reintenta una vez
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        return authService.refreshToken().pipe(
          switchMap(() => {
            // El reintento no vuelve a pasar por authInterceptor (va antes en la cadena): por eso el
            // token nuevo se pone a mano
            const newToken = authService.getToken();
            const clonedReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`,
              },
            });
            return next(clonedReq);
          }),
          catchError((refreshError) => {
            // Llega acá si falla la renovación (el AuthService ya cierra la sesión) o el reintento
            apiErrorService.handle(error, req.url);
            return throwError(() => refreshError);
          }),
        );
      }

      apiErrorService.handle(error, req.url);
      return throwError(() => error);
    }),
  );
};
