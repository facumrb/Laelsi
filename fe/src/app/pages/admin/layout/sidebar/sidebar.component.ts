import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { ScrollLockService } from '@services/ui/scroll-lock.service';
import {
  bootstrapSpeedometer2,
  bootstrapPersonGear,
  bootstrapPeople,
  bootstrapBoxSeam,
  bootstrapTags,
  bootstrapReceipt,
} from '@ng-icons/bootstrap-icons';

interface menuItems {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, NgIconComponent, A11yModule],
  viewProviders: [
    provideIcons({
      bootstrapSpeedometer2,
      bootstrapPersonGear,
      bootstrapPeople,
      bootstrapBoxSeam,
      bootstrapTags,
      bootstrapReceipt,
    }),
  ],
  templateUrl: './sidebar.component.html',
  host: { style: 'display: contents' },
})
export class SidebarComponent {
  sidebarOpen = input.required<boolean>();
  mobileMenuOpen = input.required<boolean>();

  toggleMobileMenu = output<void>();

  private readonly scrollLock = inject(ScrollLockService);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Verdadero por debajo del breakpoint `lg`, donde el drawer es visible (desde `lg` lleva `lg:hidden`). */
  private readonly esMovil = signal(false);

  constructor() {
    afterNextRender(() => {
      const consulta = this.documento.defaultView?.matchMedia?.('(min-width: 64rem)');
      if (!consulta) return;
      const actualizar = () => this.esMovil.set(!consulta.matches);
      actualizar();
      consulta.addEventListener('change', actualizar);
      this.destroyRef.onDestroy(() => consulta.removeEventListener('change', actualizar));
    });

    // El bloqueo solo vive con el drawer abierto y visible: la señal del layout puede seguir en true al pasar a
    // ancho de escritorio, donde el drawer está oculto.
    effect((onCleanup) => {
      if (!this.mobileMenuOpen() || !this.esMovil()) return;
      const soltar = untracked(() => this.scrollLock.bloquear(() => this.panel()?.nativeElement));
      onCleanup(soltar);
    });
  }

  menuItems: menuItems[] = [
    {
      label: 'Analíticas',
      route: '/admin/analytics',
      icon: 'bootstrapSpeedometer2',
    },
    {
      label: 'Administradores',
      route: '/admin/admins',
      icon: 'bootstrapPersonGear',
    },
    {
      label: 'Clientes',
      route: '/admin/clients',
      icon: 'bootstrapPeople',
    },
    {
      label: 'Categorías',
      route: '/admin/categories',
      icon: 'bootstrapTags',
    },
    {
      label: 'Productos',
      route: '/admin/products',
      icon: 'bootstrapBoxSeam',
    },
    {
      label: 'Pedidos',
      route: '/admin/orders',
      icon: 'bootstrapReceipt',
    },
  ];
}
