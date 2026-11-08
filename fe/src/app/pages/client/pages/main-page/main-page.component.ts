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
import {
  injectBestSellersQuery,
  injectBestSellersByCategoryQuery,
} from '@services/queries/product-queries';
import { injectActiveCategoriesQuery } from '@services/queries/category-queries';

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
  // Capa de queries (TanStack Query): toda la carga de datos queda en caché

  // 1. Obtener los más vendidos generales
  private bestSellersQuery = injectBestSellersQuery(10);

  // 2. Obtener categorías activas y sus más vendidos
  private categoriesQuery = injectActiveCategoriesQuery();

  globalBestSellers = computed(() => this.bestSellersQuery.data() ?? []);

  // Limitamos a algunas categorías para la home
  private topCategories = computed<IApiCategory[]>(() =>
    (this.categoriesQuery.data() ?? []).slice(0, 5),
  );

  // Un ID por cada lugar de categoría de la home (hasta 5).
  // Vale 0 mientras no haya categoría para ese lugar, y en ese caso la query queda deshabilitada.
  private categoryId0 = computed(() => this.topCategories()[0]?.id ?? 0);
  private categoryId1 = computed(() => this.topCategories()[1]?.id ?? 0);
  private categoryId2 = computed(() => this.topCategories()[2]?.id ?? 0);
  private categoryId3 = computed(() => this.topCategories()[3]?.id ?? 0);
  private categoryId4 = computed(() => this.topCategories()[4]?.id ?? 0);

  // Más vendidos de cada categoría: TanStack Query cachea cada una por separado
  private categoryBestSellersQueries = [
    injectBestSellersByCategoryQuery(this.categoryId0, 10),
    injectBestSellersByCategoryQuery(this.categoryId1, 10),
    injectBestSellersByCategoryQuery(this.categoryId2, 10),
    injectBestSellersByCategoryQuery(this.categoryId3, 10),
    injectBestSellersByCategoryQuery(this.categoryId4, 10),
  ];

  categoriesWithBestSellers = computed<
    { category: IApiCategory; products: IApiProduct[] }[]
  >(() => {
    return (
      this.topCategories()
        .map((cat, i) => ({
          category: cat,
          products: this.categoryBestSellersQueries[i].data() ?? [],
        }))
        // Mostramos solo categorías con productos vendidos
        .filter((r) => r.products.length > 0)
    );
  });

  // Mostramos el spinner hasta tener todos los datos iniciales. También esperamos a los
  // más vendidos de cada categoría para que los carruseles aparezcan todos juntos.
  loading = computed(() => {
    const categoriesPending = this.topCategories().some((_, i) =>
      this.categoryBestSellersQueries[i].isPending(),
    );

    return (
      this.bestSellersQuery.isPending() ||
      this.categoriesQuery.isPending() ||
      categoriesPending
    );
  });

  scrollCarousel(
    container: HTMLElement,
    direction: 'left' | 'right',
    tracker: any,
  ) {
    const width = container.clientWidth;
    const targetLeft = container.scrollLeft + (direction === 'left' ? -width : width);

    const atStart = targetLeft <= 5;
    const atEnd = targetLeft + width >= container.scrollWidth - 5;

    if (atStart || atEnd) {
      tracker.forceState(atStart, atEnd);
    }

    container.scrollTo({ left: targetLeft });
  }
}
