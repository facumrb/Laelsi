import {
  ChangeDetectionStrategy,
  Component,
  model,
  output,
} from '@angular/core';
import { SearchInputComponent } from '@admin/components/toolbar-components/search-input/search-input.component';
import { CreateEntityButtonComponent } from '@admin/components/toolbar-components/create-entity-button/create-entity-button.component';
import { ToolbarTitleComponent } from '@admin/components/toolbar-components/toolbar-title/toolbar-title.component';
import { UserStateFilter } from '@models/user.model';
import { AdminsFilterButtonComponent } from './components/admins-filter-button/admins-filter-button.component';

@Component({
  selector: 'app-admins-toolbar',
  imports: [
    ToolbarTitleComponent,
    SearchInputComponent,
    CreateEntityButtonComponent,
    AdminsFilterButtonComponent,
  ],
  templateUrl: './admins-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminsToolbarComponent {
  searchQuery = model.required<string>();
  stateFilter = model.required<UserStateFilter>();

  // Avisa que se pidió crear un administrador
  onAdd = output<void>();
}
