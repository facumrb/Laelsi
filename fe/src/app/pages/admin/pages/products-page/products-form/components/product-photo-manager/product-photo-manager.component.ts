import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { IApiProductPhoto, IUiPhoto } from '@models/photo.model';
import { ApiPhotoService } from '@services/api-services/api-photo.service';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { forkJoin, Observable, of } from 'rxjs';
import { AlertService } from '@services/alert.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapCloudUpload,
  bootstrapTrash,
  bootstrapChevronLeft,
  bootstrapChevronRight,
} from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-product-photo-manager',
  imports: [NgIconComponent, ProductImageComponent],
  viewProviders: [
    provideIcons({
      bootstrapCloudUpload,
      bootstrapTrash,
      bootstrapChevronLeft,
      bootstrapChevronRight,
    }),
  ],
  templateUrl: './product-photo-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPhotoManagerComponent {
  private photoService = inject(ApiPhotoService);
  private alertService = inject(AlertService);
  private destroyRef = inject(DestroyRef);
  readonly MAX_PHOTOS = 10;
  readonly MAX_FILE_SIZE_MB = 5;
  private readonly MAX_FILE_SIZE_BYTES = this.MAX_FILE_SIZE_MB * 1024 * 1024;

  // Indica si hay archivos arrastrándose sobre la zona de subida
  isDragging = signal(false);

  // Altura medida de la galería; el envoltorio la anima con una transición CSS
  galleryHeight = signal(0);
  private galleryContent =
    viewChild.required<ElementRef<HTMLElement>>('galleryContent');

  // Fotos que ya tiene el producto (llegan en modo edición)
  initialPhotos = input<IApiProductPhoto[]>([]);

  // Fotos que se muestran, en su orden actual (viejas y nuevas)
  gallery = signal<IUiPhoto[]>([]);
  // Ids de las fotos viejas que se quitaron y hay que borrar al guardar
  photosToDeleteIds = signal<number[]>([]);

  // Orden original de los IDs, para detectar cambios de orden en el modo edición
  private originalOrder = signal<number[]>([]);

  constructor() {
    // Arma la galería cuando el padre termina de cargar el producto
    effect(() => {
      const photos = this.initialPhotos();
      if (photos && photos.length > 0) {
        this.gallery.set(
          photos.map((p) => ({
            uiId: `old-${p.id}`,
            src: p.fileName,
            originalId: p.id,
            isNew: false,
          })),
        );
        this.originalOrder.set(photos.map((p) => p.id));
      }
    });

    afterNextRender(() => {
      const content = this.galleryContent().nativeElement;
      const observer = new ResizeObserver(() =>
        this.galleryHeight.set(content.offsetHeight),
      );
      observer.observe(content);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.addFiles(Array.from(input.files));

    // Se limpia el input para poder volver a elegir los mismos archivos
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    // Pasar sobre un hijo de la zona también dispara dragleave: solo cuenta si se sale de la zona
    const zone = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next && zone.contains(next)) return;
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  /*
  Agrega a la galería las imágenes válidas. Descarta las que no son imagen (al soltar no se aplica el
  accept del input) y las que superan el tamaño máximo, y avisa cuáles se descartaron.
  */
  addFiles(files: File[]) {
    if (files.length === 0) return;

    const notImages = files.filter((f) => !f.type.startsWith('image/'));
    const tooLarge = files.filter(
      (f) => f.type.startsWith('image/') && f.size > this.MAX_FILE_SIZE_BYTES,
    );
    const valid = files.filter(
      (f) => f.type.startsWith('image/') && f.size <= this.MAX_FILE_SIZE_BYTES,
    );

    if (
      valid.length > 0 &&
      this.gallery().length + valid.length > this.MAX_PHOTOS
    ) {
      this.alertService.toast(
        `Límite excedido. Solo puedes tener ${this.MAX_PHOTOS} fotos en total.`,
        'warning',
      );
      return;
    }

    const reasons: string[] = [];
    if (notImages.length > 0) {
      reasons.push(
        `No son imágenes: ${notImages.map((f) => f.name).join(', ')}.`,
      );
    }
    if (tooLarge.length > 0) {
      reasons.push(
        `Superan los ${this.MAX_FILE_SIZE_MB}MB: ${tooLarge.map((f) => f.name).join(', ')}.`,
      );
    }
    if (reasons.length > 0) {
      this.alertService.toast(reasons.join(' '), 'warning');
    }

    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: IUiPhoto = {
          uiId: `new-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          src: reader.result as string,
          file: file,
          isNew: true,
        };
        this.gallery.update((prev) => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
    });
  }

  movePhoto(index: number, direction: 'left' | 'right') {
    const updateFn = () => {
      this.gallery.update((current) => {
        const newGallery = [...current];
        const targetIndex = direction === 'left' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newGallery.length) return current;
        [newGallery[index], newGallery[targetIndex]] = [
          newGallery[targetIndex],
          newGallery[index],
        ];
        return newGallery;
      });
    };

    if (!document.startViewTransition) {
      updateFn();
    } else {
      document.startViewTransition(() => updateFn());
    }
  }

  removePhoto(index: number) {
    const photo = this.gallery()[index];
    if (!photo) return;
    if (!photo.isNew && photo.originalId) {
      const id = photo.originalId;
      this.photosToDeleteIds.update((ids) => [...ids, id]);
    }
    this.gallery.update((current) => current.filter((_, i) => i !== index));
  }

  // true si las fotos viejas que quedan no están en su orden original
  private orderChanged = computed(() => {
    // Solo se miran las fotos viejas
    const currentOrderIds = this.gallery()
      .filter((p) => !p.isNew && p.originalId)
      .map((p) => p.originalId!);
    const original = this.originalOrder();

    // Si la cantidad cambió, el orden también
    if (currentOrderIds.length !== original.length) return true;

    // Se comparan los ids uno por uno, en su posición
    return currentOrderIds.some((id, i) => id !== original[i]);
  });

  hasChanges = computed(() => {
    // A. ¿Hay fotos nuevas?
    const hasNewPhotos = this.gallery().some((p) => p.isNew);
    if (hasNewPhotos) return true;

    // B. ¿Hay fotos marcadas para borrar?
    if (this.photosToDeleteIds().length > 0) return true;

    // C. ¿Cambió el orden?
    return this.orderChanged();
  });

  // Estado de la galería que el padre guarda y restaura como borrador al ir a crear una categoría.
  getCurrentState() {
    return {
      gallery: this.gallery(),
      photosToDeleteIds: [...this.photosToDeleteIds()],
    };
  }

  restoreState(state: { gallery: IUiPhoto[]; photosToDeleteIds: number[] }) {
    this.gallery.set(state.gallery);
    this.photosToDeleteIds.set(state.photosToDeleteIds);
  }

  // Lo llama el componente padre al guardar el producto
  saveChanges(productId: number): Observable<unknown> {
    const tasks: Observable<unknown>[] = [];

    // 1. Borrar las fotos que se quitaron
    const toDelete = this.photosToDeleteIds();
    if (toDelete.length > 0) {
      // Un pedido de borrado por foto, todos juntos en una sola tarea
      const deleteTasks = toDelete.map((id) =>
        this.photoService.deleteProductPhoto(id),
      );
      tasks.push(forkJoin(deleteTasks));
    }

    // 2. Subir las nuevas
    const newPhotos = this.gallery().filter((p) => p.isNew && p.file);

    if (newPhotos.length > 0) {
      const fd = new FormData();

      newPhotos.forEach((photo) => {
        fd.append('files', photo.file!);
        // Se envía también su posición visual actual
        const visualIndex = this.gallery().indexOf(photo);
        fd.append('orders', visualIndex.toString());
      });

      tasks.push(this.photoService.uploadProductPhotos(productId, fd));
    }

    // 3. Reordenar las viejas (solo si cambió su orden o se agregaron o quitaron fotos)
    const orderPayload = this.gallery()
      .map((photo, index) => {
        if (!photo.isNew && photo.originalId) {
          return { id: photo.originalId, order: index };
        }
        return null;
      })
      .filter((item): item is { id: number; order: number } => item !== null);

    const needsReorder =
      this.orderChanged() || newPhotos.length > 0 || toDelete.length > 0;
    if (orderPayload.length > 0 && needsReorder) {
      tasks.push(this.photoService.reorderProductPhotos(orderPayload));
    }

    // Sin tareas, se devuelve un observable que termina enseguida
    if (tasks.length === 0) return of(true);

    return forkJoin(tasks);
  }
}
