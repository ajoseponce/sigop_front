import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { loginGuard } from './core/guards/login.guard';
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'obras/:id/caratula',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/obras/obra-caratula/obra-caratula.component').then(m => m.ObraCaratulaComponent),
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
        path: 'panol',
        redirectTo: 'panol/movimientos',
        pathMatch: 'full',
      },
      {
        path: 'panol/movimientos',
        loadComponent: () =>
          import('./features/panol/panol-movimientos.component').then(m => m.PanolMovimientosComponent),
      },
      {
        path: 'panol/categorias',
        loadComponent: () =>
          import('./features/panol/panol.component').then(m => m.PanolComponent),
      },
      {
        path: 'panol/materiales',
        loadComponent: () =>
          import('./features/panol/panol-materiales.component').then(m => m.PanolMaterialesComponent),
      },
      {
        path: 'combustible',
        loadComponent: () =>
          import('./features/combustible/combustible.component').then(m => m.CombustibleComponent),
      },
      {
        path: 'obras/nueva',
        loadComponent: () =>
          import('./features/obras/obra-wizard/obra-wizard.component').then(m => m.ObraWizardComponent),
      },
      {
        path: 'obras/fap',
        loadComponent: () => import('./features/obras/fap/fap.component').then(m => m.FapComponent),
      },
      {
        path: 'obras',
        loadComponent: () =>
          import('./features/obras/obras-list/obras-list.component').then(m => m.ObrasListComponent),
      },
      {
        path: 'obras/:id/editar',
        loadComponent: () =>
          import('./features/obras/obra-wizard/obra-wizard.component').then(m => m.ObraWizardComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
