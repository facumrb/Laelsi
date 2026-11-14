import { Component, input } from '@angular/core';
import { FormatDatePipe } from '@shared/pipes/format-date.pipe';

@Component({
  selector: 'app-audit-info',
  imports: [FormatDatePipe],
  templateUrl: './audit-info.component.html',
})
export class AuditInfoComponent {
  createdAt = input.required<string | null>();
  updatedAt = input.required<string | null>();
  isActive = input.required<boolean | null>();
  statusDate = input.required<string | null>();
}
