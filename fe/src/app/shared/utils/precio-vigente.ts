import { IApiPrice } from '@models/product.model';

// Precio vigente de un producto, o undefined si no tiene
export function precioVigente(
  precios: IApiPrice[] | null | undefined,
): IApiPrice | undefined {
  return precios?.find((p) => p.isCurrent);
}
