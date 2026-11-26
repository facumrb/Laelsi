import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_INFO } from '@client/pages/footer-pages/legal-info';
import { LegalShellComponent } from '@client/pages/footer-pages/legal-shell/legal-shell.component';

// Página pre-renderizada en el build: no usar acá servicios que dependan del navegador (ver LegalShellComponent)
@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink, LegalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy-page.component.html',
})
export class PrivacyPageComponent {
  readonly legal = LEGAL_INFO;
}
