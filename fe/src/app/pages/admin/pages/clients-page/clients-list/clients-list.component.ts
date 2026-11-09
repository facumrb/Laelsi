import { Component, input, output } from '@angular/core';
import { TableActionsComponent } from '@admin/components/table-components/table-actions/table-actions.component';
import { IApiClient } from '@models/user.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapEnvelope,
  bootstrapTelephone,
} from '@ng-icons/bootstrap-icons';

import { TableEmptyStateComponent } from '@admin/components/table-components/table-empty-state/table-empty-state.component';
import { EntityStateBadgeComponent } from '@admin/components/table-components/entity-state-badge/entity-state-badge.component';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';
import { NombrePersonaPipe } from '@shared/pipes/nombre-persona.pipe';
import { ActivableDirective } from '@shared/directives/activable.directive';

@Component({
  selector: 'app-clients-list',
  imports: [
    ActivableDirective,
    TableActionsComponent,
    NgIconComponent,
    TableEmptyStateComponent,
    UserAvatarComponent,
    EntityStateBadgeComponent,
    NombrePersonaPipe,
  ],
  viewProviders: provideIcons({
    bootstrapEnvelope,
    bootstrapTelephone,
  }),
  templateUrl: './clients-list.component.html',
})
export class ClientsListComponent {
  clients = input.required<IApiClient[]>();
  onEdit = output<IApiClient>();
  onDelete = output<IApiClient>();
  onReactivate = output<IApiClient>();

  isFilterActive = input<boolean>(false);

  // Función para determinar el color segun la condición fiscal
  getFiscalConditionClass(condition?: string): string {
    const fiscal = condition || 'Consumidor Final';

    switch (fiscal) {
      case 'Responsable Inscripto':
        return 'bg-blue-50 text-blue-700 border-blue-200';

      case 'Monotributista':
        return 'bg-orange-50 text-orange-700 border-orange-200';

      case 'Exento':
        return 'bg-green-50 text-green-700 border-green-200';

      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }
}
