import {
  Component,
  ElementRef,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { IApiCategory } from '@models/category.model';
import { UserSession } from '@models/auth.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapHouse,
  bootstrapSpeedometer2,
  bootstrapPerson,
  bootstrapBoxArrowRight,
} from '@ng-icons/bootstrap-icons';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { NavbarAccordionItemComponent } from '../navbar-accordion-item/navbar-accordion-item.component';

@Component({
  selector: 'app-navbar-mobile-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    NgIconComponent,
    LogoComponent,
    NavbarAccordionItemComponent,
    A11yModule,
  ],
  viewProviders: [
    provideIcons({
      bootstrapHouse,
      bootstrapSpeedometer2,
      bootstrapPerson,
      bootstrapBoxArrowRight,
    }),
  ],
  templateUrl: './navbar-mobile-sidebar.component.html',
})
export class NavbarMobileSidebarComponent {
  categories = input.required<IApiCategory[]>();
  activeCategoryIds = input.required<Set<number>>();
  currentUser = input<UserSession | null>(null);
  isLoggedIn = input<boolean>(false);
  isAdmin = input<boolean>(false);
  isOpen = model<boolean>(false);

  logoutRequested = output<void>();

  private panel = viewChild<ElementRef<HTMLElement>>('panel');

  /**
   * Mientras el menú está abierto el fondo no se desplaza, pero la barra de scroll de la página sigue en su
   * lugar (si desaparece, el contenido de fondo se corre al abrir y cerrar) y queda debajo del fondo oscuro,
   * como en el panel de admin. La barra de la ventana no la puede tapar ningún elemento fijo, así que mientras
   * el menú está abierto el scroll pasa al body, en la misma posición, y al cerrarlo vuelve a la ventana. La
   * rueda y el toque fuera del menú se cancelan, y cualquier otro desplazamiento del body se revierte.
   */
  constructor() {
    effect((onCleanup) => {
      const panel = this.panel()?.nativeElement;
      if (!this.isOpen() || !panel || typeof window === 'undefined') return;

      const html = document.documentElement;
      const body = document.body;
      const y = window.scrollY;

      html.style.overflow = 'hidden';
      body.style.height = '100dvh';
      body.style.overflowY = 'scroll';
      body.scrollTop = y;

      const cancelarFuera = (e: Event) => {
        if (!panel.contains(e.target as Node)) e.preventDefault();
      };
      const volver = () => {
        if (body.scrollTop !== y) body.scrollTop = y;
      };

      document.addEventListener('wheel', cancelarFuera, { passive: false });
      document.addEventListener('touchmove', cancelarFuera, { passive: false });
      body.addEventListener('scroll', volver);

      onCleanup(() => {
        document.removeEventListener('wheel', cancelarFuera);
        document.removeEventListener('touchmove', cancelarFuera);
        body.removeEventListener('scroll', volver);
        html.style.overflow = '';
        body.style.height = '';
        body.style.overflowY = '';
        window.scrollTo({ top: y, behavior: 'instant' });
      });
    });
  }

  close(): void {
    this.isOpen.set(false);
  }

  handleLogout(): void {
    this.close();
    this.logoutRequested.emit();
  }
}
