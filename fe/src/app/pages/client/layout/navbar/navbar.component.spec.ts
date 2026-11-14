import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiCategoryService } from '@services/api-services/api-category.service';
import { AuthService } from '@services/auth.service';
import { CartService } from '@services/cart.service';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  it('pide el árbol de categorías con estado Activo (única variante pública)', async () => {
    const getCategoryTree = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        { provide: ApiCategoryService, useValue: { getCategoryTree } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: CartService, useValue: { totalItems: () => 0 } },
        { provide: Router, useValue: { url: '/', events: new Subject() } },
      ],
    });
    TestBed.overrideComponent(NavbarComponent, { set: { imports: [], template: '' } });

    await TestBed.compileComponents();
    TestBed.createComponent(NavbarComponent).detectChanges();

    expect(getCategoryTree).toHaveBeenCalledWith('Activo');
  });
});
