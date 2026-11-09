import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from 'src/environments/environment';
import { ApiClientService } from './api-client.service';

// ID 65 de docs/requerimientos/discusiones.md: los clientes se desactivan y reactivan, no se eliminan, y la
// lista se puede filtrar por estado.
describe('ApiClientService: estado', () => {
  const url = `${environment.apiUrl}/clients`;
  const pagina = { message: 'ok', data: { data: [], total: 0, page: 1, limit: 16, totalPages: 1 } };

  let servicio: ApiClientService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ApiClientService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar con el filtro Inactivo lo envía al servidor', () => {
    servicio.getAllClients(1, 16, 'Todos', 'Inactivo').subscribe();

    const peticion = http.expectOne((req) => req.url === url);
    expect(peticion.request.params.get('state')).toBe('Inactivo');
    peticion.flush(pagina);
  });

  it('listar con "Todos" no envía el parámetro de estado', () => {
    servicio.getAllClients(1, 16, 'Todos', 'Todos').subscribe();

    const peticion = http.expectOne((req) => req.url === url);
    expect(peticion.request.params.has('state')).toBe(false);
    peticion.flush(pagina);
  });

  it('buscar también respeta el filtro de estado', () => {
    servicio.searchClients('ana', 1, 16, 'Activo').subscribe();

    const peticion = http.expectOne((req) => req.url === `${url}/search`);
    expect(peticion.request.params.get('query')).toBe('ana');
    expect(peticion.request.params.get('state')).toBe('Activo');
    peticion.flush(pagina);
  });

  it('desactivar manda PATCH /clients/:id/state con Inactivo', () => {
    servicio.setClientState(5, 'Inactivo').subscribe();

    const peticion = http.expectOne(`${url}/5/state`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ state: 'Inactivo' });
    peticion.flush({ message: 'ok' });
  });

  it('reactivar manda PATCH /clients/:id/state con Activo', () => {
    servicio.setClientState(9, 'Activo').subscribe();

    const peticion = http.expectOne(`${url}/9/state`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ state: 'Activo' });
    peticion.flush({ message: 'ok' });
  });
});
