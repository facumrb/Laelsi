import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogHostComponent } from '@shared/components/modals/dialog-host/dialog-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DialogHostComponent],
  template: `<router-outlet /><app-dialog-host />`,
})
export class AppComponent {}
