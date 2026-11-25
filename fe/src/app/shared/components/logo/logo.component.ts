import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

// Proporción alto/ancho de assets/Webp/Logo.webp (996 × 516). Si se cambia la imagen, hay que cambiarla acá.
const PROPORCION_LOGO = 516 / 996;

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logo.component.html',
})
export class LogoComponent {
  width = input.required<number>();
  // Alto del atributo height, sacado del ancho: así el lugar reservado antes de cargar coincide con la imagen
  height = computed(() => Math.round(this.width() * PROPORCION_LOGO));
  alt = input<'Logo de Laelsi' | 'Laelsi'>('Logo de Laelsi');
  loading = input<'lazy' | 'eager'>('lazy');
  // 'high' para el logo que es lo más grande de la primera pantalla (el cartel de la portada): se descarga antes que el resto de las imágenes.
  priority = input<'high' | null>(null);
  customClass = input<string>('');
}
