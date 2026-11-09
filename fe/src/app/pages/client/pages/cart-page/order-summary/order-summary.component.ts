import { Component, computed, inject, signal, viewChild } from '@angular/core';
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
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-order-summary',
  imports: [CurrencyPipe, NgIconComponent, TurnstileComponent],
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
  items = this.cartService.items; // Necesario para el WhatsApp link
  // Hay productos pausados o inactivos: el servidor rechazaría el pedido entero, así que se piden quitar antes
  hasUnavailable = this.cartService.hasUnavailable;

  DeliveryMethodEnum = DeliveryMethod;
  PaymentMethodEnum = PaymentMethod;

  shippingMethod = signal<DeliveryMethod>(DeliveryMethod.RetiroSucursal);

  // El pedido no se puede confirmar con envío (todavía no se hace) ni con productos no disponibles
  confirmDisabled = computed(
    () =>
      this.shippingMethod() === DeliveryMethod.Envio || this.hasUnavailable(),
  );
  paymentMethod = signal<PaymentMethod>(PaymentMethod.Transferencia);
  mpAlias = 'laelsi.libreria.mp';

  // Verificación anti-bots (Cloudflare Turnstile). Solo se exige si hay una clave configurada.
  turnstileEnabled = !!environment.turnstileSiteKey;
  turnstileToken = signal<string | null>(null);
  private turnstile = viewChild(TurnstileComponent);

  setShippingMethod(method: DeliveryMethod) {
    this.shippingMethod.set(method);
  }

  setPaymentMethod(method: PaymentMethod) {
    this.paymentMethod.set(method);
  }

  copyAlias() {
    navigator.clipboard.writeText(this.mpAlias).then(() => {
      this.alertService.success('Alias copiado');
    });
  }

  /**
   * Se asegura de que el cliente tenga un teléfono de contacto: si falta, lo pide y lo guarda en su perfil.
   * Devuelve false si no se puede seguir (la persona cancela, o falla la consulta o el guardado: en ese caso
   * el interceptor de errores ya avisó).
   */
  private async asegurarTelefono(userId: number): Promise<boolean> {
    try {
      const cuenta = await firstValueFrom(this.apiClientService.getAccountInfoById(userId));
      if (hayTelefono(cuenta.phone)) return true;

      const telefono = await this.alertService.askPhone(
        'Para coordinar el retiro y el pago necesitamos un teléfono de contacto. Lo guardamos en tu perfil.',
      );
      if (telefono === null) return false;

      await firstValueFrom(this.apiClientService.updateClient(userId, { phone: telefono }));
      return true;
    } catch {
      return false;
    }
  }

  async checkout() {
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

    // El negocio necesita un teléfono para coordinar el retiro y el pago (ID 71): si no lo tiene cargado se le
    // pide ahora, que es el único momento en que hace falta, y se guarda en su perfil.
    if (!(await this.asegurarTelefono(user.id))) return;

    const orderData = {
      clientId: user.id,
      deliveryMethod: this.shippingMethod(),
      paymentMethod: this.paymentMethod(),
      items: this.items().map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    };

    const confirmText = `El total es ${this.totalAmount().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}. ¿Deseas confirmar la compra?`;
    const isConfirmed = await this.alertService.confirmAction(
      'Confirmar pedido',
      confirmText,
      'Sí, confirmar',
    );

    if (isConfirmed) {
      if (this.turnstileEnabled && !this.turnstileToken()) {
        this.alertService.modal(
          'Verificación en curso',
          'Todavía estamos verificando que no seas un robot. Esperá unos segundos y volvé a intentar.',
          'info',
        );
        return;
      }

      this.apiOrderService.createOrder(orderData, this.turnstileToken()).subscribe({
        next: () => {
          // La compra descuenta stock y suma ventas: invalidamos el caché
          // para no seguir mostrando los datos viejos de los productos
          this.invalidateCatalog();

          const isTransfer =
            this.paymentMethod() === PaymentMethod.Transferencia;
          const successText = isTransfer
            ? `Tu pedido se ha recibido correctamente.<br><br>Realiza el pago al alias: <b>${this.mpAlias}</b><br><br>Recuerda enviar el comprobante a nuestro Whatsapp: <b>+54 9 3417121860</b>`
            : 'Tu pedido se ha recibido correctamente.';

          this.alertService.modal('¡Pedido realizado!', successText, 'success');
          this.cartService.clearCart();
          this.router.navigate(['/client/profile/orders']);
        },
        // El token de Turnstile es de un solo uso: si la compra falla, se pide uno nuevo
        error: () => this.turnstile()?.reset(),
      });
    }
  }

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
    return `https://wa.me/5493417121860?text=${encodeURIComponent(message)}`;
  });
}
