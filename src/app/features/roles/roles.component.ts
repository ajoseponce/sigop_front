import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatSnackBarModule, MatTooltipModule,
  ],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss'],
})
export class RolesComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);

  roles     = signal<any[]>([]);
  cargando  = signal(false);
  modalOpen = signal(false);
  editando  = signal<any | null>(null);

  columnas = ['nombre', 'descripcion', 'estado', 'acciones'];

  form = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
  });

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.api.get<any[]>('roles').subscribe({
      next: r => { this.roles.set(r); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  abrirModal(rol?: any) {
    this.editando.set(rol ?? null);
    this.form.reset();
    if (rol) this.form.patchValue({ nombre: rol.nombre, descripcion: rol.descripcion });
    this.modalOpen.set(true);
  }

  cerrarModal() { this.modalOpen.set(false); this.editando.set(null); }

  guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const op = this.editando()
      ? this.api.put(`roles/${this.editando().id}`, this.form.value)
      : this.api.post('roles', this.form.value);

    op.subscribe({
      next: () => {
        this.snack.open(this.editando() ? 'Rol actualizado' : 'Rol creado', '', { duration: 3000, panelClass: 'snack-success' });
        this.cerrarModal(); this.cargar();
      },
      error: err => this.snack.open(err?.error?.message ?? 'Error', 'Cerrar', { duration: 4000, panelClass: 'snack-error' }),
    });
  }

  eliminar(r: any) {
    if (!confirm(`¿Eliminar rol ${r.nombre}?`)) return;
    this.api.delete(`roles/${r.id}`).subscribe({
      next: () => { this.snack.open('Rol eliminado', '', { duration: 3000, panelClass: 'snack-success' }); this.cargar(); },
      error: () => this.snack.open('Error al eliminar', '', { duration: 3000, panelClass: 'snack-error' }),
    });
  }
}
