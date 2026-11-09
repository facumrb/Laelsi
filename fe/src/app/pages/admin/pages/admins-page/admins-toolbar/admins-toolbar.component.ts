import { Component, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';

import { CreateEntityButtonComponent } from '@admin/components/toolbar-components/create-entity-button/create-entity-button.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import { UserStateFilter } from '@models/user.model';
import { AdminsFilterButtonComponent } from './components/admins-filter-button/admins-filter-button.component';

@Component({
  selector: 'app-admins-toolbar',
  imports: [
    ToolbarTitleComponent,
    FormsModule,
    SearchInputComponent,
    CreateEntityButtonComponent,
    AdminsFilterButtonComponent,
  ],
  templateUrl: './admins-toolbar.component.html',
})
export class AdminsToolbarComponent {
  searchQuery = model.required<string>();
  stateFilter = model.required<UserStateFilter>();

  // OUTPUT: Para avisar que hicieron clic en "Agregar"
  onAdd = output<void>();
}
