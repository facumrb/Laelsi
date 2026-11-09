import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AlertService } from '@services/alert.service';
import { ApiCategoryService } from '@services/api-services/api-category.service';
import { CategoriesToolbarComponent } from './categories-toolbar.component';

// ID 64 (hallazgo 3): igual que en Productos, a 1024 px la fila de controles (buscar, ordenar, filtros y agregar) no
// entraba en los ~770 px que quedan con el menú lateral abierto y el botón "Agregar Categoría" se salía de la ventana
// ("+ Agregar Catego…", ~70 px fuera). Con `flex-wrap` la fila baja a una segunda línea cuando no entra.
describe('CategoriesToolbarComponent: la fila de controles envuelve en vez de salirse de la ventana', () => {
  function crear() {
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiCategoryService, useValue: { getCategoryTree: () => of([]), updateCategoryOrders: () => of(undefined) } },
        { provide: AlertService, useValue: { toast: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(CategoriesToolbarComponent);
    fixture.componentRef.setInput('searchQuery', '');
    fixture.componentRef.setInput('statusFilter', 'Todos');
    fixture.componentRef.setInput('stockFilter', 'Todos');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('el grupo de controles puede envolver desde lg, que es cuando se pone en fila', () => {
    const grupo = crear().querySelector<HTMLElement>('.toolbar-container > div')!;

    expect(grupo.classList.contains('lg:flex-row')).toBe(true);
    expect(grupo.classList.contains('lg:flex-wrap')).toBe(true);
    expect(grupo.classList.contains('lg:justify-end')).toBe(true);
  });

  it('el botón de agregar sigue estando y dice "Agregar Categoría"', () => {
    const boton = crear().querySelector<HTMLButtonElement>('app-create-entity-button button')!;

    // Los dos <span> van separados por el gap del botón, no por un espacio
    expect(boton.textContent?.replace(/\s+/g, '')).toBe('AgregarCategoría');
  });
});
