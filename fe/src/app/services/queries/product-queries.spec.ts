import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiProductService } from '../api-services/api-product.service';
import { injectProductDetailQuery } from './product-queries';

describe('injectProductDetailQuery', () => {
  it('pide el detalle a la API con la variante pública (la tienda no lleva credenciales)', async () => {
    const getProductById = vi.fn(() => of({ id: 5 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiProductService, useValue: { getProductById } },
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
      ],
    });

    TestBed.runInInjectionContext(() => injectProductDetailQuery(signal(5)));

    await vi.waitFor(() => expect(getProductById).toHaveBeenCalledWith(5, true));
  });
});
