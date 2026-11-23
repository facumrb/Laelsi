import { Component, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { NavigationHistoryService } from '@services/navigation-history.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapArrowLeft } from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-go-back-button',
  imports: [NgIconComponent],
  viewProviders: [
    provideIcons({
      bootstrapArrowLeft,
    }),
  ],
  templateUrl: './go-back-button.component.html',
})
export class GoBackButtonComponent {
  private location = inject(Location);
  private router = inject(Router);
  private navHistory = inject(NavigationHistoryService);

  // Valor por defecto la raíz del e-commerce
  fallbackUrl = input<string>('/');

  // Destino fijo: si se indica, se navega siempre ahí, sin usar el historial
  url = input<string | null>(null);

  goBack() {
    const url = this.url();
    if (url) {
      this.router.navigateByUrl(url);
      return;
    }
    if (this.navHistory.hasPreviousRoute()) {
      // Si navegó dentro de la app, usamos Location (va a la previa)
      this.location.back();
    } else {
      // Si no hay historial intra-app, usamos el fallback
      this.router.navigateByUrl(this.fallbackUrl());
    }
  }
}
