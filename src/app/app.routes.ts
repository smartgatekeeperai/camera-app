import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'stream'
  },
  {
    path: 'stream',
    loadComponent: () => import('./stream/stream.page').then( m => m.StreamPage)
  },
  { path: '**', redirectTo: '' },
];
