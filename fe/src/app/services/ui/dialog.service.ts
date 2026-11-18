import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

/** Tipo de aviso. Son los mismos literales que los íconos de sweetalert2. */
export type TipoAviso = 'success' | 'error' | 'warning' | 'info' | 'question';

/** Un dato del bloque estructurado de un aviso (por ejemplo, el alias de pago). Se muestra como texto, nunca HTML. */
export interface DatoAviso {
  etiqueta: string;
  valor: string;
  /** Resalta el valor (fondo de color), para lo que la persona tiene que copiar o recordar. */
  destacado?: boolean;
}

export interface DetalleAviso {
  datos: readonly DatoAviso[];
}

/** Resultado de un aviso. Tiene la misma forma que el de sweetalert2. */
export interface ResultadoAviso {
  isConfirmed: boolean;
  isDenied: boolean;
  isDismissed: boolean;
}

export interface OpcionesAviso {
  titulo: string;
  /** Texto plano: se pinta con interpolación. */
  mensaje: string;
  icono?: TipoAviso;
  detalle?: DetalleAviso;
  textoConfirmar?: string;
}

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  icono?: TipoAviso;
  /** Acción destructiva (eliminar): tono y botón de peligro. */
  peligro?: boolean;
  textoConfirmar?: string;
  textoCancelar?: string;
}

export interface OpcionesEntrada {
  titulo: string;
  mensaje: string;
  tipo: 'tel' | 'password';
  /** Etiqueta visible del campo; si falta, se usa el título. */
  etiqueta?: string;
  placeholder?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  autocomplete?: string;
  autocapitalize?: string;
  autocorrect?: string;
  /** Devuelve el mensaje de error, o null si el valor sirve. Con error el diálogo sigue abierto y lo muestra. */
  validar?: (valor: string) => string | null;
  /** Si el valor se devuelve sin espacios en los bordes. */
  recortar?: boolean;
  /** Se aplica al valor mientras se escribe o se pega: devuelve el texto que queda en el campo. */
  filtro?: (valor: string) => string;
  /** Largo máximo: se corta el valor después de filtrarlo. No es el `maxlength` nativo, que recortaría lo pegado antes del filtro. */
  largoMaximo?: number;
}

interface Base {
  readonly id: number;
  readonly titulo: string;
  readonly mensaje: string;
}

export interface DialogoAviso extends Base {
  readonly clase: 'aviso';
  readonly icono: TipoAviso;
  readonly detalle: DetalleAviso | null;
  readonly textoConfirmar: string;
}

export interface DialogoConfirmacion extends Base {
  readonly clase: 'confirmacion';
  readonly icono: TipoAviso;
  readonly peligro: boolean;
  readonly textoConfirmar: string;
  readonly textoCancelar: string;
}

export interface DialogoEntrada extends Base {
  readonly clase: 'entrada';
  readonly tipo: 'tel' | 'password';
  readonly etiqueta: string;
  readonly placeholder: string;
  readonly textoConfirmar: string;
  readonly textoCancelar: string;
  readonly autocomplete: string | null;
  readonly autocapitalize: string | null;
  readonly autocorrect: string | null;
  readonly validar: (valor: string) => string | null;
  readonly filtro: ((valor: string) => string) | null;
  readonly largoMaximo: number | null;
}

export type Dialogo = DialogoAviso | DialogoConfirmacion | DialogoEntrada;

/** Cómo terminó un diálogo: confirmado (con el valor, si pedía uno) o descartado (Cancelar, Escape, fondo o X). */
export type SalidaDialogo = { confirmado: true; valor?: string } | { confirmado: false };

interface Pendiente {
  readonly dialogo: Dialogo;
  readonly resolver: (salida: SalidaDialogo) => void;
  /** Solo los avisos: identifica a los repetidos. */
  readonly clave?: string;
  readonly promesa?: Promise<ResultadoAviso>;
}

/**
 * Diálogos propios de la app (los de AlertService): avisos, confirmaciones y pedidos de un dato. Los pinta
 * `<app-dialog-host>`, montado en AppComponent, así sobreviven a la navegación entre layouts.
 *
 * - Cola: se muestra un diálogo por vez, en orden de llegada, sin importar el tipo.
 * - Avisos repetidos: si llega un aviso con el mismo título, mensaje y datos que uno abierto o en cola (por ejemplo,
 *   varios 401 a la vez), no se encola otro: se devuelve la misma promesa, que comparte el resultado.
 * - Las promesas nunca se rechazan.
 * - En el servidor no se muestra nada: todo resuelve en el acto como descartado.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly cola = signal<readonly Pendiente[]>([]);
  private siguienteId = 0;

  /** El diálogo que se está mostrando, o null. */
  readonly actual = computed<Dialogo | null>(() => this.cola()[0]?.dialogo ?? null);
  /** Cuántos diálogos hay, contando el que se muestra. */
  readonly pendientes = computed(() => this.cola().length);

  avisar(opciones: OpcionesAviso): Promise<ResultadoAviso> {
    const resultado = (confirmado: boolean): ResultadoAviso => ({
      isConfirmed: confirmado,
      isDenied: false,
      isDismissed: !confirmado,
    });
    if (!this.enNavegador) return Promise.resolve(resultado(false));

    const detalle = opciones.detalle ?? null;
    const clave = JSON.stringify([opciones.titulo, opciones.mensaje, detalle]);
    const repetido = this.cola().find((p) => p.clave === clave);
    if (repetido?.promesa) return repetido.promesa;

    let resolver!: (salida: SalidaDialogo) => void;
    const promesa = new Promise<ResultadoAviso>((r) => (resolver = (s) => r(resultado(s.confirmado))));
    this.encolar({
      dialogo: {
        id: ++this.siguienteId,
        clase: 'aviso',
        titulo: opciones.titulo,
        mensaje: opciones.mensaje,
        icono: opciones.icono ?? 'info',
        detalle,
        textoConfirmar: opciones.textoConfirmar ?? 'Entendido',
      },
      resolver,
      clave,
      promesa,
    });
    return promesa;
  }

  confirmar(opciones: OpcionesConfirmacion): Promise<boolean> {
    if (!this.enNavegador) return Promise.resolve(false);
    return new Promise<boolean>((r) =>
      this.encolar({
        dialogo: {
          id: ++this.siguienteId,
          clase: 'confirmacion',
          titulo: opciones.titulo,
          mensaje: opciones.mensaje,
          icono: opciones.icono ?? 'question',
          peligro: opciones.peligro ?? false,
          textoConfirmar: opciones.textoConfirmar ?? 'Confirmar',
          textoCancelar: opciones.textoCancelar ?? 'Cancelar',
        },
        resolver: (s) => r(s.confirmado),
      }),
    );
  }

  pedirDato(opciones: OpcionesEntrada): Promise<string | null> {
    if (!this.enNavegador) return Promise.resolve(null);
    const recortar = opciones.recortar ?? false;
    return new Promise<string | null>((r) =>
      this.encolar({
        dialogo: {
          id: ++this.siguienteId,
          clase: 'entrada',
          titulo: opciones.titulo,
          mensaje: opciones.mensaje,
          tipo: opciones.tipo,
          etiqueta: opciones.etiqueta ?? opciones.titulo,
          placeholder: opciones.placeholder ?? '',
          textoConfirmar: opciones.textoConfirmar ?? 'Confirmar',
          textoCancelar: opciones.textoCancelar ?? 'Cancelar',
          autocomplete: opciones.autocomplete ?? null,
          autocapitalize: opciones.autocapitalize ?? null,
          autocorrect: opciones.autocorrect ?? null,
          validar: opciones.validar ?? (() => null),
          filtro: opciones.filtro ?? null,
          largoMaximo: opciones.largoMaximo ?? null,
        },
        resolver: (s) => {
          if (!s.confirmado) return r(null);
          const valor = recortar ? (s.valor ?? '').trim() : (s.valor ?? '');
          r(valor === '' ? null : valor);
        },
      }),
    );
  }

  /** Cierra el diálogo que se muestra. Si `id` no es el de ese diálogo (ya se cerró), no hace nada. */
  cerrar(id: number, salida: SalidaDialogo): void {
    const [primero, ...resto] = this.cola();
    if (!primero || primero.dialogo.id !== id) return;
    this.cola.set(resto);
    primero.resolver(salida);
  }

  private encolar(pendiente: Pendiente): void {
    this.cola.update((c) => [...c, pendiente]);
  }
}
