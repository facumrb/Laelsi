import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapInstagram,
  bootstrapWhatsapp,
  bootstrapGeoAlt,
  bootstrapClock,
} from '@ng-icons/bootstrap-icons';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { DATOS_TIENDA, enlaceWhatsappTienda } from '@shared/utils/datos-tienda';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, NgIconComponent, LogoComponent],
  viewProviders: [
    provideIcons({
      bootstrapInstagram,
      bootstrapWhatsapp,
      bootstrapGeoAlt,
      bootstrapClock,
    }),
  ],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  horario1Signal = signal('Lunes a Viernes: 8:00 a 17:00');
  horario2Signal = signal('Sábados: 9:00 a 13:00');
  // Disp. 954/2025, art. 6: hay que indicar qué área atiende las consultas y reclamos
  areaConsultasSignal = signal('Atención al Cliente');
  currentYear = signal(new Date().getFullYear());

  // WhatsApp de la tienda: enlace y número para mostrar
  protected readonly whatsappUrl = enlaceWhatsappTienda();
  protected readonly whatsappTexto = DATOS_TIENDA.whatsapp;

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
