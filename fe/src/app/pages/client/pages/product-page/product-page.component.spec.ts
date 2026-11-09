import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryState } from '@models/category.model';
import { IApiProduct, ProductState } from '@models/product.model';
import { supabase } from '@services/supabase.client';
import { environment } from 'src/environments/environment';
import { ProductPageComponent } from './product-page.component';

// ID 70 de docs/requerimientos/discusiones.md (esqueletos): Lighthouse medía un salto de diseño (CLS) de 0,578 en la
// ficha de producto, el peor de la tienda. La página no mostraba nada mientras cargaba y después aparecía todo junto,
// empujando el contenido. Ahora se reserva el lugar con un esqueleto de la misma estructura.
describe('ProductPageComponent: esqueleto mientras carga', () => {
  const categoria = {
    id: 5,
    name: 'Librería',
    order: 1,
    state: CategoryState.Activo,
    parentId: null,
    parent: null,
    createdAt: '',
    updatedAt: '',
  };
  const producto = {
    id: 7,
    name: 'Cuaderno rayado',
    description: 'Tapa dura, 80 hojas',
    brand: 'Faber',
    totalSold: 0,
    state: ProductState.Activo,
    stock: 5,
    prices: [{ id: 1, amount: 1500, currency: 'ARS', validFrom: '', isCurrent: true }],
    photos: [],
    category: categoria,
    createdAt: '',
    updatedAt: '',
  } as unknown as IApiProduct;

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
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const esqueleto = (raiz: HTMLElement) => raiz.querySelector('[data-testid="ficha-esqueleto"]');

  it('mientras carga muestra el esqueleto de la ficha, sin datos de producto', () => {
    const fixture = TestBed.createComponent(ProductPageComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(esqueleto(raiz)).toBeTruthy();
    expect(raiz.querySelector('h1')).toBeNull();
  });

  it('el esqueleto es decorativo y avisa que está cargando a quien usa lector de pantalla', () => {
    const fixture = TestBed.createComponent(ProductPageComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(esqueleto(raiz)?.getAttribute('aria-busy')).toBe('true');
    expect(raiz.querySelector('[role=status]')?.textContent).toContain('Cargando producto');
  });

  it('cuando llega el producto, el esqueleto desaparece y aparece la ficha', async () => {
    const fixture = TestBed.createComponent(ProductPageComponent);
    fixture.detectChanges();
    const pedido = await vi.waitFor(() => http.expectOne(`${environment.apiUrl}/products/7`));
    pedido.flush({ data: producto });

    const raiz = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(esqueleto(raiz)).toBeNull();
      expect(raiz.querySelector('h1')?.textContent).toContain('Cuaderno rayado');
    });
  });
});
