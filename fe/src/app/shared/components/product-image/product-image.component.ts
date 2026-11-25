import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { environment } from '@environments/environment';

const SIN_IMAGEN = 'assets/Webp/no-image.webp';

@Component({
  selector: 'app-product-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-image.component.html',
})
export class ProductImageComponent {
  // Puede ser un nombre de archivo, URL completa o data URL
  imageUrl = input<string | null>(null);

  altText = input<string>('Imagen de producto');

  containerClass = input<string>('w-full aspect-4/3 bg-gray-50');

  // Clases adicionales para la etiqueta img real
  imageClass = input<string>('');

  loading = input<'lazy' | 'eager'>('lazy');

  // Sin valor no se escribe el atributo fetchpriority en el img
  priority = input<'high' | 'low' | 'auto' | null>(null);

  // URL que no se pudo cargar: solo esa se reemplaza por la imagen por defecto
  private failedUrl = signal<string | null>(null);

  // URL final de la imagen, sin tener en cuenta los errores de carga
  private resolvedUrl = computed(() => {
    const url = this.imageUrl()?.trim();
    if (!url) return SIN_IMAGEN;

    // Si ya es una URL absoluta, base64, o asset estático
    if (
      /^https?:\/\//.test(url) ||
      url.startsWith('data:') ||
      url.startsWith('assets/')
    ) {
      return url;
    }

    // Si no, delegamos la variable de entorno
    return `${environment.productImagesUrl}${url}`;
  });

  displayUrl = computed(() => {
    const url = this.resolvedUrl();
    return url === this.failedUrl() ? SIN_IMAGEN : url;
  });

  handleImageError() {
    this.failedUrl.set(this.resolvedUrl());
  }
}
