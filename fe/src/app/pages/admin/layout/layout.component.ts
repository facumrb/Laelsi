import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  private route = inject(ActivatedRoute);

  sidebarOpen = signal(true);
  mobileMenuOpen = signal(false);

  // El lugar de la barra de desplazamiento queda reservado aunque no aparezca: así las tablas no cambian de ancho cuando la lista crece o se achica. En el archivo route se puede desactivar con `data: { reserveScrollbar: false }`.
  reserveScrollbar = signal(true);

  onPageActivate() {
    this.reserveScrollbar.set(
      this.route.firstChild?.snapshot.data['reserveScrollbar'] !== false,
    );
  }

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update((v) => !v);
  }
}
