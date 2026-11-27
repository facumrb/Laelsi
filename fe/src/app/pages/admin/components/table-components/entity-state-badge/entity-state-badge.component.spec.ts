import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { EntityState, EntityStateBadgeComponent } from './entity-state-badge.component';

// Un producto Pausado se sigue viendo en la tienda (no disponible por ahora): ni verde ni rojo (ID 54).
describe('EntityStateBadgeComponent', () => {
  function insignia(estado: EntityState) {
    const fixture = TestBed.createComponent(EntityStateBadgeComponent);
    fixture.componentRef.setInput('state', estado);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('span[role="status"]') as HTMLElement;
  }

  it('Activo es verde', () => {
    const el = insignia('Activo');

    expect(el.classList.contains('bg-green-50')).toBe(true);
    expect(el.textContent).toContain('Activo');
  });

  it('Pausado es ámbar', () => {
    const el = insignia('Pausado');

    expect(el.classList.contains('bg-amber-50')).toBe(true);
    expect(el.classList.contains('bg-green-50')).toBe(false);
    expect(el.textContent).toContain('Pausado');
  });

  it('Inactivo es rojo', () => {
    const el = insignia('Inactivo');

    expect(el.classList.contains('bg-red-50')).toBe(true);
    expect(el.textContent).toContain('Inactivo');
  });
});
