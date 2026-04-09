import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule, MatChipsModule,
  ],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss'],
})
export class UsuariosComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);

  usuarios  = signal<any[]>([]);
  roles     = signal<any[]>([]);
  areas     = signal<any[]>([]);
  cargando  = signal(false);
  modalOpen = signal(false);
  editando  = signal<any | null>(null);

  columnas = ['nombre', 'email', 'area', 'roles', 'estado', 'acciones'];

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8)]],
    nombre:   ['', Validators.required],
    apellido: ['', Validators.required],
    areaId:   [null],
    rolesIds: [[] as number[]],
    activo:   [true],
  });

  ngOnInit() {
    this.cargar();
    this.api.get<any[]>('roles').subscribe(r => this.roles.set(r));
    this.api.get<any[]>('areas').subscribe(a => this.areas.set(a));
  }

  cargar() {
    this.cargando.set(true);
    this.api.get<any[]>('usuarios').subscribe({
      next: u => { this.usuarios.set(u); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  abrirModal(usuario?: any) {
    this.editando.set(usuario ?? null);
    this.form.reset({ activo: true, rolesIds: [] });

    if (usuario) {
      this.form.patchValue({
        email:    usuario.email,
        nombre:   usuario.perfil?.nombre,
        apellido: usuario.perfil?.apellido,
        areaId:   usuario.perfil?.area?.id ?? null,
        rolesIds: usuario.roles?.map((r: any) => r.id) ?? [],
        activo:   usuario.activo,
      });
      this.form.get('password')?.clearValidators();
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    }
    this.form.get('password')?.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  cerrarModal() { this.modalOpen.set(false); this.editando.set(null); }

  guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const val = this.form.value;
    const body: any = {
      nombre: val.nombre, apellido: val.apellido,
      areaId: val.areaId, rolesIds: val.rolesIds, activo: val.activo,
    };

    const op = this.editando()
      ? this.api.put(`usuarios/${this.editando().id}`, body)
      : this.api.post('usuarios', { ...body, email: val.email, password: val.password });

    op.subscribe({
      next: () => {
        this.snack.open(
          this.editando() ? 'Usuario actualizado' : 'Usuario creado',
          '', { duration: 3000, panelClass: 'snack-success' }
        );
        this.cerrarModal();
        this.cargar();
      },
      error: err => {
        const msg = err?.error?.message ?? 'Error al guardar';
        this.snack.open(msg, 'Cerrar', { duration: 4000, panelClass: 'snack-error' });
      },
    });
  }

  toggleActivo(u: any) {
    this.api.put(`usuarios/${u.id}`, { activo: !u.activo }).subscribe({
      next: () => this.cargar(),
      error: () => this.snack.open('Error al actualizar', '', { duration: 3000 }),
    });
  }

  eliminar(u: any) {
    if (!confirm(`¿Eliminar a ${u.perfil?.nombre} ${u.perfil?.apellido}?`)) return;
    this.api.delete(`usuarios/${u.id}`).subscribe({
      next: () => { this.snack.open('Usuario eliminado', '', { duration: 3000, panelClass: 'snack-success' }); this.cargar(); },
      error: () => this.snack.open('Error al eliminar', '', { duration: 3000, panelClass: 'snack-error' }),
    });
  }
}
