import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { TableActionsComponent } from '@admin/components/table-components/table-actions/table-actions.component';
import { FiscalCondition, IApiClient } from '@models/user.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapEnvelope,
  bootstrapTelephone,
} from '@ng-icons/bootstrap-icons';
import { TableEmptyStateComponent } from '@admin/components/table-components/table-empty-state/table-empty-state.component';
import {
  SKELETON_ROWS,
  TableSkeletonComponent,
} from '@admin/components/table-components/table-skeleton/table-skeleton.component';
import { EntityStateBadgeComponent } from '@admin/components/table-components/entity-state-badge/entity-state-badge.component';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';
import { NombrePersonaPipe } from '@shared/pipes/nombre-persona.pipe';
import { ActivableDirective } from '@shared/directives/activable.directive';

// Clases del distintivo de cada condición fiscal en la tabla
const FISCAL_CONDITION_CLASS: Record<FiscalCondition, string> = {
  [FiscalCondition.ConsumidorFinal]:
    'bg-gray-100 text-gray-700 border-gray-200',
  [FiscalCondition.ResponsableInscripto]:
    'bg-blue-50 text-blue-700 border-blue-200',
  [FiscalCondition.Monotributista]:
    'bg-orange-50 text-orange-700 border-orange-200',
  [FiscalCondition.Exento]: 'bg-green-50 text-green-700 border-green-200',
};

@Component({
  selector: 'app-clients-list',
  imports: [
    ActivableDirective,
    TableActionsComponent,
    NgIconComponent,
    TableEmptyStateComponent,
    TableSkeletonComponent,
    UserAvatarComponent,
    EntityStateBadgeComponent,
    NombrePersonaPipe,
  ],
  viewProviders: provideIcons({
    bootstrapEnvelope,
    bootstrapTelephone,
  }),
  templateUrl: './clients-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsListComponent {
  clients = input.required<IApiClient[]>();
  onEdit = output<IApiClient>();
  onDelete = output<IApiClient>();
  onReactivate = output<IApiClient>();

  // true cuando hay algún filtro activo (búsqueda, condición fiscal o estado)
  isFilterActive = input<boolean>(false);

  // true mientras la página todavía no tiene datos que mostrar
  loading = input<boolean>(false);
  protected skeletonRows = SKELETON_ROWS;

  // Clases del distintivo de la condición fiscal (sin condición o desconocida: Consumidor Final)
  getFiscalConditionClass(condition?: FiscalCondition): string {
    return (
      (condition && FISCAL_CONDITION_CLASS[condition]) ||
      FISCAL_CONDITION_CLASS[FiscalCondition.ConsumidorFinal]
    );
  }
}
