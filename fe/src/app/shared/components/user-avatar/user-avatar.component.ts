import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';
import { IApiUserPhoto } from '@models/photo.model';
import { environment } from 'src/environments/environment';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

// Clases de alto, ancho y texto de cada tamaño
const TAMANOS: Record<AvatarSize, string> = {
  xs: 'h-8 w-8 text-xs',
  sm: 'h-10 w-10 text-xs',
  md: 'h-16 w-16 text-lg',
  lg: 'h-32 w-32 text-4xl',
};

@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-avatar.component.html',
})
export class UserAvatarComponent {
  photo = input<IApiUserPhoto | null | undefined>(null);
  name = input<string | null>('');
  lastName = input<string | null>('');
  // 'xs' = 8 (32px) | 'sm' = 10 (40px) | 'md' = 16 (64px) | 'lg' = 32 (128px)
  size = input<AvatarSize>('sm');

  readonly imageBaseUrl = environment.userImagesUrl;

  initials = computed(() => {
    const first = this.name()?.charAt(0) || '';
    const last = this.lastName()?.charAt(0) || '';
    return (first + last).toUpperCase();
  });

  // Texto alternativo de la foto: nombre y apellido que existan, o un texto genérico
  altText = computed(
    () =>
      [this.name(), this.lastName()]
        .map((parte) => parte?.trim())
        .filter(Boolean)
        .join(' ') || 'Foto de perfil',
  );

  photoUrl = computed(() => {
    const photo = this.photo();
    return photo?.fileName ? `${this.imageBaseUrl}${photo.fileName}` : null;
  });

  // Si la foto no carga se muestran las iniciales (vuelve a false al cambiar la foto)
  photoFailed = linkedSignal({
    source: this.photoUrl,
    computation: () => false,
  });

  containerClass = computed(() => TAMANOS[this.size()]);
}
