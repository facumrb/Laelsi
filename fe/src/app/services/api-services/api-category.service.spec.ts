import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from 'src/environments/environment';
import { PETICION_PUBLICA } from '../../interceptors/peticion-publica';
import { ApiCategoryService } from './api-category.service';

describe('ApiCategoryService', () => {
  const url = `${environment.apiUrl}/categories`;
  let servicio: ApiCategoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ApiCategoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const marca = (ruta: string) => {
    const peticion = http.expectOne((req) => req.url === ruta);
    const valor = peticion.request.context.get(PETICION_PUBLICA);
    peticion.flush({ message: 'ok', data: [] });
    return valor;
  };

  describe('marca de petición pública', () => {
    it('el árbol con estado Activo lleva la marca', () => {
      servicio.getCategoryTree('Activo').subscribe();
      expect(marca(`${url}/tree`)).toBe(true);
    });

    it('el árbol sin estado no lleva la marca (el servidor responde distinto al administrador)', () => {
      servicio.getCategoryTree().subscribe();
      expect(marca(`${url}/tree`)).toBe(false);
    });

    it('el árbol con otro estado no lleva la marca', () => {
      servicio.getCategoryTree('Inactivo').subscribe();
      expect(marca(`${url}/tree`)).toBe(false);
    });

    it('children no lleva la marca', () => {
      servicio.getCategoryChildren(3).subscribe();
      expect(marca(`${url}/3/children`)).toBe(false);
    });

    it('el detalle para la tienda lleva la marca', () => {
      servicio.getCategoryById(3, true).subscribe();
      expect(marca(`${url}/3`)).toBe(true);
    });

    it('el detalle del panel (por defecto) no lleva la marca', () => {
      servicio.getCategoryById(3).subscribe();
      expect(marca(`${url}/3`)).toBe(false);
    });

    it('getAllCategories no lleva la marca', () => {
      servicio.getAllCategories().subscribe();
      expect(marca(url)).toBe(false);
    });

    it('addCategory, updateCategory y deleteCategory no llevan la marca', () => {
      servicio.addCategory({} as never).subscribe();
      expect(marca(url)).toBe(false);
      servicio.updateCategory(3, {}).subscribe();
      expect(marca(`${url}/3`)).toBe(false);
      servicio.deleteCategory(3).subscribe();
      expect(marca(`${url}/3`)).toBe(false);
    });
  });
});
