import { Component, computed } from '@angular/core';
// PROVISIONAL-2026-11-08 (arrepentimiento): el único `routerLink` de esta plantilla era la franja del botón,
// que está comentada; sin este comentario Angular avisa NG8113 (import sin usar). Reactivar junto con la franja.
// import { RouterLink } from '@angular/router';
import { IApiProduct } from '@models/product.model';
import { IApiCategory } from '@models/category.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { ScrollTrackerDirective } from '@shared/directives/scroll-tracker.directive';
import { CarouselNavComponent } from '@client/components/carousel-nav/carousel-nav.component';
import { injectHomeQuery } from '@services/queries/product-queries';

@Component({
  selector: 'app-main-page',
  imports: [
    // RouterLink, // PROVISIONAL-2026-11-08 (arrepentimiento): ver el import comentado arriba
    ProductCardComponent,
    LogoComponent,
    ScrollTrackerDirective,
    CarouselNavComponent,
  ],
  templateUrl: './main-page.component.html',
})
export class MainPageComponent {
  private homeQuery = injectHomeQuery();

  globalBestSellers = computed<IApiProduct[]>(
    () => this.homeQuery.data()?.bestSellers ?? [],
  );

  // El servidor ya deja afuera las categorías sin más vendidos
  categoriesWithBestSellers = computed<
    { category: IApiCategory; products: IApiProduct[] }[]
  >(() => this.homeQuery.data()?.categories ?? []);

  // Mostramos el spinner hasta tener los datos iniciales: todos los carruseles aparecen juntos.
  loading = computed(() => this.homeQuery.isPending());

  scrollCarousel(
    container: HTMLElement,
    direction: 'left' | 'right',
    tracker: ScrollTrackerDirective,
  ) {
    const width = container.clientWidth;
    const targetLeft =
      container.scrollLeft + (direction === 'left' ? -width : width);

    const atStart = targetLeft <= 5;
    const atEnd = targetLeft + width >= container.scrollWidth - 5;

    if (atStart || atEnd) {
      tracker.forceState(atStart, atEnd);
    }

    container.scrollTo({ left: targetLeft });
  }
}
