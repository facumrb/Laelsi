import { ViewportScroller } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router, Scroll, UrlSerializer } from '@angular/router';
import { filter } from 'rxjs/operators';

/*
Desplazamiento de la ventana al navegar (el router emite los eventos Scroll gracias a withInMemoryScrolling,
en app.config.ts, con el desplazamiento automático apagado):
- Atrás o Adelante: vuelve a la posición en la que estaba esa página.
- Con un ancla (#algo): va al ancla.
- A otra ruta: arranca arriba de todo.
- Si solo cambian los parámetros (filtros, ?page=) no desplaza: la paginación ya hace su propio scroll.
El panel de administración desplaza un contenedor propio, no la ventana, así que esto no lo afecta.
*/
@Injectable({
  providedIn: 'root',
})
export class ScrollNavegacionService {
  private router = inject(Router);
  private serializer = inject(UrlSerializer);
  private scroller = inject(ViewportScroller);

  // Ruta de la última navegación, sin parámetros ni ancla
  private rutaAnterior: string | null = null;

  constructor() {
    this.router.events
      .pipe(filter((event): event is Scroll => event instanceof Scroll))
      .subscribe((event) => {
        const evento = event.routerEvent;
        const url =
          'urlAfterRedirects' in evento ? evento.urlAfterRedirects : evento.url;
        const ruta = this.rutaSinParametros(url);
        const cambioDeRuta = ruta !== this.rutaAnterior;
        this.rutaAnterior = ruta;

        if (event.position) {
          this.scroller.scrollToPosition(event.position);
        } else if (event.anchor) {
          this.scroller.scrollToAnchor(event.anchor);
        } else if (cambioDeRuta) {
          this.scroller.scrollToPosition([0, 0]);
        }
      });
  }

  // "/category/5?page=2#x" -> "category/5"
  private rutaSinParametros(url: string): string {
    const primaria = this.serializer.parse(url).root.children['primary'];
    return primaria ? primaria.segments.map((s) => s.path).join('/') : '';
  }
}
