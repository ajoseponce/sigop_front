import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="page-container fade-in-up">

      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Bienvenido, <strong>{{ auth.nombreCompleto() }}</strong></p>
        </div>
      </div>

      <div class="stats-grid">
        @for (stat of stats(); track stat.label) {
          <div class="stat-card" [style.--accent]="stat.color">
            <div class="stat-icon">
              <mat-icon>{{ stat.icon }}</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stat.value }}</span>
              <span class="stat-label">{{ stat.label }}</span>
            </div>
          </div>
        }
      </div>

      <div class="info-card card">
        <div class="info-header">
          <mat-icon>info</mat-icon>
          <h3>Información de sesión</h3>
        </div>
        <div class="info-body">
          <div class="info-row">
            <span class="info-key">Email</span>
            <span class="info-val">{{ auth.usuario()?.email }}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Roles</span>
            <span class="info-val roles-list">
              @for (r of auth.usuario()?.roles ?? []; track r.id) {
                <span class="chip-rol" [class]="r.nombre">{{ r.nombre }}</span>
              }
            </span>
          </div>
          @if (auth.usuario()?.perfil?.area) {
            <div class="info-row">
              <span class="info-key">Área</span>
              <span class="info-val">{{ auth.usuario()?.perfil?.area?.nombre }}</span>
            </div>
          }
          @if (auth.usuario()?.ultimoLogin) {
            <div class="info-row">
              <span class="info-key">Último acceso</span>
              <span class="info-val">{{ auth.usuario()?.ultimoLogin | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    .page-header {
      margin-bottom: 28px;
      h1 { font-size: 26px; font-weight: 800; color: var(--text-primary); }
      p  { color: var(--text-secondary); margin-top: 4px; }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }

    .stat-card {
      background: white;
      border-radius: var(--radius-md);
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
      transition: transform 200ms ease, box-shadow 200ms ease;

      &:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

      .stat-icon {
        width: 52px; height: 52px;
        border-radius: 14px;
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        display: flex; align-items: center; justify-content: center;
        mat-icon { color: var(--accent); font-size: 26px; }
      }

      .stat-value { font-size: 28px; font-weight: 800; color: var(--text-primary); display: block; line-height: 1; }
      .stat-label { font-size: 13px; color: var(--text-secondary); font-weight: 600; margin-top: 4px; display: block; }
    }

    .info-card {
      padding: 24px;

      .info-header {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 20px;
        mat-icon { color: var(--color-primary); }
        h3 { font-size: 16px; font-weight: 700; }
      }

      .info-row {
        display: flex; align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--border-color);
        gap: 16px;
        &:last-child { border-bottom: none; }
      }

      .info-key {
        width: 130px; min-width: 130px;
        font-size: 13px; font-weight: 700;
        color: var(--text-secondary);
      }

      .info-val {
        font-size: 14px; color: var(--text-primary); font-weight: 600;
        &.roles-list { display: flex; gap: 6px; flex-wrap: wrap; }
      }
    }
  `],
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private http = inject(HttpClient);

  stats = signal([
    { label: 'Usuarios',  icon: 'people',        value: '—', color: '#E6347B' },
    { label: 'Roles',     icon: 'verified_user', value: '—', color: '#47AF74' },
    { label: 'Áreas',     icon: 'business',      value: '—', color: '#28764F' },
  ]);

  ngOnInit() {
    // Cargar conteos si es admin
    if (this.auth.esAdmin()) {
      this.http.get<any>(`${environment.apiUrl}/usuarios`).subscribe({
        next: r => this.updateStat('Usuarios', r.data?.length ?? 0),
      });
      this.http.get<any>(`${environment.apiUrl}/roles`).subscribe({
        next: r => this.updateStat('Roles', r.data?.length ?? 0),
      });
      this.http.get<any>(`${environment.apiUrl}/areas`).subscribe({
        next: r => this.updateStat('Áreas', r.data?.length ?? 0),
      });
    }
  }

  private updateStat(label: string, value: number) {
    this.stats.update(s => s.map(st => st.label === label ? { ...st, value: String(value) } : st));
  }
}
