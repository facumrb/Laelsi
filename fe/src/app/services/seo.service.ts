import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';

// Descripción para las rutas que no definen la suya en data.description
export const DEFAULT_SEO_DESCRIPTION =
  'Librería y papelería Laelsi en Rosario. Impresiones, fotocopias, útiles escolares, artículos de oficina y sellos personalizados.';

/*
 Actualiza la meta description en cada navegación con data.description de la ruta más profunda, o con la
 descripción por defecto. Se activa al inyectarlo (lo hace el inicializador de app.config.ts).
*/
@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly meta = inject(Meta);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        let currentRoute: ActivatedRoute = this.activatedRoute;

        while (currentRoute.firstChild) {
          currentRoute = currentRoute.firstChild;
        }

        const data = currentRoute.snapshot.data;
        const description: string =
          data['description'] ?? DEFAULT_SEO_DESCRIPTION;

        this.meta.updateTag({ name: 'description', content: description });
      });
  }
}
