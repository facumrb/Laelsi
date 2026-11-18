import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
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
import { ScrollLockService } from '@services/ui/scroll-lock.service';
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

  private readonly scrollLock = inject(ScrollLockService);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Mientras el menú está abierto la página no se desplaza; el bloqueo lo gestiona `ScrollLockService`. */
  constructor() {
    // Misma consulta que la variante `barra-hover` de styles.css: desde ese ancho el menú se oculta, así que se
    // cierra para no dejar el bloqueo de scroll tomado sin nada visible.
    afterNextRender(() => {
      const consulta = this.documento.defaultView?.matchMedia?.(
        '(min-width: 68.75rem) and (hover: hover) and (pointer: fine)',
      );
      if (!consulta) return;
      const cerrarSiSeOculta = () => {
        if (consulta.matches) this.isOpen.set(false);
      };
      cerrarSiSeOculta();
      consulta.addEventListener('change', cerrarSiSeOculta);
      this.destroyRef.onDestroy(() => consulta.removeEventListener('change', cerrarSiSeOculta));
    });

    effect((onCleanup) => {
      const panel = this.panel()?.nativeElement;
      if (!this.isOpen() || !panel) return;

      const soltar = untracked(() => this.scrollLock.bloquear(() => panel));
      onCleanup(soltar);
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
