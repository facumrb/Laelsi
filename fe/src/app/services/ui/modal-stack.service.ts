import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';

export interface OpcionesEntradaPila {
  // Se llama solo cuando este modal es el de arriba. Decide él si se cierra (por ejemplo, no si está ocupado).
  alEscape: (evento: KeyboardEvent) => void;
  // Si el modal no se puede descartar. Se lee de forma reactiva: puede ser una signal o un input.
  bloqueante?: () => boolean;
}

// Variable de la escala de capas de styles.css (`--z-<base>`).
export type BaseCapa = 'modal' | 'modal-nested' | 'blocking';

// Capa de un modal: la variable de la escala más un desplazamiento (z-index = `--z-<base>` + `extra`).
export interface CapaModal {
  readonly base: BaseCapa;
  readonly extra: number;
}

export interface EntradaPila {
  // 0 para el primero abierto; 1 o más para los que se abren encima.
  readonly profundidad: Signal<number>;
  readonly esElDeArriba: Signal<boolean>;
  /*
   Un modal nunca queda debajo de los que tiene abajo en la pila: el primero va en `modal`, los de encima en
   `modal-nested` (+1 por cada nivel extra) y los bloqueantes en `blocking`. Lo que se abre sobre un bloqueante
   queda en `blocking` + la distancia a ese bloqueante.
  */
  readonly capa: Signal<CapaModal>;
  // Saca al modal de la pila. Llamarla más de una vez no tiene efecto.
  liberar(): void;
}

/*
 Pila de modales abiertos: solo el de arriba responde a Escape (y, en el shell, al clic en el fondo).

 Escucha `keydown` en `document` en fase de burbuja, así un Escape que corta la propagación (una lista desplegable
 abierta, ver ListboxDirective) o que otro ya atendió con `preventDefault` cierra solo eso. El listener existe
 mientras haya algún modal en la pila y nunca en el servidor.
*/
@Injectable({ providedIn: 'root' })
export class ModalStackService implements OnDestroy {
  private readonly documento = inject(DOCUMENT);
  private readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly pila = signal<readonly symbol[]>([]);
  private readonly opciones = new Map<symbol, OpcionesEntradaPila>();
  readonly cantidad = computed(() => this.pila().length);

  private readonly alTeclear = (evento: KeyboardEvent) => {
    if (evento.key !== 'Escape' || evento.defaultPrevented) return;
    const arriba = this.pila().at(-1);
    if (arriba) this.opciones.get(arriba)?.alEscape(evento);
  };

  ngOnDestroy(): void {
    if (this.enNavegador)
      this.documento.removeEventListener('keydown', this.alTeclear);
    this.opciones.clear();
    this.pila.set([]);
  }

  // Pone un modal arriba de la pila. Devuelve su entrada: quien lo abre tiene que llamar a liberar() al cerrarlo
  registrar(opciones: OpcionesEntradaPila): EntradaPila {
    const clave = Symbol('modal');
    this.opciones.set(clave, opciones);
    if (this.pila().length === 0 && this.enNavegador) {
      this.documento.addEventListener('keydown', this.alTeclear);
    }
    this.pila.update((p) => [...p, clave]);

    const profundidad = computed(() => this.pila().indexOf(clave));
    return {
      profundidad,
      esElDeArriba: computed(() => this.pila().at(-1) === clave),
      capa: computed(() => this.capaDe(clave)),
      liberar: () => {
        if (!this.opciones.delete(clave)) return;
        this.pila.update((p) => p.filter((c) => c !== clave));
        if (this.pila().length === 0 && this.enNavegador) {
          this.documento.removeEventListener('keydown', this.alTeclear);
        }
      },
    };
  }

  private capaDe(clave: symbol): CapaModal {
    const pila = this.pila();
    const i = pila.indexOf(clave);
    if (i < 0) return { base: 'modal', extra: 0 };

    let ultimoBloqueante = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (this.opciones.get(pila[j])?.bloqueante?.()) {
        ultimoBloqueante = j;
        break;
      }
    }
    if (ultimoBloqueante >= 0)
      return { base: 'blocking', extra: i - ultimoBloqueante };
    if (this.opciones.get(clave)?.bloqueante?.())
      return { base: 'blocking', extra: 0 };
    return i === 0
      ? { base: 'modal', extra: 0 }
      : { base: 'modal-nested', extra: i - 1 };
  }
}
