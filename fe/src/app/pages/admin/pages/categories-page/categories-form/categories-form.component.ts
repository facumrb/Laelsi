import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormPageHeaderComponent } from '@admin/components/form-page-header/form-page-header.component';
import { FormActionsComponent } from '@admin/components/form-actions/form-actions.component';
import { ApiCategoryService } from '@services/api-services/api-category.service';
import {
  ICreateCategory,
  CategoryState,
  IApiCategory,
} from '@models/category.model';
import { ProductDraftService } from '@services/product-draft.service';
import { AlertService } from '@services/alert.service';
import { FormUtils } from '@shared/validators/form-utils';
import { AuditInfoComponent } from '@admin/components/audit-info/audit-info.component';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { CategoryParentSelectComponent } from './components/category-parent-select/category-parent-select.component';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';
import { injectAllCategoriesQuery } from '@services/queries/category-queries';
import { StateSelectComponent } from '@admin/components/state-select/state-select.component';

@Component({
  selector: 'app-categories-form',
  imports: [
    ReactiveFormsModule,
    TrimInputDirective,
    AuditInfoComponent,
    FormPageHeaderComponent,
    FormActionsComponent,
    FieldErrorComponent,
    CategoryParentSelectComponent,
    StateSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories-form.component.html',
})
export class CategoriesFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private routeActive = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private categoryService = inject(ApiCategoryService);
  private alertService = inject(AlertService);
  private draftService = inject(ProductDraftService);
  private http = inject(HttpClient);
  private invalidateCatalog = injectInvalidateCatalog();

  isEditMode = signal(false);
  categoryId = signal<number | null>(null);
  // Hay un guardado en curso: evita el doble envío
  saving = signal(false);
  // Valor inicial del formulario, para detectar cambios al editar
  initialFormValue = signal<string>('');

  // Datos de auditoría (solo lectura)
  initialState = signal<CategoryState>(CategoryState.Activo);
  auditCreatedAt = signal<string | null>(null);
  auditUpdatedAt = signal<string | null>(null);
  auditStatusDate = signal<string | null>(null);

  private categoriesQuery = injectAllCategoriesQuery();

  // Lista de categorías para el selector de padre (desde la caché de TanStack Query)
  allCategories = computed(() => this.categoriesQuery.data() ?? []);

  // Estados que se ofrecen, en el orden en que se muestran
  readonly stateOptions = Object.values(CategoryState);

  formCategory = this.fb.nonNullable.group({
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
    description: ['', [FormUtils.maxLength(1000), FormUtils.notOnlyWhiteSpace]],
    state: [CategoryState.Activo, [Validators.required]],
    parentId: [null as number | null],
  });

  // Valor actual del formulario como señal
  private formValue = toSignal(this.formCategory.valueChanges, {
    initialValue: this.formCategory.getRawValue(),
  });

  // Categoría madre elegida (null = raíz)
  currentParentId = computed(() => this.formValue().parentId ?? null);

  ngOnInit() {
    this.checkEditMode();
  }

  private checkEditMode() {
    const id = this.routeActive.snapshot.paramMap.get('id');
    if (id) {
      this.categoryId.set(+id);
      this.isEditMode.set(true);
      this.loadCategory(+id);
    } else {
      // El nombre no se puede repetir
      this.formCategory.controls.name.addAsyncValidators(
        FormUtils.uniqueFieldValidator('Category', 'name', this.http),
      );
    }
  }

  private loadCategory(id: number) {
    this.categoryService
      .getCategoryById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (category) => {
          this.formCategory.patchValue({
            name: category.name,
            description: category.description || '',
            state: category.state,
            parentId: category.parentId ?? category.parent?.id ?? null,
          });

          this.auditCreatedAt.set(category.createdAt);
          this.auditUpdatedAt.set(category.updatedAt);
          this.auditStatusDate.set(category.deletedAt || category.createdAt);

          this.initialState.set(category.state);

          const formSnapshot = this.formCategory.getRawValue();
          this.initialFormValue.set(JSON.stringify(formSnapshot));

          // El nombre no se puede repetir (salvo con la propia categoría)
          this.formCategory.controls.name.setAsyncValidators(
            FormUtils.uniqueFieldValidator('Category', 'name', this.http, id),
          );
        },
        error: () => {
          this.router.navigate(['/admin/categories']);
        },
      });
  }

  // Indica si hay algo para guardar: al crear siempre, al editar si cambió el formulario
  hasRealChanges = computed(() => {
    if (!this.isEditMode()) return true;
    return JSON.stringify(this.formValue()) !== this.initialFormValue();
  });

  // Destino de "Cancelar" y "Volver": el producto si se vino desde él (con borrador), si no el listado
  cancelUrl(): string {
    return this.productDraftToReturn()?.returnUrl ?? '/admin/categories';
  }

  // Borrador del producto desde el que se abrió el formulario (null si no se vino desde uno)
  private productDraftToReturn() {
    const fromProduct =
      this.routeActive.snapshot.queryParamMap.get('fromProduct');
    return fromProduct === 'true' ? this.draftService.getDraft() : null;
  }

  onSubmit() {
    if (this.saving()) return;
    if (!this.formCategory.valid) {
      this.formCategory.markAllAsTouched();
      return;
    }
    this.saving.set(true);

    const formValue = this.formCategory.getRawValue();
    const categoryData: ICreateCategory = {
      name: formValue.name,
      description: formValue.description || null,
      state: formValue.state,
      parentId: formValue.parentId || null,
    };

    const categoryId = this.categoryId();
    const request$ =
      this.isEditMode() && categoryId
        ? this.categoryService.updateCategory(categoryId, categoryData)
        : this.categoryService.addCategory(categoryData);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (response: IApiCategory) => {
        // La categoría cambió: los listados se vuelven a pedir
        this.invalidateCatalog();

        this.alertService.toast(
          this.isEditMode() ? 'Categoría actualizada' : 'Categoría creada',
          'success',
        );

        // Si se vino desde un producto, se vuelve a él con la categoría nueva ya elegida
        const draft = this.productDraftToReturn();
        if (draft && !this.isEditMode()) {
          this.router.navigateByUrl(
            `${draft.returnUrl}?newCategoryId=${response.id}`,
          );
          return;
        }

        this.router.navigate(['/admin/categories']);
      },
      // El aviso del error lo muestra el interceptor
      error: () => undefined,
    });
  }
}
