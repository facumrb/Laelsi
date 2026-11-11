import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@services/auth.service';

export const clientGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si no está logueado, lo mandamos al login guardando la URL a la que iba
  if (!authService.isLoggedIn()) {
    router.navigate(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  // Si es Administrador, lo enviamos a su perfil de administrador
  if (authService.isAdmin()) {
    router.navigate(['/admin/profile']);
    return false;
  }

  // Si es Cliente (logueado y NO es admin), se permite el acceso
  return true;
};
