import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { IApiClient } from '@models/user.model';
import { ProfileDetailsComponent } from './profile-details.component';

// ID 71 de docs/requerimientos/discusiones.md (pregunta 1 de la comparativa): un cliente creado con lo mínimo
// (usuario, correo y contraseña) no tiene que completar nombre, apellido, DNI ni teléfono para guardar un
// cambio en su perfil. Si los carga, se siguen validando.
// Comparativa: docs/requerimientos/campos-de-clientes-comparativa-2026-11-09.md
describe('ProfileDetailsComponent: datos obligatorios del perfil propio', () => {
  function crear() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(ProfileDetailsComponent);
    return fixture.componentInstance;
  }

  it('con solo el correo cargado el formulario es válido', () => {
    const perfil = crear();

    perfil.formPerfil.patchValue({ email: 'ana@example.com' });

    expect(perfil.formPerfil.valid).toBe(true);
  });

  it.each(['name', 'lastName', 'dni', 'phone'] as const)('%s ya no es obligatorio', (campo) => {
    const perfil = crear();
    perfil.formPerfil.patchValue({ email: 'ana@example.com' });

    perfil.formPerfil.controls[campo].setValue('');

    expect(perfil.formPerfil.controls[campo].hasError('required')).toBe(false);
    expect(perfil.formPerfil.valid).toBe(true);
  });

  it('el correo sigue siendo obligatorio', () => {
    const perfil = crear();

    perfil.formPerfil.controls.email.setValue('');

    expect(perfil.formPerfil.controls.email.hasError('required')).toBe(true);
    expect(perfil.formPerfil.valid).toBe(false);
  });

  it('un DNI cargado se sigue validando: con letras es inválido', () => {
    const perfil = crear();
    perfil.formPerfil.patchValue({ email: 'ana@example.com', dni: 'abc1234' });

    expect(perfil.formPerfil.controls.dni.valid).toBe(false);
  });

  it('un teléfono cargado se sigue validando: demasiado corto es inválido', () => {
    const perfil = crear();
    perfil.formPerfil.patchValue({ email: 'ana@example.com', phone: '123' });

    expect(perfil.formPerfil.controls.phone.valid).toBe(false);
  });

  // La base guarda NULL en los datos que el cliente nunca cargó: el formulario los tiene que mostrar vacíos
  it('un perfil con datos en null llena el formulario con textos vacíos, no con null', () => {
    const perfil = crear();
    const sinDatos = { id: 7, email: 'ana@example.com', name: null, lastName: null, dni: null, phone: null } as unknown as IApiClient;

    (perfil as unknown as { patchForm(p: IApiClient): void }).patchForm(sinDatos);

    const valores = perfil.formPerfil.getRawValue();
    expect(valores.name).toBe('');
    expect(valores.lastName).toBe('');
    expect(valores.dni).toBe('');
    expect(valores.phone).toBe('');
    expect(valores.email).toBe('ana@example.com');
  });
});
