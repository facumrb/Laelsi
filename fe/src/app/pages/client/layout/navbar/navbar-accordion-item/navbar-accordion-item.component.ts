import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IApiCategory, MAX_CATEGORY_DEPTH } from '@models/category.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapChevronDown } from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-navbar-accordion-item',
  imports: [RouterLink, NgIconComponent],
  viewProviders: [provideIcons({ bootstrapChevronDown })],
  templateUrl: './navbar-accordion-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarAccordionItemComponent {
  category = input.required<IApiCategory>();
  depth = input<number>(0);
  activeCategoryIds = input.required<Set<number>>();
  navigated = output<void>();

  isExpanded = signal(false);
  isActive = computed(() => this.activeCategoryIds().has(this.category().id));

  constructor() {
    // Expande el acordeón del menú móvil cuando la categoría está activa (por ejemplo, al recargar la página dentro de ella)
    effect(() => {
      if (this.isActive()) {
        this.isExpanded.set(true);
      }
    });
  }

  // Se ofrecen hijas hasta el último nivel que pueden crear los negocios (MAX_CATEGORY_DEPTH)
  hasChildren = computed(
    () =>
      !!this.category().children?.length && this.depth() < MAX_CATEGORY_DEPTH,
  );

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  onNavigate(): void {
    this.navigated.emit();
  }
}
