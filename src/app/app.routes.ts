import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { loginGuard } from './core/guards/login.guard';
import { ObraWizardComponent } from './features/obras/obra-wizard/obra-wizard.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'admin/usuarios',
        loadComponent: () =>
          import('./features/usuarios/usuarios.component').then(m => m.UsuariosComponent),
      },
      {
        path: 'admin/roles',
        loadComponent: () =>
          import('./features/roles/roles.component').then(m => m.RolesComponent),
      },
      {
        path: 'admin/areas',
        loadComponent: () =>
          import('./features/areas/areas.component').then(m => m.AreasComponent),
      },
      {
        path: 'admin/personas',
        loadComponent: () =>
          import('./features/personas/personas.component').then(m => m.PersonasComponent),
      },
      {
        path: 'admin/empresas',
        loadComponent: () =>
          import('./features/empresas/empresas.component').then(m => m.EmpresasComponent),
      },
      {
        path: 'obras/nueva',
        loadComponent: () =>
          import('./features/obras/obra-wizard/obra-wizard.component').then(m => m.ObraWizardComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
