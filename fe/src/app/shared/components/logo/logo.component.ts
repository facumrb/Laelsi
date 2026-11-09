import { Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  // `srcset` ofrece una variante de 500 px (20 kB) además del original de 996 px (40 kB): el logo se muestra a menos de
  // 250 px y el navegador elige la que le alcanza según el ancho (`sizes`) y la densidad de la pantalla. Si cambia la
  // lista de variantes, cambiar también la precarga de index.html.
  template: `
    <img
      src="assets/Webp/Logo.webp"
      srcset="assets/Webp/Logo-500.webp 500w, assets/Webp/Logo.webp 996w"
      [attr.sizes]="width() + 'px'"
      [alt]="alt()"
      [class]="customClass()"
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.loading]="loading()"
      [attr.fetchpriority]="priority()"
    />
  `,
})
export class LogoComponent {
  width = input.required<number>();
  height = input.required<number>();
  alt = input<'Logo de Laelsi' | 'Laelsi'>('Logo de Laelsi');
  loading = input<'lazy' | 'eager'>('lazy');
  // 'high' para el logo que es lo más grande de la primera pantalla (el cartel de la portada): se descarga antes que
  // el resto de las imágenes. Sin pedirlo, el navegador decide.
  priority = input<'high' | null>(null);
  customClass = input<string>('');
}
