import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { ApiCategoryService } from '@services/api-services/api-category.service';
import { IApiCategory } from '@models/category.model';
import { ProductDraftService } from '@services/product-draft.service';
import { FormUtils } from '@shared/validators/form-utils';
import { ApiProductService } from '@services/api-services/api-product.service';
import { AlertService } from '@services/alert.service';
import { ICreateProduct, ProductState } from '@models/product.model';
import { PhotoManagerComponent } from './components/photo-manager/photo-manager.component';
import { ProductCategorySelectComponent } from './components/product-category-select/product-category-select.component';
import { IApiProductPhoto } from '@models/photo.model';
import { NumericInputDirective } from '@shared/directives/numeric-input.directive';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
  bootstrapPlusLg,
} from '@ng-icons/bootstrap-icons';
import { AuditInfoComponent } from '@admin/components/audit-info/audit-info.component';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';

@Component({
  selector: 'app-products-form',
  imports: [
    ReactiveFormsModule,
    NumericInputDirective,
    ClickOutsideDirective,
    PhotoManagerComponent,
    NgIconComponent,
    AuditInfoComponent,
    GoBackButtonComponent,
    FieldErrorComponent,
    TrimInputDirective,
    ProductCategorySelectComponent,
    ListboxDirective,
  ],
  viewProviders: [
    provideIcons({
      bootstrapChevronDown,
      bootstrapCheckLg,
      bootstrapPlusLg,
    }),
  ],
  templateUrl: './products-form.component.html',
})
export class ProductsFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private routeActive = inject(ActivatedRoute);
  location = inject(Location);
  private categoryService = inject(ApiCategoryService);
  private productService = inject(ApiProductService);
  private alertService = inject(AlertService);
  private draftService = inject(ProductDraftService);
  private http = inject(HttpClient);
  private invalidateCatalog = injectInvalidateCatalog();

  formUtils = FormUtils;

  // Acceso al hijo para llamar a su método de guardar
  @ViewChild(PhotoManagerComponent)
  photoManager!: PhotoManagerComponent;

  // Fotos iniciales para pasar al hijo
  initialPhotos = signal<IApiProductPhoto[]>([]);

  // Estados
  categories = signal<IApiCategory[]>([]);
  isEditMode = signal(false);
  productId = signal<number | null>(null);

  // Señal para guardar el estado inicial del formulario
  initialFormValue = signal<string>('');
  initialState = signal<string>('Activo');

  // Auditoría (signals de auditoria solo lectura)
  auditCreatedAt = signal<string | null>(null);
  auditUpdatedAt = signal<string | null>(null);
  auditStatusDate = signal<string | null>(null);

  // Formulario
  formProduct = this.fb.group({
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
        Validators.min(0),
        Validators.pattern(FormUtils.numberPattern),
      ],
    ],
    brand: ['', [Validators.required, FormUtils.notOnlyWhiteSpace]],
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
    photos: [[]], // array vacío por defecto por si no se cargan fotos
  });

  ngOnInit() {
    this.loadCategories();
    this.checkEditMode();
    this.restoreDraftIfAny();
  }

  restoreDraftIfAny() {
    if (this.draftService.hasDraft()) {
      const draft = this.draftService.getDraft()!;
      this.isEditMode.set(draft.isEditMode);
      this.productId.set(draft.productId);

      const { photos, ...formValueWithoutPhotos } = draft.formValue;
      this.formProduct.patchValue(formValueWithoutPhotos);

      // Restaurar fotos después de que el componente hijo esté disponible
      setTimeout(() => {
        if (this.photoManager) {
          this.photoManager.restoreState({
            gallery: draft.photos as any[],
            photosToDeleteIds: draft.photosToDeleteIds,
          });
        }
      }, 0);

      this.draftService.clearDraft();
    }
  }

  // 1. Cargar categorías para el desplegable
  loadCategories() {
    this.categoryService.getAllCategories().subscribe((data) => {
      this.categories.set(data);

      // Verificamos si hay una nueva categoría para seleccionar automáticamente
      const newCatId =
        this.routeActive.snapshot.queryParamMap.get('newCategoryId');
      if (newCatId) {
        const cat = data.find((c) => c.id === +newCatId);
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
    });
  }

  // 2. Verificar si venimos a Editar (por URL)
  checkEditMode() {
    const id = this.routeActive.snapshot.paramMap.get('id');
    if (id) {
      this.productId.set(+id);
      this.isEditMode.set(true);

      this.productService.getProductById(+id).subscribe({
        next: (product) => {
          const currentPrice = product.prices?.find((p) => p.isCurrent);

          this.formProduct.patchValue({
            name: product.name,
            description: product.description,
            price: currentPrice ? currentPrice.amount : null,
            brand: product.brand,
            stock: product.stock,
            state: product.state,
            totalSold: product.totalSold,
            category: product.category,
          });

          // Auditoría
          this.auditCreatedAt.set(product.createdAt);
          this.auditUpdatedAt.set(product.updatedAt);
          this.auditStatusDate.set(product.deletedAt || product.createdAt);

          const formSnapshot = this.formProduct.getRawValue();

          this.initialFormValue.set(JSON.stringify(formSnapshot));
          this.initialState.set(product.state);

          // Validación async para edición
          this.formProduct.controls.name.setAsyncValidators(
            FormUtils.uniqueFieldValidator('Product', 'name', this.http, +id),
          );

          // PASAMOS LAS FOTOS AL HIJO
          if (product.photos) {
            this.initialPhotos.set(product.photos);
          }
        },
      });
    } else {
      // Validación async para creación
      this.formProduct.controls.name.addAsyncValidators(
        FormUtils.uniqueFieldValidator('Product', 'name', this.http),
      );
    }
  }

  // UI States
  showStateMenu = signal(false);

  // --- Lógica de Menús de acordeon ---
  toggleStateMenu() {
    this.showStateMenu.update((v) => !v);
  }
  selectState(state: string) {
    this.formProduct.patchValue({ state: state as ProductState });
    this.showStateMenu.set(false);
  }

  goToCreateCategory() {
    // Guardar borrador
    const photoState = this.photoManager.getCurrentState();
    this.draftService.setDraft({
      formValue: this.formProduct.getRawValue(),
      isEditMode: this.isEditMode(),
      productId: this.productId(),
      photos: photoState.gallery,
      photosToDeleteIds: photoState.photosToDeleteIds,
      returnUrl: this.router.url,
    });

    // Navegar con query param para saber que venimos de producto
    this.router.navigate(['/admin/categories/create'], {
      queryParams: { fromProduct: 'true' },
    });
  }

  get hasRealChanges(): boolean {
    if (!this.isEditMode()) return true;

    // Comparamos el JSON actual completo contra el inicial
    const currentJson = JSON.stringify(this.formProduct.getRawValue());
    const formHasChanges = currentJson !== this.initialFormValue();

    // Verificar fotos
    const photosHaveChanges = this.photoManager?.hasChanges() ?? false;

    return formHasChanges || photosHaveChanges;
  }

  onSubmit() {
    if (this.formProduct.valid) {
      const formValue = this.formProduct.getRawValue();

      if (!formValue.category || !formValue.category.id) {
        this.alertService.toast(
          'Debe seleccionar una categoría válida',
          'error',
        );
        return;
      }

      const productJson: ICreateProduct = {
        name: formValue.name!,
        description: formValue.description!,
        brand: formValue.brand!,
        totalSold: Number(formValue.totalSold),
        price: Number(formValue.price),
        stock: Number(formValue.stock),
        state: formValue.state!,
        category: formValue.category.id,
      };

      // GUARDAR/ACTUALIZAR PRODUCTO (PADRE)
      let productObs;
      if (this.isEditMode() && this.productId()) {
        productObs = this.productService.updateProduct(
          this.productId()!,
          productJson,
        );
      } else {
        productObs = this.productService.addProduct(productJson);
      }

      productObs.subscribe({
        next: (responseProduct) => {
          // El producto ya se guardó: invalidamos el caché para que los listados
          // se recarguen (aunque después falle la subida de las fotos)
          this.invalidateCatalog();

          const finalId = this.isEditMode()
            ? this.productId()!
            : responseProduct.id;

          // DELEGAR FOTOS AL HIJO
          this.photoManager.saveChanges(finalId).subscribe({
            next: () => {
              // Las fotos también forman parte de los datos en caché del producto
              this.invalidateCatalog();
              this.alertService.toast('Guardado exitosamente', 'success');
              this.router.navigate(['/admin/products']);
            },
          });
        },
      });
    } else {
      this.formProduct.markAllAsTouched();
    }
  }
}
