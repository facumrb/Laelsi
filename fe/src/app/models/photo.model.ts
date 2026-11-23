export interface IApiBasePhoto {
  id: number;
  fileName: string; // Ej: "a1b2-c3d4-fdsf-sdfds.webp"
}

export interface IApiProductPhoto extends IApiBasePhoto {
  order: number; // Posición dentro de la galería del producto
  productId: number;
}

// El servidor solo envía id y fileName de la foto de perfil
export type IApiUserPhoto = IApiBasePhoto;

// Foto de la galería del formulario de producto: una ya guardada (originalId) o una nueva todavía sin subir (file)
export interface IUiPhoto {
  uiId: string;
  src: string;
  file?: File;
  originalId?: number;
  isNew: boolean;
}
