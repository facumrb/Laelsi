import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { IApiProductPhoto } from '@models/photo.model';
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

interface IUiPhoto {
  uiId: string;
  src: string;
  file?: File;
  originalId?: number;
  isNew: boolean;
}

@Component({
  selector: 'app-photo-manager',
  imports: [NgIconComponent, ProductImageComponent],
  viewProviders: [
    provideIcons({
      bootstrapCloudUpload,
      bootstrapTrash,
      bootstrapChevronLeft,
      bootstrapChevronRight,
    }),
  ],
  templateUrl: './photo-manager.component.html',
})
export class PhotoManagerComponent {
  private photoService = inject(ApiPhotoService);
  private alertService = inject(AlertService);
  readonly MAX_PHOTOS = 10;

  //Recibimos las fotos cuando estamos en modo Edición
  initialPhotos = input<IApiProductPhoto[]>([]);

  gallery = signal<IUiPhoto[]>([]);
  photosToDeleteIds: number[] = [];

  // Orden original de los IDs, para detectar cambios de orden en el modo edición
  private originalOrder = signal<number[]>([]);

  constructor() {
    // Escuchamos cambios en el input (cuando carga el producto en el padre)
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
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    // 1. Verificamos que haya archivos seleccionados
    if (!input.files || input.files.length === 0) return;

    const newFilesCount = input.files.length;
    const currentFilesCount = this.gallery().length;

    // 2. VALIDACIÓN: ¿La suma supera el límite?
    if (currentFilesCount + newFilesCount > this.MAX_PHOTOS) {
      this.alertService.toast(
        `Límite excedido. Solo puedes tener ${this.MAX_PHOTOS} fotos en total.`,
        'warning',
      );

      // Limpiamos el input para que pueda intentar de nuevo y salimos
      input.value = '';
      return;
    }

    // 3. Si pasa la validación, procesamos los archivos
    Array.from(input.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const newPhoto: IUiPhoto = {
          uiId: `new-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          src: e.target.result,
          file: file,
          isNew: true,
        };
        this.gallery.update((prev) => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
    });

    // Limpiamos el input al final
    input.value = '';
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
    this.gallery.update((current) => {
      const photo = current[index];
      if (!photo.isNew && photo.originalId) {
        this.photosToDeleteIds.push(photo.originalId);
      }
      return current.filter((_, i) => i !== index);
    });
  }

  hasChanges = computed(() => {
    // A. ¿Hay fotos nuevas?
    const hasNewPhotos = this.gallery().some((p) => p.isNew);
    if (hasNewPhotos) return true;

    // B. ¿Hay fotos marcadas para borrar?
    if (this.photosToDeleteIds.length > 0) return true;

    // C. ¿Cambió el orden?
    const currentOrderIds = this.gallery()
      .filter((p) => !p.isNew && p.originalId) // Solo miramos las viejas
      .map((p) => p.originalId!);

    // Comparamos arrays: Si la longitud cambió o el orden es distinto
    if (currentOrderIds.length !== this.originalOrder().length) return true;

    // Comparamos ID por ID en su posición
    for (let i = 0; i < currentOrderIds.length; i++) {
      if (currentOrderIds[i] !== this.originalOrder()[i]) return true;
    }

    return false;
  });

  // Estado de la galería que el padre guarda y restaura como borrador al ir a crear una categoría.
  getCurrentState() {
    return {
      gallery: this.gallery(),
      photosToDeleteIds: [...this.photosToDeleteIds],
    };
  }

  restoreState(state: { gallery: IUiPhoto[]; photosToDeleteIds: number[] }) {
    this.gallery.set(state.gallery);
    this.photosToDeleteIds = state.photosToDeleteIds;
  }

  // Lo llama el componente padre al guardar el producto.
  saveChanges(productId: number): Observable<any> {
    const tasks: Observable<any>[] = [];

    // 1. Borrar fotos
    if (this.photosToDeleteIds.length > 0) {
      // Creamos un array de observables de borrado
      const deleteTasks = this.photosToDeleteIds.map((id) =>
        this.photoService.deleteProductPhoto(id),
      );
      // Los agregamos a la cola principal
      tasks.push(forkJoin(deleteTasks));
    }

    // 2. Subir Nuevas
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

    // 3. Reordenar Viejas
    const orderPayload = this.gallery()
      .map((photo, index) => {
        if (!photo.isNew && photo.originalId) {
          return { id: photo.originalId, order: index };
        }
        return null;
      })
      .filter((item): item is { id: number; order: number } => item !== null);

    if (orderPayload.length > 0) {
      tasks.push(this.photoService.reorderProductPhotos(orderPayload));
    }

    // Si no hay tareas, devolvemos un observable vacío inmediato
    if (tasks.length === 0) return of(true);

    return forkJoin(tasks);
  }
}
