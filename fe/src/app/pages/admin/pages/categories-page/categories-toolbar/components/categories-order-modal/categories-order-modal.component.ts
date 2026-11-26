import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ApiCategoryService } from '@services/api-services/api-category.service';
import { AlertService } from '@services/alert.service';
import { IApiCategory } from '@models/category.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapChevronDown } from '@ng-icons/bootstrap-icons';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';

@Component({
  selector: 'app-categories-order-modal',
  imports: [
    DragDropModule,
    NgTemplateOutlet,
    NgIconComponent,
    ModalShellComponent,
  ],
  providers: [provideIcons({ bootstrapChevronDown })],
  templateUrl: './categories-order-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesOrderModalComponent {
  isOpen = model.required<boolean>();
  onSaved = output<void>();

  private apiService = inject(ApiCategoryService);
  private alertService = inject(AlertService);
  private destroyRef = inject(DestroyRef);

  categories = signal<IApiCategory[]>([]);
  initialCategories = signal<string>('');
  expandedMap = signal<Record<number, boolean>>({});
  isLoading = signal(false);
  isSaving = signal(false);

  hasRealChanges = computed(() => {
    return JSON.stringify(this.categories()) !== this.initialCategories();
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.loadCategories();
      }
    });
  }

  close() {
    this.isOpen.set(false);
  }

  loadCategories() {
    this.isLoading.set(true);
    /*
    Se pide el árbol completo, activas e inactivas, para que ninguna quede afuera del orden. La
    profundidad máxima la limita el servidor.
    */
    this.apiService
      .getCategoryTree()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.categories.set(data);
          this.initialCategories.set(JSON.stringify(data));
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  toggleExpand(id: number) {
    const current = this.expandedMap();
    this.expandedMap.set({ ...current, [id]: !current[id] });
  }

  drop(event: CdkDragDrop<IApiCategory[]>, list: IApiCategory[]) {
    // Mueve la categoría dentro de su mismo nivel (cada nivel es su propia lista)
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    // La lista se modificó en el lugar: una referencia nueva hace que los computed se recalculen
    this.categories.set([...this.categories()]);
  }

  save() {
    this.isSaving.set(true);

    const updates: { id: number; order: number; parentId: number | null }[] =
      [];

    const traverse = (list: IApiCategory[], parentId: number | null) => {
      list.forEach((cat, index) => {
        updates.push({
          id: cat.id,
          order: index + 1,
          parentId: parentId,
        });
        if (cat.children && cat.children.length > 0) {
          traverse(cat.children, cat.id);
        }
      });
    };

    traverse(this.categories(), null);

    this.apiService
      .updateCategoryOrders(updates)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.alertService.toast('Órdenes guardados correctamente', 'success');
          this.onSaved.emit();
          this.close();
        },
        error: () => {
          this.isSaving.set(false);
        },
      });
  }
}
