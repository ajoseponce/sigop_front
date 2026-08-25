import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
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
    { label: 'FAP', icon: 'query_stats', ruta: '/obras/fap', roles: ['ADMIN','SUPERVISOR'] },
  ]},
  { label: 'Pañol', icon: 'inventory_2', roles: ['ADMIN','SUPERVISOR'], hijos: [
    { label: 'Ingresos y egresos', icon: 'sync_alt', ruta: '/panol/movimientos', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Categorías de recursos', icon: 'category', ruta: '/panol/categorias', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Recursos y materiales', icon: 'inventory', ruta: '/panol/materiales', roles: ['ADMIN','SUPERVISOR'] },
  ]},
  { label: 'Combustible', icon: 'local_gas_station', roles: ['ADMIN','SUPERVISOR'], hijos: [
    { label: 'Cargas de combustible', icon: 'local_gas_station', ruta: '/combustible/cargas', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Choferes', icon: 'badge', ruta: '/combustible/choferes', roles: ['ADMIN','SUPERVISOR'] },
    { label: 'Estadísticas', icon: 'analytics', ruta: '/combustible/estadisticas', roles: ['ADMIN','SUPERVISOR'] },
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
    MatMenuModule, MatDividerModule, MatDialogModule,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit {
  auth   = inject(AuthService);
  router = inject(Router);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  sidebarAbierto = signal(true);
  navItems = signal<NavItem[]>(DEFAULT_NAV_ITEMS);
  appVersion = '1.0.6';

  submenuAbierto = signal<string | null>(null);

  ngOnInit() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      this.sidebarAbierto.set(false);
    }
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

  cerrarSidebarMobile() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      this.sidebarAbierto.set(false);
      this.submenuAbierto.set(null);
    }
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

  abrirCambioPassword() {
    this.dialog.open(CambiarPasswordDialogComponent, {
      width: '420px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
    }).afterClosed().subscribe(cambiada => {
      if (cambiada) this.auth.limpiarSesion();
    });
  }

  get iniciales(): string {
    const n = this.auth.nombreCompleto();
    return n.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  }
}

@Component({
  selector: 'app-cambiar-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Cambiar contraseña</h2>

    <mat-dialog-content>
      <form class="password-form" [formGroup]="form" (ngSubmit)="guardar()">
        <mat-form-field appearance="outline">
          <mat-label>Contraseña actual</mat-label>
          <input matInput type="password" formControlName="passwordActual" autocomplete="current-password">
          @if (form.get('passwordActual')?.hasError('required') && form.get('passwordActual')?.touched) {
            <mat-error>Ingresá tu contraseña actual</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nueva contraseña</mat-label>
          <input matInput type="password" formControlName="passwordNueva" autocomplete="new-password">
          @if (form.get('passwordNueva')?.hasError('required') && form.get('passwordNueva')?.touched) {
            <mat-error>Ingresá la nueva contraseña</mat-error>
          }
          @if (form.get('passwordNueva')?.hasError('minlength') && form.get('passwordNueva')?.touched) {
            <mat-error>Mínimo 8 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Repetir nueva contraseña</mat-label>
          <input matInput type="password" formControlName="passwordRepetida" autocomplete="new-password">
          @if (form.get('passwordRepetida')?.hasError('required') && form.get('passwordRepetida')?.touched) {
            <mat-error>Repetí la nueva contraseña</mat-error>
          }
          @if (form.hasError('passwordMismatch') && form.get('passwordRepetida')?.touched) {
            <mat-error>Las contraseñas no coinciden</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="cargando()" (click)="cerrar()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="cargando()" (click)="guardar()">
        <mat-icon>lock_reset</mat-icon>
        Cambiar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .password-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 4px;
    }

    mat-dialog-actions button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
  `],
})
export class CambiarPasswordDialogComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<CambiarPasswordDialogComponent>);

  cargando = signal(false);

  form = this.fb.group({
    passwordActual: ['', [Validators.required]],
    passwordNueva: ['', [Validators.required, Validators.minLength(8)]],
    passwordRepetida: ['', [Validators.required]],
  }, { validators: this.passwordsIguales });

  cerrar() {
    this.dialogRef.close(false);
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { passwordActual, passwordNueva } = this.form.getRawValue();
    this.cargando.set(true);
    this.auth.cambiarPassword({
      passwordActual: passwordActual ?? '',
      passwordNueva: passwordNueva ?? '',
    }).pipe(finalize(() => this.cargando.set(false))).subscribe({
      next: () => {
        this.snack.open('Contraseña actualizada. Iniciá sesión nuevamente.', 'Cerrar', {
          duration: 3500,
        });
        this.dialogRef.close(true);
      },
      error: err => {
        const msg = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : err?.error?.message ?? 'No se pudo cambiar la contraseña';
        this.snack.open(msg, 'Cerrar', {
          duration: 4000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private passwordsIguales(form: AbstractControl) {
    const nueva = form.get('passwordNueva')?.value;
    const repetida = form.get('passwordRepetida')?.value;
    return nueva && repetida && nueva !== repetida ? { passwordMismatch: true } : null;
  }
}
