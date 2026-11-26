import {
  ChangeDetectionStrategy,
  Component,
  model,
  output,
} from '@angular/core';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { CreateEntityButtonComponent } from '@admin/components/toolbar-components/create-entity-button/create-entity-button.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import { FiscalConditionFilter, UserStateFilter } from '@models/user.model';
import { ClientsFilterButtonComponent } from './components/clients-filter-button/clients-filter-button.component';

@Component({
  selector: 'app-clients-toolbar',
  imports: [
    ToolbarTitleComponent,
    SearchInputComponent,
    CreateEntityButtonComponent,
    ClientsFilterButtonComponent,
  ],
  templateUrl: './clients-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsToolbarComponent {
  searchQuery = model.required<string>();
  fiscalFilter = model.required<FiscalConditionFilter>();
  stateFilter = model.required<UserStateFilter>();

  // Avisa que se pidió crear un cliente
  onAdd = output<void>();
}
