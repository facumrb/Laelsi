import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { GoBackButtonComponent } from '@shared/components/buttons/go-back-button/go-back-button.component';
import { LogoComponent } from '@shared/components/logo/logo.component';

// split: logo a la izquierda y contenido a la derecha (en escritorio) | stacked: logo arriba
export type AuthShellLayout = 'split' | 'stacked';

/*
Contenedor común de las pantallas de acceso (login, registro, recuperar y restablecer contraseña).
Todas comparten el ancho, el alto mínimo en escritorio y la posición del botón Volver, para que al
pasar de una a otra la tarjeta no cambie de tamaño ni el botón de lugar.

El alto mínimo es el que ocupa el registro, la pantalla más alta: si alguna lo supera, ese valor
se tiene que actualizar.
*/
@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, GoBackButtonComponent, LogoComponent],
  templateUrl: './auth-shell.component.html',
})
export class AuthShellComponent {
  // Distribución del logo y el contenido
  layout = input<AuthShellLayout>('split');

  // Título de la pantalla para lectores de pantalla (el h1 visible es el logo)
  heading = input.required<string>();

  // Destino fijo del botón Volver. Sin él, Volver usa el historial
  backUrl = input<string | null>(null);

  // Destino del botón Volver cuando no hay historial dentro de la app
  backFallbackUrl = input<string>('/');

  // Clases de la tarjeta según la distribución
  cardClass = computed(() =>
    this.layout() === 'split'
      ? 'lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-12 lg:px-12 lg:py-11'
      : 'flex flex-col justify-center lg:px-8 lg:py-4',
  );
}
