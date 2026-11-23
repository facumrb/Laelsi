import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

// Cuenta las navegaciones dentro de la app para que el botón "Volver" sepa si hay una ruta anterior a la que ir.
@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  private router = inject(Router);

  private visitedCount = 0;

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe({
        next: () => {
          this.visitedCount++;
        },
      });
  }

  // Con más de una navegación registrada, existe una ruta anterior dentro de la app
  public hasPreviousRoute(): boolean {
    return this.visitedCount > 1;
  }
}
