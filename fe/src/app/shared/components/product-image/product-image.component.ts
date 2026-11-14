import { Component, computed, input, signal } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-product-image',
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

  hasError = signal(false);

  displayUrl = computed(() => {
    const url = this.imageUrl();

    if (!url || url.trim() === '') {
      return 'assets/Webp/no-image.webp';
    }

    if (this.hasError()) {
      return 'assets/Webp/no-image.webp';
    }

    // Si ya es una URL absoluta, base64, o asset estático
    if (
      url.startsWith('http') ||
      url.startsWith('data:') ||
      url.startsWith('assets/')
    ) {
      return url;
    }

    // Si no, delegamos la variable de entorno
    return `${environment.productImagesUrl}${url}`;
  });

  handleImageError() {
    this.hasError.set(true);
  }
}
