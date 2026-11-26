import { Component, input } from '@angular/core';

@Component({
  selector: 'app-toolbar-title',
  template: `
    <h1 class="page-title">
      <span class="whitespace-nowrap">Gestión de</span> {{ title() }}
    </h1>
  `,
})
export class ToolbarTitleComponent {
  title = input.required<string>();
}
