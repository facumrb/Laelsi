import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { LEGAL_INFO } from '@client/pages/footer-pages/legal-info';

/*
Marco liviano de las páginas legales (encabezado con el logo, contenido y pie con los enlaces).

Estas páginas se PRE-RENDERIZAN en el build (ver app.routes.server.ts), así que este componente
y todo lo que use NO puede depender de localStorage, window ni del API. Por eso no reutiliza el
layout de la tienda. Si necesita algo del navegador, tiene que ir dentro de afterNextRender.
*/
@Component({
  selector: 'app-legal-shell',
  imports: [RouterLink, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-shell.component.html',
})
export class LegalShellComponent {
  // Datos de la tienda que muestra el pie
  readonly legal = LEGAL_INFO;
}
