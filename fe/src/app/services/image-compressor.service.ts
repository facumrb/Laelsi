import { Injectable } from '@angular/core';

/** Ancho máximo de las fotos de producto (en píxeles). */
export const PRODUCT_IMAGE_MAX_WIDTH = 1200;
/** Ancho máximo de las fotos de perfil (en píxeles). */
export const USER_IMAGE_MAX_WIDTH = 400;

const WEBP_MIME_TYPE = 'image/webp';
const WEBP_QUALITY = 0.8; // 80%

/**
 * Convierte y comprime imágenes a WebP EN EL NAVEGADOR, antes de subirlas.
 *
 * Las imágenes viajan directo del navegador a Cloudflare R2, así que no hay un
 * servidor en el medio que las optimice: lo hace el propio cliente con la Canvas API.
 */
@Injectable({
  providedIn: 'root',
})
export class ImageCompressorService {
  /**
   * Devuelve la imagen convertida a WebP y achicada a `maxWidth` como máximo.
   * Las imágenes más chicas que `maxWidth` no se agrandan.
   */
  async compressToWebP(file: File, maxWidth: number): Promise<Blob> {
    const bitmap = await this.decode(file);

    try {
      // Se mantiene la proporción original de la imagen
      const scale = Math.min(1, maxWidth / bitmap.width);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('No se pudo procesar la imagen en este navegador');
      }
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, WEBP_MIME_TYPE, WEBP_QUALITY),
      );

      // Si el navegador no sabe generar WebP, toBlob devuelve un PNG sin avisar
      if (!blob || blob.type !== WEBP_MIME_TYPE) {
        throw new Error(
          'Tu navegador no puede convertir imágenes a WebP. Probá con una versión más nueva.',
        );
      }

      return blob;
    } finally {
      bitmap.close();
    }
  }

  private async decode(file: File): Promise<ImageBitmap> {
    try {
      return await createImageBitmap(file);
    } catch {
      throw new Error(`No se pudo leer la imagen "${file.name}"`);
    }
  }
}
