import {
  Component,
  input,
  output,
  OnInit,
  OnDestroy,
  inject,
  computed,
  HostListener,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CurrencyPipe, DOCUMENT } from '@angular/common';
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
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';

import { BackdropCloseDirective } from '@shared/directives/backdrop-close.directive';

@Component({
  selector: 'app-order-detail-modal',
  imports: [
    BackdropCloseDirective,
    NgIconComponent,
    CurrencyPipe,
    FormatDatePipe,
    NombrePersonaPipe,
    RouterModule,
    CloseModalButtonComponent,
    ProductImageComponent,
    A11yModule,
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
export class OrderDetailModalComponent implements OnInit, OnDestroy {
  order = input.required<IApiOrder>();
  showClientInfo = input<boolean>(false); // Opcional: mostrar info de contacto del cliente
  close = output<void>();
  onCancel = output<number>(); // Emite el ID de la orden a cancelar

  mpAlias = 'laelsi.libreria.mp';
  OrderState = OrderState;
  PaymentMethod = PaymentMethod;

  private document = inject(DOCUMENT);
  private authService = inject(AuthService);

  private nombrePersona = new NombrePersonaPipe();

  // Nombre de quien está viendo el pedido (o, sin sesión, del cliente). Nombre y apellido de un cliente son
  // opcionales (ID 71): sin ellos se usa el correo del cliente en vez de mostrar "null null".
  currentUserName = computed(() => {
    const persona = this.authService.currentUser() ?? this.order().client;
    return this.nombrePersona.transform(persona, this.order().client.email);
  });

  ngOnInit() {
    this.document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    this.document.body.style.overflow = '';
  }

  onClose() {
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    // Si hay un modal de cancelación abierto en primer plano, no cerramos este modal
    if (this.document.querySelector('app-cancel-order-modal')) {
      return;
    }
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
