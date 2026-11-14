import { Injectable, signal, computed, inject } from '@angular/core';
import { ICartItem } from '@models/cart.model';
import { IApiProduct, ProductState } from '@models/product.model';
import { ApiProductService } from '@services/api-services/api-product.service';
import {
    DisponibilidadEnCarrito,
    disponibilidadEnCarrito,
    esComprable,
} from '@shared/utils/disponibilidad-producto';

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

    items = computed(() => this.cartItemsSignal());

    totalItems = computed(() =>
        this.cartItemsSignal().reduce((acc, item) => acc + item.quantity, 0)
    );

    // Un producto pausado o inactivo sigue en el carrito (con su aviso) pero NO cuenta en el total
    totalAmount = computed(() =>
        this.cartItemsSignal().reduce((acc, item) => {
            if (!this.availabilityOf(item.product.id).disponible) return acc;
            const price = item.product.prices?.find(p => p.isCurrent)?.amount || 0;
            return acc + (price * item.quantity);
        }, 0)
    );

    // true si algún producto del carrito no se puede comprar ahora (hay que quitarlo antes de confirmar)
    hasUnavailable = computed(() =>
        this.cartItemsSignal().some(item => !this.availabilityOf(item.product.id).disponible)
    );

    constructor() { }

    private loadFromStorage(): ICartItem[] {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    private saveToStorage(items: ICartItem[]) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
        this.cartItemsSignal.set(items);
    }

    /** Qué avisar de un producto del carrito según su estado actual (ID 54 de discusiones.md). */
    availabilityOf(productId: number): DisponibilidadEnCarrito {
        return disponibilidadEnCarrito(this.liveStates()[productId]);
    }

    /**
     * Consulta al servidor el estado actual de los productos del carrito, en una sola petición.
     * Si la consulta falla no se avisa nada de lo que no se sabe: el servidor igual rechaza al
     * confirmar todo producto que no esté Activo.
     */
    refreshAvailability(): void {
        const ids = this.cartItemsSignal().map(item => item.product.id);
        if (ids.length === 0) return;

        this.apiProductService.getAvailability(ids).subscribe({
            next: (states) => this.liveStates.set(states),
            error: () => { /* el errorInterceptor ya avisó; el carrito queda sin avisos */ },
        });
    }

    /** Agrega un producto. Devuelve false (y no agrega nada) si no se puede comprar: pausado o inactivo. */
    addToCart(product: IApiProduct, quantity: number = 1): boolean {
        if (!esComprable(product.state)) return false;

        const currentItems = [...this.cartItemsSignal()];
        const existingIndex = currentItems.findIndex(item => item.product.id === product.id);

        if (existingIndex !== -1) {
            currentItems[existingIndex].quantity += quantity;
        } else {
            currentItems.push({ product, quantity });
        }

        this.saveToStorage(currentItems);
        return true;
    }

    updateQuantity(productId: number, quantity: number) {
        let currentItems = [...this.cartItemsSignal()];
        const index = currentItems.findIndex(item => item.product.id === productId);

        if (index !== -1) {
            if (quantity <= 0) {
                currentItems.splice(index, 1);
            } else {
                // De un producto no disponible se puede bajar la cantidad o quitarlo, pero no sumar
                if (quantity > currentItems[index].quantity && !this.availabilityOf(productId).disponible) return;
                currentItems[index].quantity = quantity;
            }
            this.saveToStorage(currentItems);
        }
    }

    removeFromCart(productId: number) {
        const currentItems = this.cartItemsSignal().filter(item => item.product.id !== productId);
        this.saveToStorage(currentItems);
    }

    clearCart() {
        this.saveToStorage([]);
    }
}
