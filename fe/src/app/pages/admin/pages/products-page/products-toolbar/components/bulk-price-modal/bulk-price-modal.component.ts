import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { catchError, EMPTY, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
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

// Parámetros de un pedido de vista previa
interface PreviewRequest {
  ids: number[];
  type: BulkAdjustmentType;
  val: number;
  rule: string;
}

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkPriceModalComponent {
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

  // Valores escritos en el campo, antes de esperar a que se deje de escribir
  private _valueSubject = new Subject<number>();

  // Pedidos de vista previa (null: no hay nada que previsualizar)
  private previewRequests = new Subject<PreviewRequest | null>();

  constructor() {
    // Espera 500 ms de inactividad antes de actualizar el signal
    this._valueSubject
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((val) => {
        this.adjustmentValue.set(val);
      });

    /*
    Cada pedido nuevo cancela el anterior (switchMap): así una respuesta lenta de valores viejos
    no pisa la vista previa de los actuales.
    */
    this.previewRequests
      .pipe(
        switchMap((req) => {
          if (!req) {
            this.previewData.set([]);
            this.loadingPreview.set(false);
            return EMPTY;
          }
          this.loadingPreview.set(true);
          return (
            this.apiService
              .previewBulkPriceChange(req.ids, req.type, req.val, req.rule)
              // El aviso del error lo muestra el interceptor
              .pipe(catchError(() => of(null)))
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((data) => {
        if (data) this.previewData.set(data);
        this.loadingPreview.set(false);
      });

    // Recalcula la vista previa al cambiar los productos, el tipo, el valor o la regla
    effect(() => {
      const ids = this.productIds();
      const type = this.adjustmentType();
      const val = this.adjustmentValue();
      const rule = this.roundingRule();

      this.previewRequests.next(
        ids.length > 0 && val !== 0 ? { ids, type, val, rule } : null,
      );
    });
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
            `${res.updatedCount} ${res.updatedCount === 1 ? 'producto actualizado' : 'productos actualizados'}.`,
            'success',
          );
          this.loadingApply.set(false);
          this.success.emit();
        },
        error: () => {
          this.loadingApply.set(false);
        },
      });
  }
}
