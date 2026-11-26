import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DeliveryMethod, PaymentMethod } from '@models/order.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapWhatsapp,
  bootstrapInfoCircle,
  bootstrapCopy,
} from '@ng-icons/bootstrap-icons';
import { CartService } from '@services/cart.service';
import { ApiOrderService } from '@services/api-services/api-order.service';
import { ApiClientService } from '@services/api-services/api-client.service';
import { hayTelefono } from '@shared/utils/telefono';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@services/auth.service';
import { AlertService } from '@services/alert.service';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';
import { TurnstileComponent } from '@shared/components/turnstile/turnstile.component';
import { environment } from '@environments/environment';
import { DATOS_TIENDA, enlaceWhatsappTienda } from '@shared/utils/datos-tienda';

@Component({
  selector: 'app-order-summary',
  imports: [CurrencyPipe, NgIconComponent, TurnstileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      bootstrapWhatsapp,
      bootstrapInfoCircle,
      bootstrapCopy,
    }),
  ],
  templateUrl: './order-summary.component.html',
})
export class OrderSummaryComponent {
  private cartService = inject(CartService);
  private apiOrderService = inject(ApiOrderService);
  private apiClientService = inject(ApiClientService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private invalidateCatalog = injectInvalidateCatalog();

  totalItems = this.cartService.totalItems;
  totalAmount = this.cartService.totalAmount;
  items = this.cartService.items; // Necesario para el enlace de WhatsApp
  // Hay productos pausados o inactivos: el servidor rechazaría el pedido entero, así que se piden quitar antes
  hasUnavailable = this.cartService.hasUnavailable;

  DeliveryMethodEnum = DeliveryMethod;
  PaymentMethodEnum = PaymentMethod;
  protected readonly mpAlias = DATOS_TIENDA.aliasMercadoPago;

  shippingMethod = signal<DeliveryMethod>(DeliveryMethod.RetiroSucursal);
  paymentMethod = signal<PaymentMethod>(PaymentMethod.Transferencia);

  // Pedido en curso: desde que se pide el teléfono hasta que responde el servidor
  saving = signal(false);

  // El pedido no se puede confirmar con envío (todavía no se hace), con productos no disponibles ni mientras se envía
  confirmDisabled = computed(
    () =>
      this.shippingMethod() === DeliveryMethod.Envio ||
      this.hasUnavailable() ||
      this.saving(),
  );

  // Verificación anti-bots (Cloudflare Turnstile). Solo se exige si hay una clave configurada.
  turnstileEnabled = !!environment.turnstileSiteKey;
  isLoggedIn = this.authService.isLoggedIn;
  turnstileToken = signal<string | null>(null);
  private turnstile = viewChild(TurnstileComponent);

  // La sesión puede cerrarse desde otra pestaña sin navegar: el widget se desmonta sin emitir y el token
  // quedaría guardado, y al volver la sesión se usaría uno viejo, ya vencido o gastado.
  private limpiarTokenSinSesion = effect(() => {
    if (!this.isLoggedIn()) this.turnstileToken.set(null);
  });

  // Enlace para hacer el pedido por WhatsApp con los productos disponibles del carrito
  whatsAppLink = computed(() => {
    const message =
      `Hola! Quiero realizar un pedido:\n\n` +
      this.items()
        // Los productos pausados o inactivos no se piden por WhatsApp: no se pueden comprar ahora
        .filter((i) => this.cartService.availabilityOf(i.product.id).disponible)
        .map((i) => `- ${i.product.name} x${i.quantity}`)
        .join('\n') +
      `\n\nTotal: ${this.totalAmount().toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
      })}`;
    return enlaceWhatsappTienda(message);
  });

  setShippingMethod(method: DeliveryMethod) {
    this.shippingMethod.set(method);
  }

  setPaymentMethod(method: PaymentMethod) {
    this.paymentMethod.set(method);
  }

  // Copia el alias al portapapeles. Sin HTTPS o sin permiso el navegador no lo deja
  async copyAlias() {
    try {
      await navigator.clipboard.writeText(this.mpAlias);
      this.alertService.success('Alias copiado');
    } catch {
      this.alertService.error(
        'No se pudo copiar',
        `Copiá el alias a mano: ${this.mpAlias}`,
      );
    }
  }

  /*
  Se asegura de que el cliente tenga un teléfono de contacto: si falta, lo pide y lo guarda en su perfil.
  Devuelve false si no se puede seguir (la persona cancela, o falla la consulta o el guardado: en ese caso
  el interceptor de errores ya avisó).
  */
  private async asegurarTelefono(userId: number): Promise<boolean> {
    try {
      const cuenta = await firstValueFrom(
        this.apiClientService.getAccountInfoById(userId),
      );
      if (hayTelefono(cuenta.phone)) return true;

      const telefono = await this.alertService.askPhone(
        'Para coordinar el retiro y el pago necesitamos un teléfono de contacto. Lo guardamos en tu perfil.',
      );
      if (telefono === null) return false;

      await firstValueFrom(
        this.apiClientService.updateClient(userId, { phone: telefono }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async checkout() {
    if (this.saving()) return;

    const user = this.authService.currentUser();
    if (!user) {
      this.alertService.modal(
        'Inicia sesión',
        'Para finalizar la compra, necesitas identificarte.',
        'info',
      );
      this.router.navigate(['/auth/login']);
      return;
    }

    if (this.hasUnavailable()) {
      this.alertService.modal(
        'Hay productos no disponibles',
        'Quitá del carrito los productos que están pausados o ya no se ofrecen para poder confirmar el pedido.',
        'info',
      );
      return;
    }

    // Se comprueba antes de pedir la confirmación, para no hacer confirmar a la persona en vano
    if (this.turnstileEnabled && !this.turnstileToken()) {
      this.alertService.modal(
        'Verificación en curso',
        'Todavía estamos verificando que no seas un robot. Esperá unos segundos y volvé a intentar.',
        'info',
      );
      return;
    }

    this.saving.set(true);
    try {
      // El negocio necesita un teléfono para coordinar el retiro y el pago (ID 71): si no lo tiene cargado se le
      // pide ahora, que es el único momento en que hace falta, y se guarda en su perfil.
      if (!(await this.asegurarTelefono(user.id))) return;

      const confirmText = `El total es de ${this.totalAmount().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} ¿Deseas confirmar la compra?`;
      const isConfirmed = await this.alertService.confirmAction(
        'Confirmar pedido',
        confirmText,
        'Sí, confirmar',
      );
      if (!isConfirmed) return;

      const orderData = {
        clientId: user.id,
        deliveryMethod: this.shippingMethod(),
        paymentMethod: this.paymentMethod(),
        items: this.items().map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      };

      try {
        await firstValueFrom(
          this.apiOrderService.createOrder(orderData, this.turnstileToken()),
        );
      } catch {
        // El token de Turnstile es de un solo uso: si la compra falla, se pide uno nuevo
        this.turnstile()?.reset();
        return;
      }

      this.onOrderCreated();
    } finally {
      this.saving.set(false);
    }
  }

  // Avisa que el pedido se recibió, vacía el carrito y lleva a los pedidos del perfil
  private onOrderCreated() {
    // La compra descuenta stock y suma ventas: invalidamos el caché
    // para no seguir mostrando los datos viejos de los productos
    this.invalidateCatalog();

    const successText = 'Tu pedido se ha recibido correctamente.';
    if (this.paymentMethod() === PaymentMethod.Transferencia) {
      this.alertService.modal('¡Pedido realizado!', successText, 'success', {
        datos: [
          {
            etiqueta: 'Realizá el pago al alias',
            valor: this.mpAlias,
            destacado: true,
          },
          {
            etiqueta: 'Recordá enviar el comprobante a nuestro WhatsApp',
            valor: DATOS_TIENDA.whatsapp,
            destacado: true,
          },
        ],
      });
    } else {
      this.alertService.modal('¡Pedido realizado!', successText, 'success');
    }
    this.cartService.clearCart();
    this.router.navigate(['/profile/orders']);
  }
}
