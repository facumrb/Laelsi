import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CategoryState } from '@models/category.model';
import { ProductState } from '@models/product.model';
import { ProductStatusBadgeComponent } from './product-status-badge.component';

// ID 54 de docs/requerimientos/discusiones.md: un producto PAUSADO se ve en la tienda como "no disponible
// por ahora" aunque tenga stock; es distinto de Inactivo y de Agotado.
describe('ProductStatusBadgeComponent', () => {
  function texto(estado: ProductState, stock: number, categoria: CategoryState = CategoryState.Activo) {
    const fixture = TestBed.createComponent(ProductStatusBadgeComponent);
    fixture.componentRef.setInput('productState', estado);
    fixture.componentRef.setInput('categoryState', categoria);
    fixture.componentRef.setInput('productStock', stock);
    fixture.detectChanges();
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('un producto Pausado con stock dice "No disponible por ahora"', () => {
    expect(texto(ProductState.Pausado, 7)).toContain('No disponible por ahora');
  });

  it('un producto Activo con stock no muestra ninguna insignia', () => {
    expect(texto(ProductState.Activo, 7)).toBe('');
  });

  it('un producto Activo sin stock dice "Agotado", no "No disponible por ahora"', () => {
    const t = texto(ProductState.Activo, 0);

    expect(t).toContain('Agotado');
    expect(t).not.toContain('No disponible por ahora');
  });

  it('un producto Inactivo conserva su aviso de publicación pausada', () => {
    const t = texto(ProductState.Inactivo, 7);

    expect(t).toContain('Publicación pausada');
    expect(t).not.toContain('No disponible por ahora');
  });
});
