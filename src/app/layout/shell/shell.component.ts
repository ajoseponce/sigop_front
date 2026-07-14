import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';

export interface NavItem {
  label: string;
  icon: string;
  ruta?: string;
  hijos?: NavItem[];
  roles?: string[];
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', ruta: '/dashboard' },
  { label: 'Administración', icon: 'admin_panel_settings', hijos: [
    { label: 'Usuarios', icon: 'people', ruta: '/admin/usuarios', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Roles', icon: 'verified_user', ruta: '/admin/roles', roles: ['ADMIN'] },
    { label: 'Áreas', icon: 'business', ruta: '/admin/areas', roles: ['ADMIN'] },
    { label: 'Personas', icon: 'badge', ruta: '/admin/personas', roles: ['ADMIN', 'SUPERVISOR'] },
    { label: 'Empresas', icon: 'apartment', ruta: '/admin/empresas', roles: ['ADMIN', 'SUPERVISOR'] },
  ]},
  { label: 'Obras', icon: 'engineering', hijos: [
    { label: 'Nueva Obra', icon: 'local_shipping', ruta: '/obras/nueva', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Lista de Obras', icon: 'list', ruta: '/obras', roles: ['ADMIN','SUPERVISOR'] },
  ]},
  { label: 'Pañol', icon: 'inventory_2', roles: ['ADMIN','SUPERVISOR'], hijos: [
    { label: 'Ingresos y egresos', icon: 'sync_alt', ruta: '/panol/movimientos', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Categorías de recursos', icon: 'category', ruta: '/panol/categorias', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Recursos y materiales', icon: 'inventory', ruta: '/panol/materiales', roles: ['ADMIN','SUPERVISOR'] },
  ]},
];

type MenuApiItem = {
  id: number;
  nombre: string;
  ruta: string;
  icono: string | null;
  orden: number;
  padre: { id: number; codigo: string } | null;
};

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
export class ShellComponent implements OnInit {
  auth   = inject(AuthService);
  router = inject(Router);
  private api = inject(ApiService);

  sidebarAbierto = signal(true);
  navItems = signal<NavItem[]>(DEFAULT_NAV_ITEMS);

  submenuAbierto = signal<string | null>(null);

  ngOnInit() {
    this.api.get<MenuApiItem[]>('pantallas/menu').subscribe({
      next: items => {
        const nav = this.mapearMenu(items);
        if (nav.length) this.navItems.set(nav);
      },
      error: () => this.navItems.set(DEFAULT_NAV_ITEMS),
    });
  }

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

  submenuVisible(item: NavItem): boolean {
    return this.submenuAbierto() === item.label || this.grupoActivo(item);
  }

  grupoActivo(item: NavItem): boolean {
    return item.hijos?.some(hijo => hijo.ruta && this.router.url.startsWith(hijo.ruta)) ?? false;
  }

  private mapearMenu(items: MenuApiItem[]): NavItem[] {
    const ordenados = [...items].sort((a, b) => a.orden - b.orden);
    const porId = new Map<number, NavItem>();
    const hijosPorPadre = new Map<number, NavItem[]>();

    for (const item of ordenados) {
      const navItem: NavItem = {
        label: item.nombre,
        icon: item.icono ?? 'circle',
        ruta: item.ruta,
      };
      porId.set(item.id, navItem);
      if (item.padre) {
        const lista = hijosPorPadre.get(item.padre.id) ?? [];
        lista.push(navItem);
        hijosPorPadre.set(item.padre.id, lista);
      }
    }

    return ordenados
      .filter(item => !item.padre)
      .map(item => {
        const navItem = porId.get(item.id)!;
        const hijos = hijosPorPadre.get(item.id);
        return hijos?.length ? { ...navItem, ruta: undefined, hijos } : navItem;
      });
  }

  logout() {
    this.auth.logout();
  }

  get iniciales(): string {
    const n = this.auth.nombreCompleto();
    return n.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  }
}
