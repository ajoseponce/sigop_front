import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';

export interface NavItem {
  label: string;
  icon: string;
  ruta?: string;
  hijos?: NavItem[];
  roles?: string[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule,
    MatMenuModule, MatDividerModule,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {
  auth   = inject(AuthService);
  router = inject(Router);

  sidebarAbierto = signal(true);

  navItems: NavItem[] = [
    { label: 'Dashboard',     icon: 'dashboard',            ruta: '/dashboard' },
    { label: 'Administración', icon: 'admin_panel_settings', hijos: [
      { label: 'Usuarios',  icon: 'people',         ruta: '/admin/usuarios', roles: ['ADMIN','SUPERVISOR'] },
      { label: 'Roles',     icon: 'verified_user',  ruta: '/admin/roles',    roles: ['ADMIN'] },
      { label: 'Áreas',     icon: 'business',       ruta: '/admin/areas',    roles: ['ADMIN'] },
      { label: 'Personas', icon: 'badge', ruta: '/admin/personas', roles: ['ADMIN', 'SUPERVISOR'] },
      { label: 'Empresas', icon: 'apartment', ruta: '/admin/empresas', roles: ['ADMIN', 'SUPERVISOR'] },
    ]},
    { label: 'Obras', icon: 'engineering', hijos: [
      { label: 'Nueva Obra',  icon: 'local_shipping',         ruta: '/obras/nueva', roles: ['ADMIN','SUPERVISOR'] },
      
    ]},
  ];

  submenuAbierto = signal<string | null>(null);

  toggleSidebar() {
    this.sidebarAbierto.update(v => !v);
    if (!this.sidebarAbierto()) this.submenuAbierto.set(null);
  }
get primerRol(): string {
  const roles = this.auth.usuario()?.roles;
  return roles && roles.length > 0 ? roles[0].nombre : '';
}
  toggleSubmenu(label: string) {
    if (!this.sidebarAbierto()) {
      this.sidebarAbierto.set(true);
      this.submenuAbierto.set(label);
      return;
    }
    this.submenuAbierto.update(v => v === label ? null : label);
  }

  puedeVer(item: NavItem): boolean {
    if (!item.roles?.length) return true;
    return item.roles.some(r => this.auth.tieneRol(r));
  }

  logout() {
    this.auth.logout();
  }

  get iniciales(): string {
    const n = this.auth.nombreCompleto();
    return n.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  }
}
