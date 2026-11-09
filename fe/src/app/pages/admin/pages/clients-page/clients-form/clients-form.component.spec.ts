import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ClientsFormComponent } from './clients-form.component';

// ID 71 de docs/requerimientos/discusiones.md: el alta de un cliente desde el panel pedía más datos que el
// registro propio y que la base de datos. El mínimo es el que ya acepta la base: nombre de usuario, correo
// y contraseña. Nombre, apellido, teléfono y DNI son opcionales (pero, si se cargan, se siguen validando).
// Comparativa: docs/requerimientos/campos-de-clientes-comparativa-2026-11-09.md
describe('ClientsFormComponent: campos obligatorios al crear un cliente', () => {
  const credenciales = {
    username: 'ana.perez',
    email: 'ana@example.com',
    password: 'Clave1234',
    confirmPassword: 'Clave1234',
  };

  function crear() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(ClientsFormComponent);
    // Se inicia sin dibujar la plantilla: lo que se prueba es el formulario
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance.formClient;
  }

  it('con solo nombre de usuario, correo y contraseña el formulario es válido', () => {
    const form = crear();

    form.patchValue(credenciales);

    expect(form.valid).toBe(true);
  });

  it.each(['name', 'lastName', 'dni', 'phone'] as const)('%s ya no es obligatorio', (campo) => {
    const form = crear();
    form.patchValue(credenciales);

    form.controls[campo].setValue('');

    expect(form.controls[campo].hasError('required')).toBe(false);
    expect(form.valid).toBe(true);
  });

  it.each(['username', 'email', 'password'] as const)('%s sigue siendo obligatorio', (campo) => {
    const form = crear();
    form.patchValue(credenciales);

    form.controls[campo].setValue('');

    expect(form.controls[campo].hasError('required')).toBe(true);
    expect(form.valid).toBe(false);
  });

  it('un DNI cargado se sigue validando: con letras es inválido', () => {
    const form = crear();
    form.patchValue({ ...credenciales, dni: 'abc1234' });

    expect(form.controls.dni.valid).toBe(false);
  });

  it('un DNI cargado y correcto es válido', () => {
    const form = crear();
    form.patchValue({ ...credenciales, dni: '30123456' });

    expect(form.controls.dni.valid).toBe(true);
    expect(form.valid).toBe(true);
  });

  it('un nombre de un solo carácter sigue siendo inválido (si se carga, se valida)', () => {
    const form = crear();
    form.patchValue({ ...credenciales, name: 'A' });

    expect(form.controls.name.valid).toBe(false);
  });
});
