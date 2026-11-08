import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AlertService } from '@services/alert.service';
import { ApiCategoryService } from '@services/api-services/api-category.service';
import { cadenaAnidada } from '@shared/testing/categorias';
import { CategoriesOrderModalComponent } from './categories-order-modal.component';

// El modal para reordenar categorías dibujaba tres niveles a mano. Con hasta cinco niveles, las categorías de
// más abajo no se podían reordenar: ahora cada nivel es una lista que se arma a sí misma.
describe('CategoriesOrderModalComponent: niveles', () => {
  /** Abre el modal con la cadena de cinco niveles y expande todas las ramas. */
  function modalExpandido(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiCategoryService,
          useValue: { getCategoryTree: () => of([cadenaAnidada()]), updateCategoryOrders: () => of(undefined) },
        },
        { provide: AlertService, useValue: { toast: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(CategoriesOrderModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges(); // el efecto carga el árbol
    fixture.detectChanges();
    for (const idConHijas of [1, 2, 3, 4]) fixture.componentInstance.toggleExpand(idConHijas);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra los cinco niveles al expandir todas las ramas', () => {
    const texto = modalExpandido().textContent ?? '';

    expect(texto).toContain('Tecnología');
    expect(texto).toContain('Computación');
    expect(texto).toContain('Periféricos');
    expect(texto).toContain('Mouses');
    expect(texto).toContain('Inalámbricos');
  });

  it('cada nivel es una lista donde se puede arrastrar: una por nivel', () => {
    expect(modalExpandido().querySelectorAll('.cdk-drop-list').length).toBe(5);
  });

  it('mientras las ramas están cerradas solo se ve el primer nivel', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiCategoryService, useValue: { getCategoryTree: () => of([cadenaAnidada()]) } },
        { provide: AlertService, useValue: { toast: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(CategoriesOrderModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Tecnología');
    expect(texto).not.toContain('Computación');
  });
});
