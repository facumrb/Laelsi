import { Routes } from '@angular/router';
import { clientGuard } from '@guards/client.guard';

export const clientRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: '',
        data: {
          description:
            'Librería y papelería Laelsi en Rosario. Artículos escolares, comerciales, fotocopias, impresiones y confección de sellos.',
        },
        loadComponent: () =>
          import('./pages/main-page/main-page.component').then(
            (m) => m.MainPageComponent,
          ),
      },
      {
        path: 'category/:id',
        data: {
          description:
            'Explora nuestra variedad de artículos de librería, papelería y oficina por categoría en Laelsi.',
        },
        loadComponent: () =>
          import('./pages/category-page/category-page.component').then(
            (m) => m.CategoryPageComponent,
          ),
      },
      {
        path: 'product/:id',
        data: {
          description:
            'Consulta detalles, precios y disponibilidad de artículos de librería y oficina en Laelsi.',
        },
        loadComponent: () =>
          import('./pages/product-page/product-page.component').then(
            (m) => m.ProductPageComponent,
          ),
      },
      {
        path: 'impresiones',
        data: {
          description:
            'Impresiones blanco y negro, color, anillados, plastificados y fotocopias en Rosario con Laelsi.',
        },
        loadComponent: () =>
          import('./pages/impresiones-page/impresiones-page.component').then(
            (m) => m.ImpresionesPageComponent,
          ),
      },
      {
        path: 'sellos',
        data: {
          description:
            'Confección de sellos para profesionales, empresas e instituciones en Rosario.',
        },
        loadComponent: () =>
          import('./pages/sellos-page/sellos-page.component').then(
            (m) => m.SellosPageComponent,
          ),
      },
      {
        path: 'disenio',
        data: {
          description:
            'Servicios de diseño gráfico para folletería, tarjetas personales, cartelería y papelería comercial en Rosario.',
        },
        loadComponent: () =>
          import('./pages/diseno-grafico-page/diseno-grafico-page.component').then(
            (m) => m.DisenoGraficoPageComponent,
          ),
      },
      {
        path: 'about-us',
        data: {
          description:
            'Conocé la historia, trayectoria y compromiso de la Librería Laelsi en Rosario.',
        },
        loadComponent: () =>
          import('./pages/footer-pages/about-us-page/about-us-page.component').then(
            (m) => m.AboutUsPageComponent,
          ),
      },
      {
        path: 'faq',
        data: {
          description:
            'Respuestas a dudas comunes sobre compras, envíos, métodos de pago e impresiones en Laelsi.',
        },
        loadComponent: () =>
          import('./pages/footer-pages/faq-page/faq-page.component').then(
            (m) => m.FaqPageComponent,
          ),
      },
      // Las páginas legales (/privacidad y /terminos) NO están acá: viven en app.routes.ts, fuera de
      // este layout, porque se pre-renderizan en el build.
      // PROVISIONAL-2026-11-08 (arrepentimiento): ruta del botón, comentada. El componente, el servicio y el
      // modelo siguen en el repo, sin cambios, pero al no estar la ruta ya no entran en el bundle de
      // producción. Para reactivarla, descomentar este bloque (y los enlaces marcados con la misma etiqueta).
      // {
      //   // Botón de arrepentimiento (Disp. 954/2025): público, sin registro y accesible desde el inicio
      //   path: 'arrepentimiento',
      //   title: 'Botón de arrepentimiento | Laelsi',
      //   data: {
      //     description:
      //       'Botón de arrepentimiento de Laelsi: pedí la revocación de tu compra dentro de los 10 días, sin necesidad de registrarte.',
      //   },
      //   loadComponent: () =>
      //     import('./pages/revocation-page/revocation-page.component').then(
      //       (m) => m.RevocationPageComponent,
      //     ),
      // },
      {
        path: 'search',
        data: {
          description:
            'Encuentra productos escolares, de papelería, oficina e impresiones en el catálogo de Laelsi.',
        },
        loadComponent: () =>
          import('./pages/search-result/search-result.component').then(
            (m) => m.SearchResultComponent,
          ),
      },
      {
        path: 'cart',
        data: {
          description:
            'Revisa tu pedido y finaliza tu compra de artículos de librería en Laelsi.',
        },
        loadComponent: () =>
          import('./pages/cart-page/cart-page.component').then(
            (m) => m.CartPageComponent,
          ),
      },
      // Ruta Protegida
      {
        path: 'profile',
        data: {
          description:
            'Gestiona tus datos personales y pedidos en Librería Laelsi.',
        },
        loadComponent: () =>
          import('./pages/profile-page/profile-page.component').then(
            (m) => m.ProfilePageComponent,
          ),
        canActivate: [clientGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/profile-page/components/profile-details/profile-details.component').then(
                (m) => m.ProfileDetailsComponent,
              ),
          },
          {
            path: 'userData',
            loadComponent: () =>
              import('./pages/profile-page/components/profile-userData/profile-userData.component').then(
                (m) => m.ProfileUserComponent,
              ),
          },
          {
            path: 'orders',
            loadComponent: () =>
              import('./pages/profile-page/components/profile-orders/profile-orders.component').then(
                (m) => m.ProfileOrdersComponent,
              ),
          },
        ],
      },
      { path: '**', redirectTo: '' },
    ],
  },
];

export default clientRoutes;
