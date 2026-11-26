import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  effect,
  linkedSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { IApiProduct } from '@models/product.model';
import { IApiProductPhoto } from '@models/photo.model';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ProductStatusBadgeComponent } from '@client/components/product-status-badge/product-status-badge.component';
import {
  BreadcrumbsComponent,
  BreadcrumbStep,
} from '@client/components/breadcrumbs/breadcrumbs.component';
import { AddToCartControlComponent } from '@client/components/add-to-cart-control/add-to-cart-control.component';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { CarouselNavComponent } from '@client/components/carousel-nav/carousel-nav.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapShop,
  bootstrapShieldCheck,
  bootstrapLightningFill,
} from '@ng-icons/bootstrap-icons';
import { injectProductDetailQuery } from '@services/queries/product-queries';
import { mensajeDeConsultaPorWhatsApp } from '@shared/utils/disponibilidad-producto';
import { enlaceWhatsappTienda } from '@shared/utils/datos-tienda';
import { pasosDeCategoria } from '@shared/utils/category-tree';
import { precioVigente } from '@shared/utils/precio-vigente';

@Component({
  selector: 'app-product-page',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    NgIconComponent,
    BreadcrumbsComponent,
    ProductStatusBadgeComponent,
    AddToCartControlComponent,
    ProductImageComponent,
    CarouselNavComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      bootstrapShop,
      bootstrapShieldCheck,
      bootstrapLightningFill,
    }),
  ],
  templateUrl: './product-page.component.html',
})
export class ProductPageComponent {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  // Miniaturas que se ven a la vez en la tira
  readonly miniaturasVisibles = 5;

  // ID del producto actual (la query se habilita recién cuando es mayor a 0)
  private productId = signal<number>(0);

  // Capa de queries (TanStack Query): el producto queda en caché por ID
  private productQuery = injectProductDetailQuery(this.productId);

  product = computed<IApiProduct | undefined>(() => this.productQuery.data());

  // Mientras llega el producto se muestra un esqueleto que reserva el lugar (ID 70: evita el salto de diseño)
  loading = computed(() => this.productQuery.isPending());

  // Primera miniatura visible de la tira. Vuelve al principio al cambiar de producto
  thumbnailIndex = linkedSignal(() => {
    this.productId();
    return 0;
  });

  // Breadcrumbs: el camino de la categoría del producto, con todos los pasos enlazados
  breadcrumbSteps = computed<BreadcrumbStep[]>(() => {
    const prod = this.product();
    return prod?.category ? pasosDeCategoria(prod.category) : [];
  });

  productPhotos = computed(() => this.product()?.photos || []);

  // Al cargar, seteamos la primera foto si existe.
  // Si el producto se vuelve a pedir en segundo plano, conservamos la foto
  // que el usuario estaba viendo (siempre que siga existiendo).
  selectedPhotoFileName = linkedSignal<IApiProductPhoto[], string | null>({
    source: this.productPhotos,
    computation: (photos, previous) => {
      const selected = previous?.value ?? null;
      if (selected && photos.some((p) => p.fileName === selected)) {
        return selected;
      }
      return photos.length > 0 ? photos[0].fileName : null;
    },
  });

  private currentPrice = computed(() => precioVigente(this.product()?.prices));
  productPrice = computed(() => this.currentPrice()?.amount ?? 0);
  productCurrency = computed(() => this.currentPrice()?.currency ?? 'ARS');

  constructor() {
    // Si el producto no existe (o falla la carga), volvemos al inicio
    effect(() => {
      if (this.productQuery.isError()) {
        this.router.navigate(['/']);
      }
    });

    /*
    Se escucha el ID de la URL y no solo el del primer momento: Angular reutiliza esta página al pasar de un
    producto a otro (por ejemplo desde el buscador). Al setear el ID, TanStack Query trae el producto del
    caché o del server.
    */
    this.activatedRoute.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const id = Number(params.get('id'));

        // Sin un ID válido no hay producto que mostrar
        if (!id) {
          this.router.navigate(['/']);
          return;
        }

        this.productId.set(id);
      });
  }

  // Consulta prearmada por WhatsApp para saber cuándo vuelve un producto pausado (ID 54 de discusiones.md)
  whatsAppConsulta(nombre: string): string {
    return enlaceWhatsappTienda(mensajeDeConsultaPorWhatsApp(nombre));
  }

  // Lógica para navegar el carrusel de la foto principal
  nextPhoto() {
    const photos = this.productPhotos();
    if (!photos.length) return;
    const currentIndex = photos.findIndex(
      (p) => p.fileName === this.selectedPhotoFileName(),
    );
    const nextIndex = (currentIndex + 1) % photos.length;
    this.selectedPhotoFileName.set(photos[nextIndex].fileName);
  }

  prevPhoto() {
    const photos = this.productPhotos();
    if (!photos.length) return;
    const currentIndex = photos.findIndex(
      (p) => p.fileName === this.selectedPhotoFileName(),
    );
    const prevIndex =
      currentIndex === -1
        ? photos.length - 1
        : (currentIndex - 1 + photos.length) % photos.length;
    this.selectedPhotoFileName.set(photos[prevIndex].fileName);
  }

  // Avanza la tira de miniaturas al grupo siguiente
  nextThumbnails() {
    const photos = this.productPhotos();
    if (
      photos.length &&
      this.thumbnailIndex() + this.miniaturasVisibles < photos.length
    ) {
      this.thumbnailIndex.update((v) => v + this.miniaturasVisibles);
    }
  }

  // Retrocede la tira de miniaturas al grupo anterior
  prevThumbnails() {
    if (this.productPhotos().length && this.thumbnailIndex() > 0) {
      this.thumbnailIndex.update((v) => v - this.miniaturasVisibles);
    }
  }
}
