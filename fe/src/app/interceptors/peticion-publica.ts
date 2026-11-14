import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Marca un pedido del catálogo cuya respuesta no depende de la sesión. El interceptor de autenticación lo deja
 * salir sin `apikey` ni `Authorization`, de modo que el navegador no necesita la consulta previa (OPTIONS) y el
 * pedido no espera al token.
 */
export const PETICION_PUBLICA = new HttpContextToken<boolean>(() => false);

export function contextoPublico(): HttpContext {
  return new HttpContext().set(PETICION_PUBLICA, true);
}
