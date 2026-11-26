import { Routes } from '@angular/router';
import { adminGuard } from '@guards/admin.guard';

export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./pages/admin/admin.routes'),
  },
  {
    // El guestGuard se aplica pantalla por pantalla en auth.routes.ts, porque
    // la de restablecer contraseña tiene que abrirse aunque haya una sesión iniciada
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes'),
  },
  // Páginas legales: públicas y con URL fija. Google las exige para verificar el OAuth
  // (https://www.laelsi.com.ar/privacidad y /terminos).
  //
  // Van FUERA del layout de la tienda a propósito: se PRE-RENDERIZAN en el build (ver
  // app.routes.server.ts) para que quien lee el HTML sin ejecutar JavaScript, como los robots de
  // Google, vea el texto. El navbar de la tienda depende de localStorage y de datos del API, que
  // no existen en el servidor. Estas páginas solo usan componentes sin servicios del navegador.
  {
    path: 'privacidad',
    data: {
      description:
        'Política de Privacidad de Laelsi: qué datos personales recopilamos, para qué los usamos y cómo ejercer tus derechos.',
    },
    loadComponent: () =>
      import('./pages/client/pages/footer-pages/privacy-page/privacy-page.component').then(
        (m) => m.PrivacyPageComponent,
      ),
  },
  {
    path: 'terminos',
    data: {
      description:
        'Términos y Condiciones de Laelsi: uso del sitio, compras, pagos, entrega y derecho de revocación.',
    },
    loadComponent: () =>
      import('./pages/client/pages/footer-pages/terms-page/terms-page.component').then(
        (m) => m.TermsPageComponent,
      ),
  },
  {
    path: '',
    loadChildren: () => import('./pages/client/client.routes'),
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
