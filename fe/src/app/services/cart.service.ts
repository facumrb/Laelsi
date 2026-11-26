import { Injectable, signal, computed, inject } from '@angular/core';
import { ICartItem } from '@models/cart.model';
import { IApiProduct, ProductState } from '@models/product.model';
import { ApiProductService } from '@services/api-services/api-product.service';
import { precioVigente } from '@shared/utils/precio-vigente';
import {
  DisponibilidadEnCarrito,
  disponibilidadEnCarrito,
  esComprable,
} from '@shared/utils/disponibilidad-producto';

/*
 Carrito de la tienda. Vive solo en el navegador (localStorage, clave laelsi_cart): sobrevive a recargar la
 página, pero no se sincroniza con el servidor ni entre dispositivos. Al confirmar el pedido se envían solo
 los ids y las cantidades: el precio y el estado de cada producto los toma y valida el servidor.
*/
@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly STORAGE_KEY = 'laelsi_cart';
  private readonly apiProductService = inject(ApiProductService);

  private cartItemsSignal = signal<ICartItem[]>(this.loadFromStorage());

  // El carrito guarda una COPIA del producto, y su estado puede estar vencido (se pausó o se desactivó
  // después de agregarlo). Acá queda el estado ACTUAL de cada producto, tal como lo informó el servidor
  // la última vez que se consultó (refreshAvailability). Mientras no se sabe, no se avisa nada.
  private liveStates = signal<Record<number, ProductState>>({});

  // Lista del carrito, de solo lectura (los cambios pasan por los métodos de este servicio)
  items = computed(() => this.cartItemsSignal());

  // Cantidad total de unidades (lo que muestra el ícono del carrito)
  totalItems = computed(() =>
    this.cartItemsSignal().reduce((acc, item) => acc + item.quantity, 0),
  );

  // Un producto pausado o inactivo sigue en el carrito (con su aviso) pero NO cuenta en el total
  totalAmount = computed(() =>
    this.cartItemsSignal().reduce((acc, item) => {
      if (!this.availabilityOf(item.product.id).disponible) return acc;
      const price = precioVigente(item.product.prices)?.amount ?? 0;
      return acc + price * item.quantity;
    }, 0),
  );

  // true si algún producto del carrito no se puede comprar ahora (hay que quitarlo antes de confirmar)
  hasUnavailable = computed(() =>
    this.cartItemsSignal().some(
      (item) => !this.availabilityOf(item.product.id).disponible,
    ),
  );

  // Un carrito guardado corrupto o alterado a mano se descarta: no puede impedir que la app arranque
  private loadFromStorage(): ICartItem[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Guarda el carrito en el navegador y publica los cambios
  private saveToStorage(items: ICartItem[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    this.cartItemsSignal.set(items);
  }

  // Qué avisar de un producto del carrito según su estado actual (ID 54 de discusiones.md)
  availabilityOf(productId: number): DisponibilidadEnCarrito {
    return disponibilidadEnCarrito(this.liveStates()[productId]);
  }

  /*
   Consulta al servidor el estado actual de los productos del carrito, en una sola petición.
   Si la consulta falla no se avisa nada de lo que no se sabe: el servidor igual rechaza al
   confirmar todo producto que no esté Activo.
  */
  refreshAvailability(): void {
    const ids = this.cartItemsSignal().map((item) => item.product.id);
    if (ids.length === 0) return;

    this.apiProductService.getAvailability(ids).subscribe({
      next: (states) => this.liveStates.set(states),
      error: () => {
        // El errorInterceptor ya avisó; el carrito queda sin avisos
      },
    });
  }

  // Agrega un producto. Devuelve false (y no agrega nada) si no se puede comprar: pausado o inactivo
  addToCart(product: IApiProduct, quantity: number = 1): boolean {
    if (!esComprable(product.state)) return false;

    const currentItems = this.cartItemsSignal();
    const exists = currentItems.some((item) => item.product.id === product.id);

    this.saveToStorage(
      exists
        ? currentItems.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...currentItems, { product, quantity }],
    );
    return true;
  }

  // Cambia la cantidad de un producto; con 0 o menos lo quita del carrito
  updateQuantity(productId: number, quantity: number) {
    const currentItems = this.cartItemsSignal();
    const current = currentItems.find((item) => item.product.id === productId);
    if (!current) return;

    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    // De un producto no disponible se puede bajar la cantidad o quitarlo, pero no sumar
    if (
      quantity > current.quantity &&
      !this.availabilityOf(productId).disponible
    )
      return;

    this.saveToStorage(
      currentItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
      ),
    );
  }

  // Quita un producto del carrito, sin importar su cantidad
  removeFromCart(productId: number) {
    const currentItems = this.cartItemsSignal().filter(
      (item) => item.product.id !== productId,
    );
    this.saveToStorage(currentItems);
  }

  // Vacía el carrito: lo usan el botón "Vaciar todo el carrito" y la confirmación de un pedido
  clearCart() {
    this.saveToStorage([]);
  }
}
