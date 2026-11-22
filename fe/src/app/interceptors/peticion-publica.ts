import { HttpContext, HttpContextToken } from '@angular/common/http';

/*
 Este archivo define una marca que se le pone a un pedido HTTP para indicar que es público: devuelve lo mismo con o sin sesión iniciada (catálogo, búsqueda, etc.).

 Por defecto, `authInterceptor` agrega `apikey` y `Authorization` a todo pedido al backend. Un pedido marcado sale sin esos headers, y eso tiene dos ventajas:
 - El navegador no hace la consulta previa (OPTIONS) de CORS, que los headers propios obligan a hacer.
 - El pedido sale enseguida, sin esperar a que se lea o se renueve el token.
 */
export const PETICION_PUBLICA = new HttpContextToken<boolean>(() => false);

export function contextoPublico(): HttpContext {
  return new HttpContext().set(PETICION_PUBLICA, true);
}
