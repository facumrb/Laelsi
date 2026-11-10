import { Component, input, output } from '@angular/core';
import { TableActionsComponent } from '@admin/components/table-components/table-actions/table-actions.component';
import { IApiAdmin } from '@models/user.model';
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

@Component({
  selector: 'app-admins-list',
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
  templateUrl: './admins-list.component.html',
})
export class AdminsListComponent {
  admins = input.required<IApiAdmin[]>();
  onEdit = output<IApiAdmin>();
  onDelete = output<IApiAdmin>();
  onReactivate = output<IApiAdmin>();

  // true cuando hay texto en el buscador del toolbar (lo pasa el padre)
  isFilterActive = input<boolean>(false);

  // true mientras la página todavía no tiene datos que mostrar
  loading = input<boolean>(false);
  protected skeletonRows = SKELETON_ROWS;
}
