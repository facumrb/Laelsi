import { Injectable } from '@angular/core';
import { IProductDraft } from '@models/product.model';

/*
 Guarda en memoria el formulario de producto mientras se crea una categoría desde él: products-form lo
 restaura al volver. No se persiste: se pierde al recargar la página.
*/
@Injectable({
  providedIn: 'root',
})
export class ProductDraftService {
  private draft: IProductDraft | null = null;

  // Guarda el borrador (reemplaza el anterior, si lo había)
  setDraft(draft: IProductDraft) {
    this.draft = draft;
  }

  // Devuelve el borrador sin borrarlo, o null si no hay
  getDraft(): IProductDraft | null {
    return this.draft;
  }

  /*
  Descarta siempre el borrador y lo devuelve solo si url es la misma ruta que su returnUrl
  (sin query ni fragmento, porque al volver trae ?newCategoryId=). Así un borrador abandonado
  no se restaura en otro formulario de producto.
  */
  takeDraftFor(url: string): IProductDraft | null {
    const draft = this.draft;
    this.draft = null;
    if (!draft) return null;
    return this.rutaSinQuery(url) === this.rutaSinQuery(draft.returnUrl)
      ? draft
      : null;
  }

  // Ruta de la url sin query params ni fragmento
  private rutaSinQuery(url: string): string {
    return url.split('#')[0].split('?')[0];
  }
}
