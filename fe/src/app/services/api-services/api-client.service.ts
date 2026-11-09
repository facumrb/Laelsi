import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  IApiClient,
  ICreateClient,
  IUpdateClient,
  UserState,
  UserStateFilter,
} from '@models/user.model';
import { IPaginatedResult } from '@models/pagination.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clients`;

  getAllClients(
    page: number = 1,
    limit: number = 16,
    fiscalCondition?: string,
    state?: UserStateFilter,
  ): Observable<IPaginatedResult<IApiClient>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (fiscalCondition && fiscalCondition !== 'Todos') {
      params = params.set('fiscalCondition', fiscalCondition);
    }
    // 'Todos' no se envía: el servidor lista activos e inactivos
    if (state && state !== 'Todos') {
      params = params.set('state', state);
    }
    return this.http
      .get<{
        message: string;
        data: IPaginatedResult<IApiClient>;
      }>(this.apiUrl, { params })
      .pipe(map((response) => response.data));
  }

  getClientById(id: number): Observable<IApiClient> {
    return this.http
      .get<{ message: string; data: IApiClient }>(`${this.apiUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  getAccountInfoById(id: number): Observable<IApiClient> {
    return this.http
      .get<{
        message: string;
        data: IApiClient;
      }>(`${this.apiUrl}/account/${id}`)
      .pipe(map((response) => response.data));
  }

  // Buscar clientes por nombre, apellido, nombre de usuario o dni
  searchClients(
    query: string,
    page: number = 1,
    limit: number = 16,
    state?: UserStateFilter,
  ): Observable<IPaginatedResult<IApiClient>> {
    let params = new HttpParams()
      .set('query', query)
      .set('page', page)
      .set('limit', limit);
    if (state && state !== 'Todos') {
      params = params.set('state', state);
    }
    return this.http
      .get<{
        message: string;
        data: IPaginatedResult<IApiClient>;
      }>(`${this.apiUrl}/search`, { params })
      .pipe(map((response) => response.data));
  }

  addClient(client: ICreateClient): Observable<IApiClient> {
    return this.http
      .post<{ message: string; data: IApiClient }>(this.apiUrl, client)
      .pipe(map((response) => response.data));
  }

  updateClient(id: number, client: IUpdateClient): Observable<IApiClient> {
    return this.http
      .patch<{
        message: string;
        data: IApiClient;
      }>(`${this.apiUrl}/${id}`, client)
      .pipe(map((response) => response.data));
  }

  // Desde el ID 65 el servidor ya no borra clientes: DELETE los DESACTIVA. Se conserva por compatibilidad;
  // el panel usa setClientState, que sirve también para reactivar.
  deleteClient(id: number): Observable<void> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }

  // Desactiva o reactiva un cliente (conserva sus datos y su historial de pedidos)
  setClientState(id: number, state: UserState): Observable<void> {
    return this.http
      .patch<{ message: string }>(`${this.apiUrl}/${id}/state`, { state })
      .pipe(map(() => void 0));
  }
}
