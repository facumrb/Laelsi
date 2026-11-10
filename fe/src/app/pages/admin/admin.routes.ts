import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@admin/layout/layout.component').then((m) => m.LayoutComponent),

    children: [
      { path: '', redirectTo: 'analytics', pathMatch: 'full' },
      {
        path: 'analytics',
        data: { reserveScrollbar: false },
        loadComponent: () =>
          import('./pages/analytics-page/analytics-page.component').then(
            (m) => m.AnalyticsPageComponent,
          ),
      },
      {
        path: 'admins',
        loadComponent: () =>
          import('./pages/admins-page/admins-page.component').then(
            (m) => m.AdminsPageComponent,
          ),
      },
      {
        path: 'admins/create',
        loadComponent: () =>
          import('./pages/admins-page/admins-form/admins-form.component').then(
            (m) => m.AdminsFormComponent,
          ),
      },
      {
        path: 'admins/edit/:id',
        loadComponent: () =>
          import('./pages/admins-page/admins-form/admins-form.component').then(
            (m) => m.AdminsFormComponent,
          ),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./pages/clients-page/clients-page.component').then(
            (m) => m.ClientsPageComponent,
          ),
      },
      {
        path: 'clients/create',
        loadComponent: () =>
          import('./pages/clients-page/clients-form/clients-form.component').then(
            (m) => m.ClientsFormComponent,
          ),
      },
      {
        path: 'clients/edit/:id',
        loadComponent: () =>
          import('./pages/clients-page/clients-form/clients-form.component').then(
            (m) => m.ClientsFormComponent,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/categories-page/categories-page.component').then(
            (m) => m.CategoriesPageComponent,
          ),
      },
      {
        path: 'categories/create',
        loadComponent: () =>
          import('./pages/categories-page/categories-form/categories-form.component').then(
            (m) => m.CategoriesFormComponent,
          ),
      },
      {
        path: 'categories/edit/:id',
        loadComponent: () =>
          import('./pages/categories-page/categories-form/categories-form.component').then(
            (m) => m.CategoriesFormComponent,
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/products-page/products-page.component').then(
            (m) => m.ProductsPageComponent,
          ),
      },
      {
        path: 'products/create',
        loadComponent: () =>
          import('./pages/products-page/products-form/products-form.component').then(
            (m) => m.ProductsFormComponent,
          ),
      },
      {
        path: 'products/edit/:id',
        loadComponent: () =>
          import('./pages/products-page/products-form/products-form.component').then(
            (m) => m.ProductsFormComponent,
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/orders-page/orders-page.component').then(
            (m) => m.OrdersPageComponent,
          ),
      },
      {
        path: 'view-profile',
        data: { reserveScrollbar: false },
        loadComponent: () =>
          import('./pages/profile-page/view-profile-page/view-profile-page.component').then(
            (m) => m.ViewProfilePageComponent,
          ),
      },
      {
        path: 'edit-profile',
        data: { reserveScrollbar: false },
        loadComponent: () =>
          import('./pages/profile-page/edit-profile-page/edit-profile-page.component').then(
            (m) => m.EditProfilePageComponent,
          ),
      },

      { path: '**', redirectTo: 'analytics' },
    ],
  },
];

export default adminRoutes;
