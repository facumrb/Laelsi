import { Component, computed, input } from '@angular/core';
import { IApiUserPhoto } from '@models/photo.model';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.component.html',
})
export class UserAvatarComponent {
  photo = input<IApiUserPhoto | null | undefined>(null);
  name = input<string | null>('');
  lastName = input<string | null>('');
  // 'xs' = 8 (32px) | 'sm' = 10 (40px) | 'md' = 16 (64px) | 'lg' = 32 (128px)
  size = input<'xs' | 'sm' | 'md' | 'lg'>('sm');

  readonly imageBaseUrl = environment.userImagesUrl;

  initials = computed(() => {
    const first = this.name()?.charAt(0) || '';
    const last = this.lastName()?.charAt(0) || '';
    return (first + last).toUpperCase();
  });

  photoUrl = computed(() => {
    const photo = this.photo();
    return photo?.fileName ? `${this.imageBaseUrl}${photo.fileName}` : null;
  });

  containerClass = computed(() => {
    const sizes: Record<string, string> = {
      xs: 'h-8 w-8 text-xs',
      sm: 'h-10 w-10 text-xs',
      md: 'h-16 w-16 text-lg',
      lg: 'h-32 w-32 text-4xl',
    };
    return sizes[this.size()];
  });
}
