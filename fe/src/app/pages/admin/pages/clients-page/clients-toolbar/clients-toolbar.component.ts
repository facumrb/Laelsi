import { Component, model, output } from '@angular/core';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { CreateEntityButtonComponent } from '@admin/components/toolbar-components/create-entity-button/create-entity-button.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import { UserStateFilter } from '@models/user.model';
import {
  ClientsFilterButtonComponent,
  FiscalConditionFilter,
} from './components/clients-filter-button/clients-filter-button.component';

@Component({
  selector: 'app-clients-toolbar',
  imports: [
    ToolbarTitleComponent,
    SearchInputComponent,
    CreateEntityButtonComponent,
    ClientsFilterButtonComponent,
  ],
  templateUrl: './clients-toolbar.component.html',
})
export class ClientsToolbarComponent {
  searchQuery = model.required<string>();
  fiscalFilter = model.required<FiscalConditionFilter>();
  stateFilter = model.required<UserStateFilter>();

  // OUTPUT: Para avisar que hicieron clic en "Agregar"
  onAdd = output<void>();
}
