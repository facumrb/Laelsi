import { Component, signal } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapChevronDown } from '@ng-icons/bootstrap-icons';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq-page',
  imports: [NgIconComponent],
  viewProviders: [
    provideIcons({
      bootstrapChevronDown,
    }),
  ],
  templateUrl: './faq-page.component.html',
})
export class FaqPageComponent {
  faqs: FaqItem[] = [
    {
      question: '¿Cómo realizo una compra en Laelsi?',
      answer:
        'Elegí los productos que necesitás, agregalos al carrito, iniciá sesión (o creá tu cuenta) y confirmá el pedido eligiendo cómo vas a pagar. El pedido queda registrado como “Pendiente” y lo ves en Mi Perfil, en Mis Pedidos. Después coordinás el pago y el retiro con nosotros.',
    },
    {
      question: '¿Realizan envíos a domicilio?',
      answer:
        'Por el momento no hacemos envíos a domicilio: los pedidos se retiran en nuestro local de Rosario (9 de Julio 2325). Si habilitamos los envíos, lo vamos a informar en el sitio.',
    },
    {
      question: '¿Cuáles son los medios de pago disponibles?',
      answer:
        'Podés pagar por transferencia o depósito bancario (al confirmar el pedido te mostramos el alias y nos enviás el comprobante por WhatsApp) o en el local, con efectivo, tarjeta de débito o tarjeta de crédito. El sitio no cobra en línea ni te pide los datos de tu tarjeta.',
    },
    {
      question: '¿Cómo retiro mi compra en el local?',
      answer:
        'Retirás tu pedido en 9 de Julio 2325, Rosario, en nuestro horario de atención (figura al pie del sitio). Podés seguir el estado del pedido en Mis Pedidos o consultarnos por WhatsApp.',
    },
    {
      question: '¿Puedo cancelar un pedido?',
      answer:
        'Sí. Desde Mi Perfil, en Mis Pedidos, podés cancelarlo mientras esté “Pendiente” o “Pagado”. Si ya habías pagado, coordinamos con vos la devolución del dinero.',
    },
    {
      question: '¿Puedo arrepentirme de una compra?',
      // PROVISIONAL-2026-11-08 (arrepentimiento): respuesta ORIGINAL, comentada. Mandaba al botón. El plazo
      // y la excepción siguen, porque el derecho de revocación existe por ley con o sin botón.
      // answer:
      //   'Sí. Tenés 10 días corridos desde que retirás el producto o confirmás el pedido, lo que ocurra último. Usá el Botón de arrepentimiento que está en el inicio del sitio: no necesitás cuenta y te damos un código de identificación al instante. Los productos hechos a medida, como los sellos, quedan exceptuados por la ley.',
      answer:
        'Sí. Tenés 10 días corridos desde que retirás el producto o confirmás el pedido, lo que ocurra último. Escribinos por WhatsApp o acercate al local, indicando tu nombre y el número de tu pedido. Los productos hechos a medida, como los sellos, quedan exceptuados por la ley.',
    },
    {
      question: '¿Qué hago si tengo un problema con mi pedido?',
      answer:
        'Escribinos por WhatsApp o acercate al local. Si un producto tiene fallas, te corresponde la garantía legal de la Ley de Defensa del Consumidor. Vamos a ayudarte a resolverlo lo antes posible.',
    },
  ];

  openIndex = signal<number | null>(null);

  toggleFaq(index: number): void {
    if (this.openIndex() === index) {
      this.openIndex.set(null);
    } else {
      this.openIndex.set(index);
    }
  }
}
