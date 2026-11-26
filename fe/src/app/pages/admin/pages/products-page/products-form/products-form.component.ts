import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  OnInit,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormPageHeaderComponent } from '@admin/components/form-page-header/form-page-header.component';
import { FormActionsComponent } from '@admin/components/form-actions/form-actions.component';
import { IApiCategory } from '@models/category.model';
import { ProductDraftService } from '@services/product-draft.service';
import { FormUtils } from '@shared/validators/form-utils';
import { ApiProductService } from '@services/api-services/api-product.service';
import { AlertService } from '@services/alert.service';
import {
  ICreateProduct,
  IProductDraft,
  ProductState,
} from '@models/product.model';
import { ProductPhotoManagerComponent } from './components/product-photo-manager/product-photo-manager.component';
import { ProductCategorySelectComponent } from './components/product-category-select/product-category-select.component';
import { IApiProductPhoto } from '@models/photo.model';
import { NumericInputDirective } from '@shared/directives/numeric-input.directive';
import { AuditInfoComponent } from '@admin/components/audit-info/audit-info.component';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';
import { injectAllCategoriesQuery } from '@services/queries/category-queries';
import { StateSelectComponent } from '@admin/components/state-select/state-select.component';
import { precioVigente } from '@shared/utils/precio-vigente';

@Component({
  selector: 'app-products-form',
  imports: [
    ReactiveFormsModule,
    NumericInputDirective,
    ProductPhotoManagerComponent,
    AuditInfoComponent,
    FormPageHeaderComponent,
    FormActionsComponent,
    FieldErrorComponent,
    TrimInputDirective,
    ProductCategorySelectComponent,
    StateSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-form.component.html',
})
export class ProductsFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private routeActive = inject(ActivatedRoute);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private productService = inject(ApiProductService);
  private alertService = inject(AlertService);
  private draftService = inject(ProductDraftService);
  private http = inject(HttpClient);
  private invalidateCatalog = injectInvalidateCatalog();
  private categoriesQuery = injectAllCategoriesQuery();

  // Borrador de esta misma ruta, pendiente de aplicar
  private draft: IProductDraft | null = null;

  // Id de la categoría recién creada que se selecciona al volver de crearla
  private pendingNewCategoryId: number | null = this.readNewCategoryId();

  // true cuando el formulario ya tiene sus valores iniciales (producto del servidor y borrador)
  private formReady = signal(false);

  // Acceso al hijo para llamar a su método de guardar
  photoManager = viewChild.required(ProductPhotoManagerComponent);

  // Fotos iniciales para pasar al hijo
  initialPhotos = signal<IApiProductPhoto[]>([]);

  // Categorías que se ofrecen en el selector
  categories = computed(() => this.categoriesQuery.data() ?? []);
  isEditMode = signal(false);
  productId = signal<number | null>(null);

  // Hay un guardado en curso: evita el doble envío
  saving = signal(false);

  // Valor inicial del formulario, para detectar cambios al editar
  initialFormValue = signal<string>('');
  // Estado con el que se cargó el producto (para la auditoría)
  initialState = signal<ProductState>(ProductState.Activo);

  // Estados que se ofrecen, en el orden en que se muestran
  readonly stateOptions = [
    ProductState.Activo,
    ProductState.Pausado,
    ProductState.Inactivo,
  ];

  // Datos de auditoría (solo lectura)
  auditCreatedAt = signal<string | null>(null);
  auditUpdatedAt = signal<string | null>(null);
  auditStatusDate = signal<string | null>(null);

  // Formulario
  formProduct = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        FormUtils.minLength(3),
        FormUtils.maxLength(50),
        Validators.pattern(FormUtils.namePattern),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    description: [
      '',
      [
        Validators.required,
        FormUtils.maxLength(1000),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    price: [
      null as number | null,
      [
        Validators.required,
        // El servidor y la base exigen un precio mayor a 0
        Validators.min(1),
        Validators.pattern(FormUtils.numberPattern),
      ],
    ],
    brand: [
      '',
      [
        Validators.required,
        FormUtils.maxLength(100),
        FormUtils.notOnlyWhiteSpace,
      ],
    ],
    totalSold: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.pattern(FormUtils.numberPattern),
      ],
    ],
    stock: [
      null as number | null,
      [
        Validators.required,
        Validators.min(0),
        Validators.pattern(FormUtils.numberPattern),
      ],
    ],
    state: [ProductState.Activo, [Validators.required]],
    category: [null as IApiCategory | null, [Validators.required]],
  });

  // Valor actual del formulario como señal
  private formValue = toSignal(this.formProduct.valueChanges, {
    initialValue: this.formProduct.getRawValue(),
  });

  /*
  Indica si hay algo para guardar: al crear siempre, al editar si cambió el formulario o las
  fotos.
  */
  hasRealChanges = computed(() => {
    if (!this.isEditMode()) return true;
    const formHasChanges =
      JSON.stringify(this.formValue()) !== this.initialFormValue();
    return formHasChanges || this.photoManager().hasChanges();
  });

  constructor() {
    /*
    Selecciona una sola vez la categoría recién creada. Espera a que el formulario tenga sus
    valores iniciales (si no, el borrador o el producto la pisarían) y a que termine el pedido
    de categorías: al volver de crearla, la caché tiene la lista vieja, sin la nueva.
    */
    effect(() => {
      const id = this.pendingNewCategoryId;
      if (id === null || !this.formReady()) return;

      const data = this.categoriesQuery.data();
      const settled =
        (!this.categoriesQuery.isFetching() && data !== undefined) ||
        this.categoriesQuery.isError();
      if (!settled) return;

      this.pendingNewCategoryId = null;
      untracked(() => this.selectNewCategory(id, data ?? []));
    });
  }

  ngOnInit() {
    this.draft = this.draftService.takeDraftFor(this.router.url);
    this.checkEditMode();
    // En edición, el borrador se aplica cuando llega el producto
    if (!this.isEditMode()) this.restoreDraftIfAny();
  }

  // Aplica el borrador (si lo hay) y marca el formulario como listo
  private restoreDraftIfAny() {
    const draft = this.draft;
    this.draft = null;

    if (draft) {
      this.formProduct.patchValue(
        draft.formValue as Partial<
          ReturnType<typeof this.formProduct.getRawValue>
        >,
      );

      /*
      Después del render, para que el gestor de fotos ya haya procesado initialPhotos y no pise
      la galería.
      */
      afterNextRender(
        () => {
          this.photoManager().restoreState({
            gallery: draft.photos,
            photosToDeleteIds: draft.photosToDeleteIds,
          });
        },
        { injector: this.injector },
      );
    }

    this.formReady.set(true);
  }

  // Id de ?newCategoryId=, o null si no viene
  private readNewCategoryId(): number | null {
    const id = this.routeActive.snapshot.queryParamMap.get('newCategoryId');
    return id ? +id : null;
  }

  // Selecciona la categoría recién creada (si está en la lista) y limpia el parámetro de la URL
  private selectNewCategory(id: number, categories: IApiCategory[]) {
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      this.formProduct.patchValue({ category: cat });
      this.alertService.toast(
        `Categoría "${cat.name}" seleccionada`,
        'success',
      );
    }
    // Limpiar el query param para que no se seleccione de nuevo al recargar
    this.router.navigate([], {
      queryParams: { newCategoryId: null },
      queryParamsHandling: 'merge',
    });
  }

  // Si la URL trae un id, carga el producto para editarlo
  private checkEditMode() {
    const id = this.routeActive.snapshot.paramMap.get('id');
    if (id) {
      this.productId.set(+id);
      this.isEditMode.set(true);

      this.productService
        .getProductById(+id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (product) => {
            this.formProduct.patchValue({
              name: product.name,
              description: product.description,
              price: precioVigente(product.prices)?.amount ?? null,
              brand: product.brand,
              stock: product.stock,
              state: product.state,
              totalSold: product.totalSold,
              category: product.category,
            });

            // Datos de auditoría
            this.auditCreatedAt.set(product.createdAt);
            this.auditUpdatedAt.set(product.updatedAt);
            this.auditStatusDate.set(product.deletedAt || product.createdAt);

            // Valor inicial, para detectar cambios
            const formSnapshot = this.formProduct.getRawValue();
            this.initialFormValue.set(JSON.stringify(formSnapshot));
            this.initialState.set(product.state);

            // El nombre no se puede repetir (salvo con el propio producto)
            this.formProduct.controls.name.setAsyncValidators(
              FormUtils.uniqueFieldValidator('Product', 'name', this.http, +id),
            );

            // Las fotos se pasan al gestor de fotos
            if (product.photos) {
              this.initialPhotos.set(product.photos);
            }

            // El borrador va después de los datos del servidor, para que no lo pisen
            this.restoreDraftIfAny();
          },
          error: () => {
            this.router.navigate(['/admin/products']);
          },
        });
    } else {
      // El nombre no se puede repetir
      this.formProduct.controls.name.addAsyncValidators(
        FormUtils.uniqueFieldValidator('Product', 'name', this.http),
      );
    }
  }

  goToCreateCategory() {
    // Se guarda un borrador del formulario y de las fotos
    const photoState = this.photoManager().getCurrentState();
    this.draftService.setDraft({
      formValue: this.formProduct.getRawValue(),
      isEditMode: this.isEditMode(),
      productId: this.productId(),
      photos: photoState.gallery,
      photosToDeleteIds: photoState.photosToDeleteIds,
      returnUrl: this.router.url,
    });

    // El parámetro avisa al formulario de categorías que se vino desde un producto
    this.router.navigate(['/admin/categories/create'], {
      queryParams: { fromProduct: 'true' },
    });
  }

  onSubmit() {
    if (this.saving()) return;
    if (!this.formProduct.valid) {
      this.formProduct.markAllAsTouched();
      return;
    }

    const formValue = this.formProduct.getRawValue();

    if (!formValue.category || !formValue.category.id) {
      this.alertService.toast('Debe seleccionar una categoría válida', 'error');
      return;
    }
    this.saving.set(true);

    const productJson: ICreateProduct = {
      name: formValue.name,
      description: formValue.description,
      brand: formValue.brand,
      totalSold: Number(formValue.totalSold),
      price: Number(formValue.price),
      stock: Number(formValue.stock),
      state: formValue.state,
      category: formValue.category.id,
    };

    // Guarda o actualiza el producto
    const productId = this.productId();
    const productObs =
      this.isEditMode() && productId
        ? this.productService.updateProduct(productId, productJson)
        : this.productService.addProduct(productJson);

    // Si fallan las fotos se muestra solo el aviso: sweetalert2 muestra un toast por vez
    let photosFailed = false;

    productObs
      .pipe(
        /*
        El producto ya se guardó: se invalida la caché para que los listados se recarguen (aunque
        después falle la subida de las fotos).
        */
        tap(() => this.invalidateCatalog()),
        // Después se guardan las fotos, con el gestor de fotos
        switchMap((responseProduct) =>
          this.savePhotosOrWarn(
            productId ?? responseProduct.id,
            () => (photosFailed = true),
          ),
        ),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          // Las fotos también forman parte de los datos en caché del producto
          this.invalidateCatalog();
          if (!photosFailed) {
            this.alertService.toast('Guardado exitosamente', 'success');
          }
          this.router.navigate(['/admin/products']);
        },
        // El aviso del error lo muestra el interceptor
        error: () => undefined,
      });
  }

  /*
  Guarda las fotos. Si falla, el producto ya quedó guardado: se avisa, se llama a onFail y se
  sigue igual.
  */
  private savePhotosOrWarn(productId: number, onFail: () => void) {
    return this.photoManager()
      .saveChanges(productId)
      .pipe(
        catchError(() => {
          onFail();
          this.alertService.toast(
            'Se guardó, pero no se pudieron actualizar las fotos',
            'warning',
          );
          return of(null);
        }),
      );
  }
}
