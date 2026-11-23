import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  OnDestroy,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapEye,
  bootstrapArrowClockwise,
  bootstrapExclamationTriangle,
  bootstrapCheckCircle,
  bootstrapChevronDown,
  bootstrapCheckLg,
} from '@ng-icons/bootstrap-icons';
import { ApiProductService } from '@services/api-services/api-product.service';
import {
  BulkAdjustmentType,
  IBulkPricePreviewItem,
} from '@models/product.model';
import { AlertService } from '@services/alert.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { PriceAdjustmentInputDirective } from '@shared/directives/price-adjustment-input.directive';
import { ModalShellComponent } from '@shared/components/modals/modal-shell/modal-shell.component';

@Component({
  selector: 'app-bulk-price-modal',
  imports: [
    NgIconComponent,
    CurrencyPipe,
    ClickOutsideDirective,
    ListboxDirective,
    PriceAdjustmentInputDirective,
    ModalShellComponent,
  ],
  viewProviders: [
    provideIcons({
      bootstrapEye,
      bootstrapArrowClockwise,
      bootstrapExclamationTriangle,
      bootstrapCheckCircle,
      bootstrapChevronDown,
      bootstrapCheckLg,
    }),
  ],
  templateUrl: './bulk-price-modal.component.html',
})
export class BulkPriceModalComponent implements OnDestroy {
  private apiService = inject(ApiProductService);
  private alertService = inject(AlertService);

  productIds = input.required<number[]>();
  close = output<void>();
  success = output<void>();

  adjustmentType = signal<BulkAdjustmentType>('percentage');
  adjustmentValue = signal<number>(0);
  roundingRule = signal<string>('none');

  showRoundingOptions = signal(false);
  previewData = signal<IBulkPricePreviewItem[]>([]);
  loadingPreview = signal(false);
  loadingApply = signal(false);

  hasErrors = computed(() => this.previewData().some((item) => !item.isValid));
  allInvalid = computed(
    () =>
      this.previewData().length > 0 &&
      this.previewData().every((item) => !item.isValid),
  );

  protected readonly subtitulo = computed(
    () =>
      `Editando ${this.productIds().length} ${this.productIds().length === 1 ? 'producto' : 'productos'}`,
  );

  roundingLabel = computed(() => {
    switch (this.roundingRule()) {
      case 'ceil':
        return 'Redondeo hacia arriba';
      case 'floor':
        return 'Redondeo hacia abajo';
      default:
        return 'Sin redondeo';
    }
  });

  private _valueSubject = new Subject<number>();
  private _valueSub: Subscription;

  constructor() {
    // Espera 500 ms de inactividad antes de actualizar el signal
    this._valueSub = this._valueSubject
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe((val) => {
        this.adjustmentValue.set(val);
      });

    // Recalcula la vista previa al cambiar los productos, el tipo, el valor o la regla
    effect(() => {
      const ids = this.productIds();
      const type = this.adjustmentType();
      const val = this.adjustmentValue();
      const rule = this.roundingRule();

      if (ids.length > 0 && val !== 0) {
        this.getPreview(ids, type, val, rule);
      } else {
        this.previewData.set([]);
      }
    });
  }

  ngOnDestroy() {
    this._valueSub.unsubscribe();
  }

  setAdjustmentType(type: BulkAdjustmentType) {
    this.adjustmentType.set(type);
  }

  onValueInput(event: Event) {
    const rawValue = (event.target as HTMLInputElement).value;
    const normalized = rawValue.replace(',', '.');
    // Si está vacío o es solo '-', se parsea a 0 para no disparar llamadas fallidas a la API.
    let parsedValue = normalized ? Number(normalized) : 0;
    if (isNaN(parsedValue)) {
      parsedValue = 0;
    }

    this._valueSubject.next(parsedValue);
  }

  selectRoundingRule(rule: string) {
    this.roundingRule.set(rule);
    this.showRoundingOptions.set(false);
  }

  private getPreview(
    ids: number[],
    type: BulkAdjustmentType,
    val: number,
    rule: string,
  ) {
    this.loadingPreview.set(true);
    this.apiService.previewBulkPriceChange(ids, type, val, rule).subscribe({
      next: (data) => {
        this.previewData.set(data);
        this.loadingPreview.set(false);
      },
      error: (err) => {
        this.loadingPreview.set(false);
      },
    });
  }

  onApply() {
    if (this.allInvalid()) return;
    this.loadingApply.set(true);

    this.apiService
      .applyBulkPriceChange(
        this.productIds(),
        this.adjustmentType(),
        this.adjustmentValue(),
        this.roundingRule(),
      )
      .subscribe({
        next: (res) => {
          this.alertService.toast(
            `${res.updatedCount} productos actualizados.`,
            'success',
          );
          this.loadingApply.set(false);
          this.success.emit();
        },
        error: (err) => {
          this.loadingApply.set(false);
        },
      });
  }
}
