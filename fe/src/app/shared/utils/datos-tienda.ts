/*
Datos de contacto y de pago de la tienda que se muestran en el sitio.
Es el único lugar donde se escriben: el footer, las páginas legales, el carrito, el detalle del pedido
y la recuperación de contraseña los toman de acá.
Sin dependencias de Angular ni del navegador, porque también lo usan las páginas legales pre-renderizadas.
*/

export const DATOS_TIENDA = {
  // WhatsApp de la tienda tal como se muestra. El enlace usa solo sus dígitos
  whatsapp: '+54 9 341 712-1860',
  // Alias de Mercado Pago para pagar por transferencia
  aliasMercadoPago: 'laelsi.libreria.mp',
} as const;

// Enlace a WhatsApp de la tienda, con un mensaje ya escrito si se pasa uno
export function enlaceWhatsappTienda(mensaje?: string): string {
  const enlace = `https://wa.me/${DATOS_TIENDA.whatsapp.replace(/\D/g, '')}`;
  return mensaje ? `${enlace}?text=${encodeURIComponent(mensaje)}` : enlace;
}
