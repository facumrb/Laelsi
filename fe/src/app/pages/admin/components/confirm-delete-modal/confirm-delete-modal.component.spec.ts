import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { ConfirmDeleteModalComponent } from './confirm-delete-modal.component';

// ID 65 de docs/requerimientos/discusiones.md: a los clientes y administradores no se los elimina, solo se
// los desactiva. ID 54: a un producto se lo puede pausar en vez de eliminarlo.
describe('ConfirmDeleteModalComponent', () => {
  function crear(entradas: Record<string, unknown>) {
    const fixture = TestBed.createComponent(ConfirmDeleteModalComponent);
    fixture.componentRef.setInput('entityName', 'Ana Pérez');
    for (const [nombre, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
    return fixture;
  }

  const textos = (fixture: ReturnType<typeof crear>) => (fixture.nativeElement as HTMLElement).textContent ?? '';

  const boton = (fixture: ReturnType<typeof crear>, texto: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === texto,
    );

  describe('con borrado permanente (por defecto)', () => {
    it('ofrece desactivar y eliminar permanentemente', () => {
      const fixture = crear({ entityType: 'producto' });

      expect(boton(fixture, 'Desactivar (Recomendado)')).toBeTruthy();
      expect(boton(fixture, 'Eliminar permanentemente')).toBeTruthy();
      expect(textos(fixture)).toContain('Riesgo de pérdida permanente de datos');
    });
  });

  describe('sin borrado permanente (clientes y administradores)', () => {
    it('no ofrece eliminar: solo desactivar, y explica que no se borra nada', () => {
      const fixture = crear({ entityType: 'cliente', allowPermanentDelete: false });

      expect(boton(fixture, 'Eliminar permanentemente')).toBeUndefined();
      expect(boton(fixture, 'Desactivar')).toBeTruthy();
      expect(textos(fixture)).toContain('No se borra nada');
      expect(textos(fixture)).not.toContain('Riesgo de pérdida permanente de datos');
    });

    it('el título dice Desactivar, no Eliminar', () => {
      const fixture = crear({ entityType: 'administrador', allowPermanentDelete: false });

      const titulo = (fixture.nativeElement as HTMLElement).querySelector('h2')?.textContent ?? '';
      expect(titulo).toContain('Desactivar');
      expect(titulo).not.toContain('Eliminar');
    });

    it('un usuario que ya está inactivo no ofrece desactivar de nuevo', () => {
      const fixture = crear({ entityType: 'cliente', allowPermanentDelete: false, isDeactivated: true });

      expect(boton(fixture, 'Desactivar')).toBeUndefined();
      expect(boton(fixture, 'Cancelar')).toBeTruthy();
    });

    it('desactivar avisa con confirmDeactivate', () => {
      const fixture = crear({ entityType: 'cliente', allowPermanentDelete: false });
      let avisos = 0;
      fixture.componentInstance.confirmDeactivate.subscribe(() => avisos++);

      boton(fixture, 'Desactivar')!.click();

      expect(avisos).toBe(1);
    });
  });

  // Un modal donde se borra de verdad lleva el triángulo rojo de advertencia; uno donde NO se borra nada
  // (clientes y administradores) no puede asustar con ese ícono: lleva el de desactivar, en colores neutros.
  describe('ícono del encabezado', () => {
    const iconoDelEncabezado = (fixture: ReturnType<typeof crear>) => {
      const icono = fixture.debugElement.queryAll(By.css('header ng-icon'))[0];
      const n = (icono.componentInstance as { name: unknown }).name;
      return typeof n === 'function' ? (n as () => string)() : (n as string);
    };

    it('con borrado permanente: triángulo de advertencia, en rojo', () => {
      const fixture = crear({ entityType: 'producto' });

      expect(iconoDelEncabezado(fixture)).toBe('bootstrapExclamationTriangle');
      expect((fixture.nativeElement as HTMLElement).querySelector('header .bg-red-50')).toBeTruthy();
    });

    it('sin borrado permanente: persona tachada, sin rojo de advertencia', () => {
      const fixture = crear({ entityType: 'cliente', allowPermanentDelete: false });

      expect(iconoDelEncabezado(fixture)).toBe('bootstrapPersonSlash');
      expect((fixture.nativeElement as HTMLElement).querySelector('header .bg-red-50')).toBeNull();
    });
  });

  describe('pausar (productos)', () => {
    it('ofrece Pausar solo si se lo pide', () => {
      expect(boton(crear({ entityType: 'producto' }), 'Pausar')).toBeUndefined();
      expect(boton(crear({ entityType: 'producto', canPause: true }), 'Pausar')).toBeTruthy();
    });

    it('pausar avisa con confirmPause', () => {
      const fixture = crear({ entityType: 'producto', canPause: true });
      let avisos = 0;
      fixture.componentInstance.confirmPause.subscribe(() => avisos++);

      boton(fixture, 'Pausar')!.click();

      expect(avisos).toBe(1);
    });
  });
});
