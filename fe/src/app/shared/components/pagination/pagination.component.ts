import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronLeft,
  bootstrapChevronRight,
} from '@ng-icons/bootstrap-icons';

// En los navegadores que no emiten 'scrollend', la página cambia pasado este tiempo
const RESPALDO_FIN_DESPLAZAMIENTO_MS = 1000;

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  templateUrl: './pagination.component.html',
  viewProviders: [
    provideIcons({
      bootstrapChevronLeft,
      bootstrapChevronRight,
    }),
  ],
})
export class PaginationComponent {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  // Deshace la espera del cambio de página pendiente (listener de 'scrollend' y respaldo)
  private cancelarPendiente: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelarPendiente?.());
  }

  currentPage = input.required<number>();
  totalPages = input.required<number>();
  pageChange = output<number>();

  visiblePages = computed(() => {
    const current = this.currentPage();
    const total = this.totalPages();
    const maxVisible = 6; // Define cuántos botones se muestran (sin contar < y >)

    // Si el total de páginas es menor o igual al máximo visible, mostramos todas
    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    // Calculamos el inicio intentando dejar la página actual en el centro
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    // Si el final calculado supera el total de páginas, ajustamos hacia atrás
    if (end > total) {
      end = total;
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  });

  onPageChange(page: number) {
    if (page === this.currentPage() || page < 1 || page > this.totalPages()) {
      return;
    }

    const scrollTarget =
      this.findScrollableParent(this.el.nativeElement) ?? window;
    const scrollPos =
      scrollTarget instanceof Window
        ? scrollTarget.scrollY
        : scrollTarget.scrollTop;

    this.cancelarPendiente?.();

    if (scrollPos > 0) {
      const emitir = () => {
        this.cancelarPendiente?.();
        this.pageChange.emit(page);
      };
      const respaldo =
        'onscrollend' in window
          ? undefined
          : setTimeout(emitir, RESPALDO_FIN_DESPLAZAMIENTO_MS);
      scrollTarget.addEventListener('scrollend', emitir, { once: true });
      this.cancelarPendiente = () => {
        clearTimeout(respaldo);
        scrollTarget.removeEventListener('scrollend', emitir);
        this.cancelarPendiente = null;
      };
      scrollTarget.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.pageChange.emit(page);
    }
  }

  private findScrollableParent(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const overflow = style.overflowY;
      if (overflow === 'auto' || overflow === 'scroll') {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }
}
