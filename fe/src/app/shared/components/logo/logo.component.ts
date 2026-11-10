import { Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  templateUrl: './logo.component.html',
})
export class LogoComponent {
  width = input.required<number>();
  height = input.required<number>();
  alt = input<'Logo de Laelsi' | 'Laelsi'>('Logo de Laelsi');
  loading = input<'lazy' | 'eager'>('lazy');
  // 'high' para el logo que es lo más grande de la primera pantalla (el cartel de la portada): se descarga antes que el resto de las imágenes.
  priority = input<'high' | null>(null);
  customClass = input<string>('');
}
