import { Component, input, output, inject, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormatDatePipe } from '@shared/pipes/format-date.pipe';
import { NombrePersonaPipe } from '@shared/pipes/nombre-persona.pipe';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapPerson,
  bootstrapEnvelope,
  bootstrapWhatsapp,
} from '@ng-icons/bootstrap-icons';
import { IApiOrder, OrderState, PaymentMethod } from '@models/order.model';
import { AuthService } from 'src/app/services/auth.service';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';

@Component({
  selector: 'app-order-detail-modal',
  imports: [
    ModalShellComponent,
    NgIconComponent,
    CurrencyPipe,
    FormatDatePipe,
    NombrePersonaPipe,
    RouterModule,
    ProductImageComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapPerson,
      bootstrapEnvelope,
      bootstrapWhatsapp,
    }),
  ],
  templateUrl: './order-detail-modal.component.html',
})
export class OrderDetailModalComponent {
  order = input.required<IApiOrder>();
  showClientInfo = input<boolean>(false); // Opcional: mostrar info de contacto del cliente
  close = output<void>();
  onCancel = output<number>(); // Emite el ID de la orden a cancelar

  mpAlias = 'laelsi.libreria.mp';
  OrderState = OrderState;
  PaymentMethod = PaymentMethod;

  private authService = inject(AuthService);

  private nombrePersona = new NombrePersonaPipe();

  // Nombre de quien está viendo el pedido (o, sin sesión, del cliente). Nombre y apellido de un cliente son
  // opcionales (ID 71): sin ellos se usa el correo del cliente en vez de mostrar "null null".
  currentUserName = computed(() => {
    const persona = this.authService.currentUser() ?? this.order().client;
    return this.nombrePersona.transform(persona, this.order().client.email);
  });

  onClose() {
    this.close.emit();
  }

  getClientEmailLink(): string {
    const clientEmail = this.order().client.email;
    const adminName = this.currentUserName();
    const orderId = this.order().id;
    const subject = `Consulta sobre el pedido #${orderId} - Laelsi`;
    const body = `Hola, soy ${adminName}, de la librería Laelsi. Quisiera preguntarle con respecto al pedido de ID ${orderId}.`;

    return `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  getStoreWhatsappLink(type: 'comprobante' | 'consulta'): string {
    const storePhone = '5493417121860';
    const userName = this.currentUserName();
    const orderId = this.order().id;

    let message = '';
    if (type === 'comprobante') {
      message = `Hola, soy ${userName}, te adjunto el comprobante del pedido de ID ${orderId}.`;
    } else {
      message = `Hola, soy ${userName}, tengo una consulta con respecto a mi pedido de ID ${orderId}.`;
    }

    return `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
  }

  // Null si el cliente no tiene teléfono (el registro rápido y el acceso con Google no lo piden)
  getClientWhatsappLink(): string | null {
    const clientPhone = this.order().client.phone?.replace(/\D/g, '');
    if (!clientPhone) return null;

    const adminName = this.currentUserName();
    const orderId = this.order().id;
    const message = `Hola, soy ${adminName}, de la librería Laelsi. Quisiera preguntarle con respecto al pedido de ID ${orderId}.`;

    return `https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`;
  }
}
