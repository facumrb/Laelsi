import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

// Cuenta las navegaciones dentro de la app para que el botón "Volver" sepa si hay una ruta anterior a la que ir.
@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  private router = inject(Router);

  private visitedCount = 0;

  /*
  Última página visitada fuera de las pantallas de acceso (/auth/...), con sus parámetros.
  La usa el Volver del login para salir de /auth aunque la persona haya pasado por el registro
  o por recuperar contraseña. Si todavía no visitó ninguna, es el inicio.
  */
  readonly lastUrlOutsideAuth = signal('/');

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe({
        next: (event) => {
          this.visitedCount++;
          const url = event.urlAfterRedirects;
          if (!/^\/auth(\/|\?|#|$)/.test(url)) this.lastUrlOutsideAuth.set(url);
        },
      });
  }

  // Con más de una navegación registrada, existe una ruta anterior dentro de la app
  public hasPreviousRoute(): boolean {
    return this.visitedCount > 1;
  }
}
