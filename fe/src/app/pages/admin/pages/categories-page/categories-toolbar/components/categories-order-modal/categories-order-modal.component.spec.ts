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

  it('se anuncia como diálogo modal y su nombre es su título', () => {
    const raiz = modalExpandido();

    const dialogo = raiz.querySelector('[role="dialog"]')!;

    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    const titulo = raiz.querySelector(`#${dialogo.getAttribute('aria-labelledby')}`);
    expect(titulo?.textContent?.trim()).toBe('Reordenar Categorías');
  });

  it('cada nivel es una lista donde se puede arrastrar: una por nivel', () => {
    expect(modalExpandido().querySelectorAll('.cdk-drop-list').length).toBe(5);
  });

  // En un teléfono de 360 px, con cinco niveles abiertos cada nivel restaba 32 px de sangría y el botón "Ver
  // subcategorías (n)" ocupaba más de la mitad de la fila: el nombre de la categoría quedaba en 45 px y se partía en 4
  // líneas (visto en el navegador con un árbol de 5 niveles). Ahora el botón baja a otra línea cuando no entra, el nombre
  // conserva un ancho mínimo y la sangría es menor en pantallas chicas.
  it('el nombre conserva un ancho mínimo y el botón de subcategorías baja de línea si no entra', () => {
    const modal = modalExpandido();
    const nombres = Array.from(modal.querySelectorAll<HTMLElement>('span.flex-1'));

    expect(nombres.length).toBe(5);
    for (const nombre of nombres) {
      expect(nombre.classList.contains('min-w-32')).toBe(true);
      expect((nombre.parentElement as HTMLElement).classList.contains('flex-wrap')).toBe(true);
    }
  });

  it('la sangría de cada nivel es menor en pantallas chicas', () => {
    const contenedoresDeHijas = Array.from(modalExpandido().querySelectorAll<HTMLElement>('div.border-t.border-gray-100'));

    expect(contenedoresDeHijas.length).toBe(4);
    for (const contenedor of contenedoresDeHijas) {
      expect(contenedor.classList.contains('pl-4')).toBe(true);
      expect(contenedor.classList.contains('sm:pl-8')).toBe(true);
      expect(contenedor.classList.contains('pl-8')).toBe(false);
    }
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
