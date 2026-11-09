import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  effect,
  linkedSignal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IApiProduct } from '@models/product.model';
import { IApiProductPhoto } from '@models/photo.model';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ProductStatusBadgeComponent } from '@client/components/product-status-badge/product-status-badge.component';
import {
  BreadcrumbsComponent,
  BreadcrumbStep,
} from '@client/components/breadcrumbs/breadcrumbs.component';
import { IApiCategory } from '@models/category.model';
import { AddToCartControlComponent } from '@client/components/add-to-cart-control/add-to-cart-control.component';
import { ProductImageComponent } from '@shared/components/product-image/product-image.component';
import { CarouselNavComponent } from '@client/components/carousel-nav/carousel-nav.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapCheckLg,
  bootstrapShieldCheck,
  bootstrapLightningFill,
} from '@ng-icons/bootstrap-icons';
import { injectProductDetailQuery } from '@services/queries/product-queries';
import { mensajeDeConsultaPorWhatsApp } from '@shared/utils/disponibilidad-producto';
import { LEGAL_INFO } from '@client/pages/footer-pages/legal-info';

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
  viewProviders: [
    provideIcons({
      bootstrapCheckLg,
      bootstrapShieldCheck,
      bootstrapLightningFill,
    }),
  ],
  templateUrl: './product-page.component.html',
})
export class ProductPageComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  // ID del producto actual (la query se habilita recién cuando es mayor a 0)
  private productId = signal<number>(0);

  // Capa de queries (TanStack Query): el producto queda en caché por ID
  private productQuery = injectProductDetailQuery(this.productId);

  product = computed<IApiProduct | undefined>(() => this.productQuery.data());

  // Mientras llega el producto se muestra un esqueleto que reserva el lugar (ID 70: evita el salto de diseño)
  loading = computed(() => this.productQuery.isPending());
  thumbnailIndex = signal(0);

  // Consulta prearmada por WhatsApp para saber cuándo vuelve un producto pausado (ID 54 de discusiones.md)
  whatsAppConsulta(nombre: string): string {
    return `${LEGAL_INFO.whatsappUrl}?text=${encodeURIComponent(mensajeDeConsultaPorWhatsApp(nombre))}`;
  }

  // Breadcrumbs
  breadcrumbSteps = computed<BreadcrumbStep[]>(() => {
    const prod = this.product();
    if (!prod || !prod.category) return [];

    const steps: BreadcrumbStep[] = [];

    const buildPath = (current: IApiCategory) => {
      steps.unshift({
        label: current.name,
        url: `/category/${current.id}`,
      });
      if (current.parent) {
        buildPath(current.parent);
      }
    };

    buildPath(prod.category);

    // Agregamos el producto al final
    steps.push({ label: prod.name });

    return steps;
  });

  productPhotos = computed(() => {
    return this.product()?.photos || [];
  });

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

  productPrice = computed(() => {
    const currentPrice = this.product()?.prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.amount : 0;
  });

  productCurrency = computed(() => {
    const currentPrice = this.product()?.prices?.find((p) => p.isCurrent);
    return currentPrice ? currentPrice.currency : 'ARS';
  });

  constructor() {
    // Si el producto no existe (o falla la carga), volvemos al inicio
    effect(() => {
      if (this.productQuery.isError()) {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnInit(): void {
    const id = Number(this.activatedRoute.snapshot.paramMap.get('id'));

    // Sin un ID válido no hay producto que mostrar
    if (!id) {
      this.router.navigate(['/']);
      return;
    }

    // Al setear el ID, TanStack Query trae el producto del caché o del server
    this.productId.set(id);
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

  nextThumbnails() {
    const photos = this.productPhotos();
    if (photos.length && this.thumbnailIndex() + 5 < photos.length) {
      this.thumbnailIndex.update((v) => v + 5);
    }
  }

  prevThumbnails() {
    if (this.productPhotos().length && this.thumbnailIndex() > 0) {
      this.thumbnailIndex.update((v) => v - 5);
    }
  }
}
