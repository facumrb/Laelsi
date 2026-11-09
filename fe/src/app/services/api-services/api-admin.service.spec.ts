import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from 'src/environments/environment';
import { ApiAdminService } from './api-admin.service';

// ID 65 de docs/requerimientos/discusiones.md: los administradores se desactivan y reactivan, no se
// eliminan, y la lista se puede filtrar por estado.
describe('ApiAdminService: estado', () => {
  const url = `${environment.apiUrl}/admins`;
  const pagina = { message: 'ok', data: { data: [], total: 0, page: 1, limit: 16, totalPages: 1 } };

  let servicio: ApiAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ApiAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar con el filtro Activo lo envía al servidor', () => {
    servicio.getAllAdmins(1, 16, 'Activo').subscribe();

    const peticion = http.expectOne((req) => req.url === url);
    expect(peticion.request.params.get('state')).toBe('Activo');
    peticion.flush(pagina);
  });

  it('listar con "Todos" no envía el parámetro de estado', () => {
    servicio.getAllAdmins(1, 16, 'Todos').subscribe();

    const peticion = http.expectOne((req) => req.url === url);
    expect(peticion.request.params.has('state')).toBe(false);
    peticion.flush(pagina);
  });

  it('buscar también respeta el filtro de estado', () => {
    servicio.searchAdmins('luz', 1, 16, 'Inactivo').subscribe();

    const peticion = http.expectOne((req) => req.url === `${url}/search`);
    expect(peticion.request.params.get('state')).toBe('Inactivo');
    peticion.flush(pagina);
  });

  it('desactivar manda PATCH /admins/:id/state con Inactivo', () => {
    servicio.setAdminState(3, 'Inactivo').subscribe();

    const peticion = http.expectOne(`${url}/3/state`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ state: 'Inactivo' });
    peticion.flush({ message: 'ok' });
  });

  it('reactivar manda PATCH /admins/:id/state con Activo', () => {
    servicio.setAdminState(4, 'Activo').subscribe();

    const peticion = http.expectOne(`${url}/4/state`);
    expect(peticion.request.body).toEqual({ state: 'Activo' });
    peticion.flush({ message: 'ok' });
  });
});
