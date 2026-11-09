import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { A11yModule } from '@angular/cdk/a11y';
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
import { IBulkPricePreviewItem } from '@models/product.model';
import { AlertService } from '@services/alert.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { ListboxDirective } from '@shared/directives/listbox.directive';
import { PriceAdjustmentInputDirective } from '@shared/directives/price-adjustment-input.directive';
import { CloseModalButtonComponent } from '@shared/components/buttons/close-modal-button/close-modal-button.component';

@Component({
  selector: 'app-bulk-price-modal',
  imports: [
    NgIconComponent,
    CurrencyPipe,
    ClickOutsideDirective,
    ListboxDirective,
    PriceAdjustmentInputDirective,
    CloseModalButtonComponent,
    A11yModule,
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

  // Inputs / Outputs
  productIds = input.required<number[]>();
  close = output<void>();
  success = output<void>();

  // Signals de Configuración
  adjustmentType = signal<'percentage' | 'fixed'>('percentage');
  adjustmentValue = signal<number>(0);
  roundingRule = signal<string>('none');

  // UI State
  showRoundingOptions = signal(false); // Para el custom select
  previewData = signal<IBulkPricePreviewItem[]>([]);
  loadingPreview = signal(false);
  loadingApply = signal(false);

  // Computeds
  hasErrors = computed(() => this.previewData().some((item) => !item.isValid));
  allInvalid = computed(
    () =>
      this.previewData().length > 0 &&
      this.previewData().every((item) => !item.isValid),
  );

  // Lógica para etiquetas del select
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

  // Manejo de Debounce para el Input
  private _valueSubject = new Subject<number>();
  private _valueSub: Subscription;

  constructor() {
    // 1. Configurar Debounce: Espera 500ms de inactividad antes de actualizar el signal
    this._valueSub = this._valueSubject
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe((val) => {
        this.adjustmentValue.set(val);
      });

    // 2. Efecto Automático: Reacciona a cambios en Tipos, Valor o Regla
    effect(() => {
      // Leemos los signals para registrar la dependencia
      const ids = this.productIds();
      const type = this.adjustmentType();
      const val = this.adjustmentValue();
      const rule = this.roundingRule();

      // Solo llamar a la API si hay un valor válido (distinto de 0)
      if (ids.length > 0 && val !== 0) {
        this.getPreview(ids, type, val, rule);
      } else {
        // Si el valor es 0 o vacío, limpiamos la tabla
        this.previewData.set([]);
      }
    });
  }

  ngOnDestroy() {
    this._valueSub.unsubscribe();
  }

  // --- MÉTODOS DE UI ---

  setAdjustmentType(type: 'percentage' | 'fixed') {
    this.adjustmentType.set(type);
  }

  onValueInput(event: Event) {
    const rawValue = (event.target as HTMLInputElement).value;
    // Normalizar separador decimal: coma → punto
    const normalized = rawValue.replace(',', '.');
    // Si está vacío o es solo '-', se parsea a 0 para no disparar llamadas fallidas a la API.
    let parsedValue = normalized ? Number(normalized) : 0;
    if (isNaN(parsedValue)) {
      parsedValue = 0;
    }

    // Pasamos el valor al Subject para que aplique el debounce
    this._valueSubject.next(parsedValue);
  }

  selectRoundingRule(rule: string) {
    this.roundingRule.set(rule);
    this.showRoundingOptions.set(false);
  }

  private getPreview(ids: number[], type: string, val: number, rule: string) {
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

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.close.emit();
  }
}
