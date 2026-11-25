import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormatDatePipe } from '@shared/pipes/format-date.pipe';
import { NombrePersonaPipe } from '@shared/pipes/nombre-persona.pipe';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapPerson,
  bootstrapEnvelope,
  bootstrapWhatsapp,
} from '@ng-icons/bootstrap-icons';
import { IApiOrder, OrderState, PaymentMethod } from '@models/order.model';
import { AuthService } from '@services/auth.service';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';
import { DATOS_TIENDA, enlaceWhatsappTienda } from '@shared/utils/datos-tienda';

@Component({
  selector: 'app-order-detail-modal',
  imports: [
    ModalShellComponent,
    NgIconComponent,
    CurrencyPipe,
    FormatDatePipe,
    NombrePersonaPipe,
    RouterLink,
    ProductImageComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapPerson,
      bootstrapEnvelope,
      bootstrapWhatsapp,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-modal.component.html',
})
export class OrderDetailModalComponent {
  order = input.required<IApiOrder>();
  showClientInfo = input<boolean>(false); // Opcional: mostrar info de contacto del cliente
  close = output<void>();
  cancelRequested = output<number>(); // Emite el ID de la orden a cancelar

  protected readonly mpAlias = DATOS_TIENDA.aliasMercadoPago;
  protected readonly storeWhatsappText = DATOS_TIENDA.whatsapp;
  protected readonly OrderState = OrderState;
  protected readonly PaymentMethod = PaymentMethod;

  private authService = inject(AuthService);

  private nombrePersona = new NombrePersonaPipe();

  // Nombre de quien está viendo el pedido (o, sin sesión, del cliente). Nombre y apellido de un cliente son
  // opcionales: sin ellos se usa el correo del cliente en vez de mostrar "null null".
  currentUserName = computed(() => {
    const persona = this.authService.currentUser() ?? this.order().client;
    return this.nombrePersona.transform(persona, this.order().client.email);
  });

  // Correo al cliente con el asunto y el saludo ya escritos
  clientEmailLink = computed(() => {
    const clientEmail = this.order().client.email;
    const adminName = this.currentUserName();
    const orderId = this.order().id;
    const subject = `Consulta sobre el pedido #${orderId} - Laelsi`;
    const body = `Hola, soy ${adminName}, de la librería Laelsi. Quisiera preguntarle con respecto al pedido de ID ${orderId}.`;

    return `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // WhatsApp a la tienda para enviar el comprobante de pago
  storeReceiptLink = computed(() =>
    enlaceWhatsappTienda(
      `Hola, soy ${this.currentUserName()}, te adjunto el comprobante del pedido de ID ${this.order().id}.`,
    ),
  );

  // WhatsApp a la tienda para hacer una consulta sobre el pedido
  storeQueryLink = computed(() =>
    enlaceWhatsappTienda(
      `Hola, soy ${this.currentUserName()}, tengo una consulta con respecto a mi pedido de ID ${this.order().id}.`,
    ),
  );

  // Null si el cliente no tiene teléfono (el registro rápido y el acceso con Google no lo piden, y se puede borrar del perfil)
  clientWhatsappLink = computed(() => {
    const clientPhone = this.order().client.phone?.replace(/\D/g, '');
    if (!clientPhone) return null;

    const adminName = this.currentUserName();
    const orderId = this.order().id;
    const message = `Hola, soy ${adminName}, de la librería Laelsi. Quisiera preguntarle con respecto al pedido de ID ${orderId}.`;

    return `https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`;
  });

  onClose() {
    this.close.emit();
  }
}
