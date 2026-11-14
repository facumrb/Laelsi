import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiCategoryService } from '../api-services/api-category.service';
import { injectCategoryDetailQuery } from './category-queries';

describe('injectCategoryDetailQuery', () => {
  it('pide el detalle a la API con la variante pública (la tienda no lleva credenciales)', async () => {
    const getCategoryById = vi.fn(() => of({ id: 3 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiCategoryService, useValue: { getCategoryById } },
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
      ],
    });

    TestBed.runInInjectionContext(() => injectCategoryDetailQuery(signal(3)));

    await vi.waitFor(() => expect(getCategoryById).toHaveBeenCalledWith(3, true));
  });
});
