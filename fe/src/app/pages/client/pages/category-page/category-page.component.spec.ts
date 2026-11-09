import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryState } from '@models/category.model';
import { IApiProduct, ProductState } from '@models/product.model';
import { supabase } from '@services/supabase.client';
import { environment } from 'src/environments/environment';
import { CategoryPageComponent } from './category-page.component';

const categoria = {
  id: 5,
  name: 'Librería',
  order: 1,
  state: CategoryState.Activo,
  parentId: null,
  parent: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

function producto(id: number, marca: string): IApiProduct {
  return {
    id,
    name: `Producto ${id}`,
    description: 'Descripción',
    brand: marca,
    totalSold: 0,
    state: ProductState.Activo,
    stock: 5,
    prices: [{ id, amount: 100, currency: 'ARS', validFrom: '2026-10-01T00:00:00Z', isCurrent: true }],
    photos: [],
    category: categoria,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

// La categoría tiene 20 productos de 3 marcas pero la página 1 trae 16 de una sola: antes la lista
// de marcas del filtro salía de esa página y ofrecía únicamente "Faber".
describe('CategoryPageComponent: filtro de marcas', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    // No se le habla al Supabase real
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: () => undefined } },
    } as never);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '5' })), queryParamMap: of(convertToParamMap({})) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ofrece todas las marcas que informa el servidor, aunque la página tenga productos de una sola', async () => {
    const fixture = TestBed.createComponent(CategoryPageComponent);
    fixture.detectChanges();

    const detalle = await vi.waitFor(() => http.expectOne(`${environment.apiUrl}/categories/5`));
    detalle.flush({ data: categoria });
    const productos = await vi.waitFor(() =>
      http.expectOne((req) => req.url === `${environment.apiUrl}/products/active/category/5`),
    );
    productos.flush({
      data: {
        data: Array.from({ length: 16 }, (_, i) => producto(i + 1, 'Faber')),
        total: 20,
        page: 1,
        limit: 16,
        totalPages: 2,
        brands: ['Bic', 'Faber', 'Zeta'],
      },
    });

    await vi.waitFor(() => expect(fixture.componentInstance.availableBrands()).toEqual(['Bic', 'Faber', 'Zeta']));
  });

  it('mientras no responde el servidor no hay marcas que ofrecer', () => {
    const fixture = TestBed.createComponent(CategoryPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.availableBrands()).toEqual([]);
  });
});

// ID 70 de docs/requerimientos/discusiones.md (esqueletos): Lighthouse medía un salto de diseño (CLS) de 0,361 en la
// categoría. Mientras cargaba mostraba 'No hay productos que coincidan con tus filtros', sin el título, y recién
// después aparecía todo, empujando el contenido. Ahora se reserva el lugar: el título y la grilla tienen su esqueleto
// y el cartel de 'no hay productos' solo aparece si de verdad no hay.
describe('CategoryPageComponent: esqueleto mientras carga', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: () => undefined } },
    } as never);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '5' })), queryParamMap: of(convertToParamMap({})) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cartelVacio = 'No hay productos que coincidan con tus filtros';
  const esqueletos = (raiz: HTMLElement) => raiz.querySelectorAll('app-product-card-skeleton').length;

  async function responder(fixture: ReturnType<typeof TestBed.createComponent<CategoryPageComponent>>, productos: IApiProduct[]) {
    const detalle = await vi.waitFor(() => http.expectOne(`${environment.apiUrl}/categories/5`));
    detalle.flush({ data: categoria });
    const lista = await vi.waitFor(() =>
      http.expectOne((req) => req.url === `${environment.apiUrl}/products/active/category/5`),
    );
    lista.flush({ data: { data: productos, total: productos.length, page: 1, limit: 16, totalPages: 1, brands: [] } });
    fixture.detectChanges();
  }

  it('mientras carga muestra tarjetas de esqueleto y no el cartel de que no hay productos', () => {
    const fixture = TestBed.createComponent(CategoryPageComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(esqueletos(raiz)).toBe(8);
    expect(raiz.textContent).not.toContain(cartelVacio);
  });

  it('mientras carga reserva el lugar del título: el encabezado existe, sin título todavía', () => {
    const fixture = TestBed.createComponent(CategoryPageComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('header.section-header')).toBeTruthy();
    expect(raiz.querySelector('header.section-header h1')).toBeNull();
  });

  it('la grilla avisa que está cargando, para quien usa lector de pantalla', () => {
    const fixture = TestBed.createComponent(CategoryPageComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('.product-grid')?.getAttribute('aria-busy')).toBe('true');
    expect(raiz.querySelector('[role=status]')?.textContent).toContain('Cargando productos');
  });

  it('cuando llegan los datos, las tarjetas reales reemplazan al esqueleto y aparece el título', async () => {
    const fixture = TestBed.createComponent(CategoryPageComponent);
    fixture.detectChanges();
    await responder(fixture, [producto(1, 'Faber'), producto(2, 'Bic')]);
    const raiz = fixture.nativeElement as HTMLElement;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(esqueletos(raiz)).toBe(0);
      expect(raiz.querySelectorAll('app-product-card').length).toBe(2);
      expect(raiz.querySelector('header.section-header h1')?.textContent).toContain('Librería');
      expect(raiz.querySelector('.product-grid')?.getAttribute('aria-busy')).toBe('false');
    });
  });

  it('una categoría que de verdad no tiene productos muestra el cartel, no el esqueleto', async () => {
    const fixture = TestBed.createComponent(CategoryPageComponent);
    fixture.detectChanges();
    await responder(fixture, []);
    const raiz = fixture.nativeElement as HTMLElement;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(raiz.textContent).toContain(cartelVacio);
      expect(esqueletos(raiz)).toBe(0);
    });
  });
});
