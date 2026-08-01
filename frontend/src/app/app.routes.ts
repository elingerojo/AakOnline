import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'shop',
    loadComponent: () => import('./features/shop/shop.component').then(m => m.ShopComponent)
  },
  {
    path: 'category/:slug',
    loadComponent: () => import('./features/category/category.component').then(m => m.CategoryComponent)
  },
  {
    path: 'product/:slug',
    loadComponent: () => import('./features/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'quote',
    loadComponent: () => import('./features/quote/quote.component').then(m => m.QuoteComponent)
  },
  {
    path: 'shipping',
    loadComponent: () => import('./features/shipping/shipping.component').then(m => m.ShippingComponent)
  },
  // Admin routes
  {
    path: 'admin',
    loadComponent: () => import('./admin/catalog-workspace/catalog-workspace.component').then(m => m.CatalogWorkspaceComponent)
  },
  {
    path: 'admin/categories',
    loadComponent: () => import('./admin/categories/categories.component').then(m => m.CategoriesComponent)
  },
  {
    path: 'admin/shipping',
    loadComponent: () => import('./admin/shipping-config/shipping-config.component').then(m => m.ShippingConfigComponent)
  },
  { path: '**', redirectTo: '' }
];
