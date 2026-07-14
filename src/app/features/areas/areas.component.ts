import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-areas',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSnackBarModule, MatTooltipModule,
  ],
  template: `
<div class="page-container fade-in-up">
  <div class="page-header">
    <div>
      <h1>Áreas</h1>
      <p>Gestión de áreas y departamentos</p>
    </div>
    <button mat-raised-button color="primary" (click)="abrirModal()">
      <mat-icon>add</mat-icon> Nueva área
    </button>
  </div>

  <div class="areas-grid">
    @for (area of areas(); track area.id) {
      <div class="area-card card">
        <div class="area-icon">
          <mat-icon>business</mat-icon>
        </div>
        <div class="area-info">
          <h3>{{ area.nombre }}</h3>
          <p>{{ area.descripcion ?? 'Sin descripción' }}</p>
          <span class="badge-activo" [class.activo]="area.activo" [class.inactivo]="!area.activo">
            {{ area.activo ? 'Activa' : 'Inactiva' }}
          </span>
          <div class="area-meta">
            <span><mat-icon>verified_user</mat-icon>{{ area.roles?.length ?? 0 }} roles</span>
            <span><mat-icon>menu</mat-icon>{{ area.pantallas?.length ?? 0 }} menús</span>
          </div>
        </div>
        <div class="area-actions">
          <button mat-icon-button (click)="abrirModal(area)" matTooltip="Editar">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="eliminar(area)" matTooltip="Eliminar">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    }
    @if (areas().length === 0 && !cargando()) {
      <div class="empty-state">
        <mat-icon>business</mat-icon>
        <p>No hay áreas registradas</p>
      </div>
    }
  </div>
</div>

@if (modalOpen()) {
  <div class="modal-overlay" (click)="cerrarModal()">
    <div class="modal-card" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2>{{ editando() ? 'Editar área' : 'Nueva área' }}</h2>
        <button mat-icon-button (click)="cerrarModal()"><mat-icon>close</mat-icon></button>
      </div>
      <form [formGroup]="form" (ngSubmit)="guardar()" class="modal-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nombre del área</mat-label>
          <input matInput formControlName="nombre">
          @if (form.get('nombre')?.hasError('required') && form.get('nombre')?.touched) {
            <mat-error>Requerido</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="descripcion" rows="3"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Roles permitidos</mat-label>
          <mat-select formControlName="rolesIds" multiple>
            @for (rol of roles(); track rol.id) {
              <mat-option [value]="rol.id">{{ rol.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Menús visibles</mat-label>
          <mat-select formControlName="pantallasIds" multiple>
            @for (pantalla of pantallas(); track pantalla.id) {
              <mat-option [value]="pantalla.id">
                {{ pantalla.padre ? pantalla.padre.nombre + ' / ' : '' }}{{ pantalla.nombre }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="modal-actions">
          <button mat-stroked-button type="button" (click)="cerrarModal()">Cancelar</button>
          <button mat-raised-button color="primary" type="submit">
            {{ editando() ? 'Guardar cambios' : 'Crear área' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}
  `,
  styles: [`
    .page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;
      h1{font-size:26px;font-weight:800} p{color:var(--text-secondary);font-size:14px} }
    .areas-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px }
    .area-card { padding:20px;display:flex;align-items:flex-start;gap:14px;transition:transform 200ms,box-shadow 200ms;
      &:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)} }
    .area-icon { width:44px;height:44px;min-width:44px;border-radius:12px;
      background:linear-gradient(135deg,#e8f6ee,#c6e8d5);
      display:flex;align-items:center;justify-content:center;
      mat-icon{color:var(--color-accent-dark)} }
    .area-info { flex:1; h3{font-size:15px;font-weight:700;margin-bottom:4px}
      p{font-size:13px;color:var(--text-secondary);margin-bottom:8px} }
    .area-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;color:var(--text-secondary);font-size:12px;
      span{display:inline-flex;align-items:center;gap:4px}
      mat-icon{font-size:16px;width:16px;height:16px}}
    .area-actions { display:flex;flex-direction:column }
    .empty-state{grid-column:1/-1;padding:60px;text-align:center;color:var(--text-secondary);
      mat-icon{font-size:48px;width:48px;height:48px;opacity:.3} p{margin-top:12px}}
    .modal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;padding:16px}
    .modal-card{background:white;border-radius:var(--radius-lg);width:100%;max-width:460px;box-shadow:var(--shadow-lg)}
    .modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;
      border-bottom:1px solid var(--border-color); h2{font-size:18px;font-weight:800}}
    .modal-form{padding:24px}
    .full-width{width:100%;margin-bottom:8px}
    .modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;
      padding-top:16px;border-top:1px solid var(--border-color)}
  `],
})
export class AreasComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);

  areas     = signal<any[]>([]);
  roles     = signal<any[]>([]);
  pantallas = signal<any[]>([]);
  cargando  = signal(false);
  modalOpen = signal(false);
  editando  = signal<any | null>(null);

  form = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    rolesIds: [[] as number[]],
    pantallasIds: [[] as number[]],
  });

  ngOnInit() {
    this.cargarCatalogos();
    this.cargar();
  }

  cargarCatalogos() {
    this.api.get<any[]>('roles').subscribe({ next: roles => this.roles.set(roles) });
    this.api.get<any[]>('pantallas').subscribe({ next: pantallas => this.pantallas.set(pantallas) });
  }

  cargar() {
    this.cargando.set(true);
    this.api.get<any[]>('areas').subscribe({
      next: a => { this.areas.set(a); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  abrirModal(area?: any) {
    this.editando.set(area ?? null);
    this.form.reset({ nombre: '', descripcion: '', rolesIds: [], pantallasIds: [] });
    if (area) {
      this.form.patchValue({
        nombre: area.nombre,
        descripcion: area.descripcion,
        rolesIds: area.rolesIds ?? area.roles?.map((rol: any) => rol.id) ?? [],
        pantallasIds: area.pantallasIds ?? area.pantallas?.map((pantalla: any) => pantalla.id) ?? [],
      });
    }
    this.modalOpen.set(true);
  }

  cerrarModal() { this.modalOpen.set(false); this.editando.set(null); }

  guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const op = this.editando()
      ? this.api.put(`areas/${this.editando().id}`, this.form.value)
      : this.api.post('areas', this.form.value);

    op.subscribe({
      next: () => {
        this.snack.open(this.editando() ? 'Área actualizada' : 'Área creada', '', { duration: 3000, panelClass: 'snack-success' });
        this.cerrarModal(); this.cargar();
      },
      error: err => this.snack.open(err?.error?.message ?? 'Error', 'Cerrar', { duration: 4000, panelClass: 'snack-error' }),
    });
  }

  eliminar(a: any) {
    if (!confirm(`¿Eliminar área ${a.nombre}?`)) return;
    this.api.delete(`areas/${a.id}`).subscribe({
      next: () => { this.snack.open('Área eliminada', '', { duration: 3000, panelClass: 'snack-success' }); this.cargar(); },
      error: () => this.snack.open('Error al eliminar', '', { duration: 3000, panelClass: 'snack-error' }),
    });
  }
}
