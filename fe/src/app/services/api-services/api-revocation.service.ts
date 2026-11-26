import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ICreateRevocation,
  IRevocationReceipt,
} from '@models/revocation.model';
import { IApiResponse } from '@models/api-response.model';

@Injectable({
  providedIn: 'root',
})
export class ApiRevocationService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/revocations`;

  // Registra una solicitud de arrepentimiento. No requiere sesión.
  create(
    data: ICreateRevocation,
    turnstileToken?: string | null,
  ): Observable<IRevocationReceipt> {
    const headers = turnstileToken
      ? new HttpHeaders({ 'X-Turnstile-Token': turnstileToken })
      : undefined;

    return this.http
      .post<IApiResponse<IRevocationReceipt>>(this.apiUrl, data, {
        headers,
      })
      .pipe(map((response) => response.data));
  }
}
