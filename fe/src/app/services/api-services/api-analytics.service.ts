import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { IAnalyticsSummary } from '@models/analytics.model';
import { environment } from 'src/environments/environment';
import { IApiResponse } from '@models/api-response.model';

@Injectable({
  providedIn: 'root',
})
export class ApiAnalyticsService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/analytics`;

  // Resumen del panel de analíticas (solo Admin). El servidor ya lo entrega calculado
  getSummary(): Observable<IAnalyticsSummary> {
    return this.http
      .get<IApiResponse<IAnalyticsSummary>>(`${this.apiUrl}/summary`)
      .pipe(map((response) => response.data));
  }
}
