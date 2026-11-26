import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { DialogService } from '@services/ui/dialog.service';
import { DialogComponent } from './dialog.component';

/*
Va en el bloque @error del host: si no se pudo descargar el componente de los diálogos, descarta cada diálogo que
llega al frente de la cola, así ninguna promesa queda sin resolver ni la cola trabada.
*/
@Component({
  selector: 'app-dialogos-sin-carga',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class DialogosSinCargaComponent {
  constructor() {
    const dialogos = inject(DialogService);
    effect(() => {
      const d = dialogos.actual();
      if (d) dialogos.cerrar(d.id, { confirmado: false });
    });
  }
}

/*
Pinta los diálogos de DialogService. Va una sola vez, en AppComponent, para que los diálogos sobrevivan a la
navegación entre layouts.

- El componente de los diálogos se carga de forma diferida (cuando el navegador está libre o al pedirse el primer
  diálogo): no pesa en la carga inicial. En el servidor no se pinta nada. Si la descarga falla, los diálogos se
  descartan (DialogosSinCargaComponent).
- Cada diálogo es una vista nueva (se sigue por su id), así cada uno arranca con su propio foco inicial.
- Al vaciarse la cola, el foco vuelve a donde estaba antes del primer diálogo.
*/
@Component({
  selector: 'app-dialog-host',
  imports: [DialogComponent, DialogosSinCargaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @defer (on idle; when hayDialogo()) {
      @for (d of abiertos(); track d.id) {
        <app-dialog [dialogo]="d" (cerrar)="dialogos.cerrar(d.id, $event)" />
      }
    } @error {
      <app-dialogos-sin-carga />
    }
  `,
})
export class DialogHostComponent {
  protected readonly dialogos = inject(DialogService);
  protected readonly abiertos = computed(() => {
    const d = this.dialogos.actual();
    return d ? [d] : [];
  });
  protected readonly hayDialogo = computed(
    () => this.dialogos.actual() !== null,
  );

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const documento = inject(DOCUMENT);
    const injector = inject(Injector);
    let origen: HTMLElement | null = null;
    let habia = false;

    effect(() => {
      const hay = this.hayDialogo();
      if (hay && !habia) {
        const activo = documento.activeElement;
        origen =
          activo instanceof HTMLElement && activo !== documento.body
            ? activo
            : null;
      }
      if (!hay && habia) {
        const el = origen;
        origen = null;
        afterNextRender(() => (el?.isConnected ? el.focus() : undefined), {
          injector,
        });
      }
      habia = hay;
    });
  }
}
