import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';

// Devuelve el elemento dentro del cual la rueda y el toque siguen funcionando (por ejemplo, la tarjeta del modal).
export type ZonaDesplazable = () => Element | null | undefined;

interface EstiloGuardado {
  valor: string;
  prioridad: string;
}

/*
 Bloqueo del desplazamiento de la página mientras hay un modal o un drawer abierto, con contador: cada `bloquear()`
 devuelve su propia función para soltar, y la página se libera recién cuando suelta el último.

 - Siempre: se bloquea la raíz y se cancelan la rueda y el toque fuera de las zonas desplazables. Esto cubre los
   contenedores internos que se desplazan por su cuenta (el contenido del admin) y las ventanas sin barra visible
   (celulares, barras superpuestas).
 - Además, si la ventana tiene barra de desplazamiento (la tienda en escritorio), el desplazamiento pasa al `body`,
   en la misma posición, con `overflow-y: scroll`: la barra no desaparece (el contenido de fondo no se corre de
   ancho) y queda debajo del fondo oscuro. Cualquier otro desplazamiento del `body` se revierte y, al soltar el
   último, la ventana vuelve a la posición guardada. Es la técnica del menú móvil de la tienda.

 No toca `document` ni `window` al construirse y en el servidor no hace nada.
*/
@Injectable({ providedIn: 'root' })
export class ScrollLockService implements OnDestroy {
  private readonly documento = inject(DOCUMENT);
  private readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly zonas = signal<
    ReadonlyMap<symbol, ZonaDesplazable | undefined>
  >(new Map());
  readonly activo = computed(() => this.zonas().size > 0);

  private limpiar: (() => void) | null = null;

  ngOnDestroy(): void {
    this.limpiar?.();
    this.limpiar = null;
    this.zonas.set(new Map());
  }

  // Bloquea el desplazamiento de la página y devuelve la función que suelta ESTE bloqueo
  bloquear(zona?: ZonaDesplazable): () => void {
    if (!this.enNavegador) return () => undefined;

    const clave = Symbol('bloqueo');
    this.zonas.update((m) => new Map(m).set(clave, zona));
    if (!this.limpiar) this.limpiar = this.aplicar();

    return () => {
      if (!this.zonas().has(clave)) return;
      this.zonas.update((m) => {
        const copia = new Map(m);
        copia.delete(clave);
        return copia;
      });
      if (this.zonas().size === 0) {
        this.limpiar?.();
        this.limpiar = null;
      }
    };
  }

  /*
   Aplica el bloqueo (lo llama el primer bloquear) y devuelve la función que lo deshace.
   Sin barra de desplazamiento: solo se bloquea la raíz y se cancelan la rueda y el toque fuera de las zonas.
   Con barra: además el desplazamiento pasa al body, en la misma posición, para que la barra no desaparezca.
  */
  private aplicar(): () => void {
    const doc = this.documento;
    const ventana = doc.defaultView!;
    const html = doc.documentElement;
    const body = doc.body;
    const y = ventana.scrollY;
    const conBarra = ventana.innerWidth > html.clientWidth;

    const restaurarHtml = this.fijar(html, 'overflow', 'hidden', '');

    const cancelarFuera = (e: Event) => {
      const destino = e.target as Node | null;
      const adentro = [...this.zonas().values()].some((zona) => {
        const el = zona?.();
        return !!el && !!destino && el.contains(destino);
      });
      if (!adentro) e.preventDefault();
    };
    doc.addEventListener('wheel', cancelarFuera, { passive: false });
    doc.addEventListener('touchmove', cancelarFuera, { passive: false });
    const quitarCancelacion = () => {
      doc.removeEventListener('wheel', cancelarFuera);
      doc.removeEventListener('touchmove', cancelarFuera);
    };

    if (!conBarra) {
      return () => {
        quitarCancelacion();
        restaurarHtml();
      };
    }

    const restaurarAlto = this.fijar(body, 'height', '100dvh', 'important');
    const restaurarOverflow = this.fijar(
      body,
      'overflow-y',
      'scroll',
      'important',
    );
    body.scrollTop = y;

    const volver = () => {
      if (body.scrollTop !== y) body.scrollTop = y;
    };
    body.addEventListener('scroll', volver);

    return () => {
      quitarCancelacion();
      body.removeEventListener('scroll', volver);
      restaurarOverflow();
      restaurarAlto();
      restaurarHtml();
      if (ventana.scrollY !== y)
        ventana.scrollTo({ top: y, behavior: 'instant' });
    };
  }

  // Aplica un estilo en línea y devuelve la función que deja el valor y la prioridad que tenía.
  private fijar(
    el: HTMLElement,
    propiedad: string,
    valor: string,
    prioridad: string,
  ): () => void {
    const previo: EstiloGuardado = {
      valor: el.style.getPropertyValue(propiedad),
      prioridad: el.style.getPropertyPriority(propiedad),
    };
    el.style.setProperty(propiedad, valor, prioridad);
    return () => {
      if (previo.valor)
        el.style.setProperty(propiedad, previo.valor, previo.prioridad);
      else el.style.removeProperty(propiedad);
    };
  }
}
