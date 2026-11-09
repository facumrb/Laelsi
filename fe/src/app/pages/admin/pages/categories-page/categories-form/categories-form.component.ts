import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { ApiCategoryService } from '@services/api-services/api-category.service';
import {
  ICreateCategory,
  CategoryState,
  IApiCategory,
} from '@models/category.model';
import { ProductDraftService } from '@services/product-draft.service';
import { AlertService } from '@services/alert.service';
import { FormUtils } from '@shared/validators/form-utils';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { AuditInfoComponent } from '@admin/components/audit-info/audit-info.component';
import { FieldErrorComponent } from '@shared/validators/field-error/field-error.component';
import { TrimInputDirective } from '@shared/directives/trim-input.directive';
import { CategoryParentSelectComponent } from './components/category-parent-select/category-parent-select.component';
import { injectInvalidateCatalog } from '@services/queries/catalog-cache';

@Component({
  selector: 'app-categories-form',
  imports: [
    ReactiveFormsModule,
    ClickOutsideDirective,
    TrimInputDirective,
    NgIconComponent,
    AuditInfoComponent,
    GoBackButtonComponent,
    FieldErrorComponent,
    CategoryParentSelectComponent,
    ListboxDirective,
  ],
  viewProviders: [
    provideIcons({
      bootstrapChevronDown,
      bootstrapCheckLg,
    }),
  ],
  templateUrl: './categories-form.component.html',
})
export class CategoriesFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private routeActive = inject(ActivatedRoute);
  private location = inject(Location);
  private categoryService = inject(ApiCategoryService);
  private alertService = inject(AlertService);
  private draftService = inject(ProductDraftService);
  private http = inject(HttpClient);
  private invalidateCatalog = injectInvalidateCatalog();

  // Estados
  isEditMode = signal(false);
  categoryId = signal<number | null>(null);
  initialFormValue = signal<string>(''); // Para hasRealChanges
  initialState = signal<string>('Activo'); // Para AuditInfoComponent

  // Auditoría (signals de auditoria solo lectura)
  auditCreatedAt = signal<string | null>(null);
  auditUpdatedAt = signal<string | null>(null);
  auditStatusDate = signal<string | null>(null);

  allCategories = signal<IApiCategory[]>([]);

  // UI State
  showStateMenu = signal(false);

  formCategory = this.fb.group({
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

  // Seguimiento reactivo del parentId del formulario
  // initialValue: null asegura que en el estado inicial (sin emisiones aún) el valor sea null (raíz)
  currentParentId = toSignal(
    this.formCategory.get('parentId')!.valueChanges.pipe(takeUntilDestroyed()),
    { initialValue: null as number | null },
  );

  // Form control values mapping
  get parentIdControl() {
    return this.formCategory.get(
      'parentId',
    ) as import('@angular/forms').FormControl<number | null>;
  }

  ngOnInit() {
    this.checkEditMode();
    this.loadAllCategories();
  }

  loadAllCategories() {
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.allCategories.set(categories);
      },
    });
  }

  checkEditMode() {
    const id = this.routeActive.snapshot.paramMap.get('id');
    if (id) {
      this.categoryId.set(+id);
      this.isEditMode.set(true);
      this.loadCategory(+id);
    } else {
      // Validación async para creación
      this.formCategory.controls.name.addAsyncValidators(
        FormUtils.uniqueFieldValidator('Category', 'name', this.http),
      );
    }
  }

  loadCategory(id: number) {
    this.categoryService.getCategoryById(id).subscribe({
      next: (category) => {
        this.formCategory.patchValue({
          name: category.name,
          description: category.description || '',
          state: category.state,
          parentId: category.parentId ?? category.parent?.id ?? null,
        });

        // Auditoría
        this.auditCreatedAt.set(category.createdAt);
        this.auditUpdatedAt.set(category.updatedAt);
        this.auditStatusDate.set(category.deletedAt || category.createdAt);

        this.initialState.set(category.state);

        // Snapshot para comparación
        const formSnapshot = this.formCategory.getRawValue();
        this.initialFormValue.set(JSON.stringify(formSnapshot));

        // Validación async para edición
        this.formCategory.controls.name.setAsyncValidators(
          FormUtils.uniqueFieldValidator('Category', 'name', this.http, id),
        );
      },
      error: () => {
        this.location.back();
      },
    });
  }

  // Lógica de "Cambios Reales"
  get hasRealChanges(): boolean {
    if (!this.isEditMode()) return true;
    const currentJson = JSON.stringify(this.formCategory.getRawValue());
    return currentJson !== this.initialFormValue();
  }

  // UI Methods
  toggleStateMenu() {
    this.showStateMenu.update((v) => !v);
  }

  selectState(state: string) {
    this.formCategory.patchValue({ state: state as CategoryState });
    this.showStateMenu.set(false);
  }

  onCancel() {
    const fromProduct =
      this.routeActive.snapshot.queryParamMap.get('fromProduct');
    const draft = this.draftService.getDraft();

    if (fromProduct === 'true' && draft) {
      this.router.navigateByUrl(draft.returnUrl);
    } else {
      this.router.navigate(['/admin/categories']);
    }
  }

  onSubmit() {
    if (!this.formCategory.valid) {
      this.formCategory.markAllAsTouched();
      return;
    }

    const formValue = this.formCategory.getRawValue();
    const categoryData: ICreateCategory = {
      name: formValue.name!,
      description: formValue.description || null,
      state: formValue.state!,
      parentId: formValue.parentId || null,
    };

    let request$;
    if (this.isEditMode() && this.categoryId()) {
      request$ = this.categoryService.updateCategory(
        this.categoryId()!,
        categoryData,
      );
    } else {
      request$ = this.categoryService.addCategory(categoryData);
    }

    request$.subscribe({
      next: (response: IApiCategory) => {
        // La categoría cambió: invalidamos el caché para que los listados se recarguen
        this.invalidateCatalog();

        this.alertService.toast(
          this.isEditMode() ? 'Categoría actualizada' : 'Categoría creada',
          'success',
        );

        // Si venimos de la creación de producto, volvemos allí usando la returnUrl
        const fromProduct =
          this.routeActive.snapshot.queryParamMap.get('fromProduct');
        const draft = this.draftService.getDraft();

        if (fromProduct === 'true' && draft && !this.isEditMode()) {
          this.router.navigateByUrl(
            `${draft.returnUrl}?newCategoryId=${response.id}`,
          );
          return;
        }

        this.router.navigate(['/admin/categories']);
      },
    });
  }
}
