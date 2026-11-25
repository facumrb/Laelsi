import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IApiCategory } from '@models/category.model';
import { injectCategoryTreeQuery } from '@services/queries/category-queries';
import { AuthService } from '@services/auth.service';
import { CartService } from '@services/cart.service';
import { NavbarTopBarComponent } from './navbar-top-bar/navbar-top-bar.component';
import { NavbarCategoryBarComponent } from './navbar-category-bar/navbar-category-bar.component';
import { NavbarMobileSidebarComponent } from './navbar-mobile-sidebar/navbar-mobile-sidebar.component';

@Component({
  selector: 'app-navbar',
  imports: [
    NavbarTopBarComponent,
    NavbarCategoryBarComponent,
    NavbarMobileSidebarComponent,
  ],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit {
  authService = inject(AuthService);
  private cartService = inject(CartService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  cartSignal = this.cartService.totalItems;
  showSideMenu = signal(false);

  // Árbol de categorías activas: mientras siga fresco (staleTime de 10 minutos) sale de la caché sin volver a pedirlo a la API
  private categoryTreeQuery = injectCategoryTreeQuery('Activo');
  categories = computed<IApiCategory[]>(
    () => this.categoryTreeQuery.data() ?? [],
  );
  currentUser = this.authService.currentUser;

  private activeCategoryId = signal<number | null>(null);

  activeCategoryIds = computed(() => {
    const activeId = this.activeCategoryId();
    const cats = this.categories();
    if (!activeId || !cats.length) return new Set<number>();

    const activeSet = new Set<number>();
    this.findAncestors(cats, activeId, activeSet);
    return activeSet;
  });

  ngOnInit() {
    this.extractCategoryIdFromUrl(this.router.url);

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.extractCategoryIdFromUrl(event.urlAfterRedirects);
      });
  }

  toggleMobileMenu() {
    this.showSideMenu.update((v) => !v);
  }

  handleLogout() {
    this.authService.logout();
    this.showSideMenu.set(false);
  }

  private extractCategoryIdFromUrl(url: string): void {
    const match = url.match(/\/category\/(\d+)/);
    this.activeCategoryId.set(match ? parseInt(match[1], 10) : null);
  }

  private findAncestors(
    cats: IApiCategory[],
    targetId: number,
    ancestorSet: Set<number>,
  ): boolean {
    for (const cat of cats) {
      if (cat.id === targetId) {
        ancestorSet.add(cat.id);
        return true;
      }
      if (cat.children?.length) {
        if (this.findAncestors(cat.children, targetId, ancestorSet)) {
          ancestorSet.add(cat.id);
          return true;
        }
      }
    }
    return false;
  }
}
