import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

// Registra las rutas visitadas para que el botón "Volver" sepa si hay una anterior a la que ir.
@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  private router = inject(Router);

  private history: string[] = [];

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe({
        next: (event: NavigationEnd) => {
          this.history.push(event.urlAfterRedirects);
        },
      });
  }

  // Si history_length > 1, significa que existe una ruta anterior registrada internamente
  public hasPreviousRoute(): boolean {
    return this.history.length > 1;
  }
}
