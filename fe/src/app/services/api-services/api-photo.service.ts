import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { IApiResponse } from '@models/api-response.model';
import { IApiProductPhoto, IApiUserPhoto } from '@models/photo.model';
import {
  concatMap,
  from,
  map,
  Observable,
  of,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ImageCompressorService,
  PRODUCT_IMAGE_MAX_WIDTH,
  USER_IMAGE_MAX_WIDTH,
} from '@services/image-compressor.service';

/** Respuesta de la Edge Function get-upload-url */
interface IUploadUrl {
  uploadUrl: string; // URL prefirmada de Cloudflare R2 (vence a los 5 minutos)
  key: string; // Nombre que tendrá el archivo en el bucket
  headers: Record<string, string>; // Headers que hay que enviar tal cual en el PUT
}

type PhotoScope = 'product' | 'user';

@Injectable({
  providedIn: 'root',
})
export class ApiPhotoService {
  private http = inject(HttpClient);
  private compressor = inject(ImageCompressorService);
  private readonly apiUrl = `${environment.apiUrl}/photos`;
  private readonly uploadUrlEndpoint = `${environment.apiUrl}/get-upload-url`;

  /**
   * Sube un archivo directo a Cloudflare R2 y devuelve su nombre (key) en el bucket.
   *
   * 1. Comprime y convierte la imagen a WebP en el navegador.
   * 2. Le pide al backend una URL prefirmada para subirla.
   * 3. Hace el PUT del binario directo a R2 (el archivo no pasa por el backend).
   */
  private uploadToR2(
    scope: PhotoScope,
    targetId: number,
    file: File,
    maxWidth: number,
  ): Observable<string> {
    return from(this.compressor.compressToWebP(file, maxWidth)).pipe(
      switchMap((blob) =>
        this.http
          .post<IApiResponse<IUploadUrl>>(this.uploadUrlEndpoint, {
            scope,
            targetId,
          })
          .pipe(
            map((response) => response.data),
            switchMap((upload) =>
              this.http
                .put(upload.uploadUrl, blob, {
                  headers: upload.headers,
                  responseType: 'text',
                })
                .pipe(map(() => upload.key)),
            ),
          ),
      ),
    );
  }

  /**
   * Cargar las fotos de un producto.
   * El FormData lleva `files` (las imágenes) y `orders` (la posición de cada una en la galería),
   * alineados por índice: el orden i corresponde al archivo i.
   */
  uploadProductPhotos(
    productId: number,
    photosData: FormData,
  ): Observable<IApiProductPhoto[]> {
    const files = photosData
      .getAll('files')
      .filter((file): file is File => file instanceof File);
    // Posición visual de cada foto dentro de la galería
    const orders = photosData.getAll('orders').map(Number);

    if (files.length === 0) return of([]);

    // Las fotos se suben de a una y, cuando están todas en R2, se registran juntas
    return from(files).pipe(
      concatMap((file) =>
        this.uploadToR2('product', productId, file, PRODUCT_IMAGE_MAX_WIDTH),
      ),
      toArray(),
      switchMap((fileNames) =>
        this.http.post<IApiResponse<IApiProductPhoto[]>>(
          `${this.apiUrl}/productPhotos/${productId}`,
          { fileNames, orders },
        ),
      ),
      map((response) => response.data),
    );
  }

  // Reordenar las fotos de un producto
  reorderProductPhotos(
    photosOrder: { id: number; order: number }[],
  ): Observable<void> {
    return this.http
      .post<IApiResponse<null>>(`${this.apiUrl}/reorder`, { photosOrder })
      .pipe(map(() => void 0));
  }

  // Borrar una foto específica de un producto
  deleteProductPhoto(photoId: number): Observable<void> {
    return this.http
      .delete<IApiResponse<null>>(`${this.apiUrl}/productPhotos/${photoId}`)
      .pipe(map(() => void 0));
  }

  // Cargar o reemplazar la foto de perfil de un usuario
  uploadUserPhoto(
    userId: number,
    photoData: FormData,
  ): Observable<IApiUserPhoto> {
    const file = photoData.get('file');

    if (!(file instanceof File)) {
      return throwError(() => new Error('No se envió ninguna imagen'));
    }

    return this.uploadToR2('user', userId, file, USER_IMAGE_MAX_WIDTH).pipe(
      switchMap((fileName) =>
        this.http.post<IApiResponse<IApiUserPhoto>>(
          `${this.apiUrl}/userPhoto/${userId}`,
          { fileName },
        ),
      ),
      map((response) => response.data),
    );
  }

  // Borrar la foto de perfil de un usuario
  deleteUserPhoto(photoId: number): Observable<void> {
    return this.http
      .delete<IApiResponse<null>>(`${this.apiUrl}/userPhoto/${photoId}`)
      .pipe(map(() => void 0));
  }
}
