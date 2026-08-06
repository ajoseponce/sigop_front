import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-personas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './personas.component.html',
  styleUrls: ['./personas.component.scss'],
})
export class PersonasComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  personas = signal<any[]>([]);
  cargando = signal(false);
  modalOpen = signal(false);
  editando = signal<any | null>(null);

  columnas = ['nombreCompleto', 'dni', 'titulo', 'matricula', 'roles', 'estado', 'acciones'];

  titulos = [
    { value: 'ARQUITECTO', label: 'Arquitecto' },
    { value: 'INGENIERO', label: 'Ingeniero' },
    { value: 'MAESTRO_MAYOR_DE_OBRA', label: 'Maestro mayor de obra' },
  ];

  rolesDisponibles = [
    { value: 'INSPECTOR', label: 'Inspector' },
    { value: 'REPRESENTANTE_LEGAL', label: 'Representante legal' },
    { value: 'REPRESENTANTE_TECNICO', label: 'Representante técnico' },
  ];

  tiposMatricula = [
    { value: 'MN', label: 'MN' },
    { value: 'MP', label: 'MP' },
  ];

  form = this.fb.group({
    dni: ['', [Validators.minLength(7)]],
    cuil: [''],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    titulo: [''],
    tipoMatricula: [''],
    numeroMatricula: [''],
    email: ['', [Validators.email]],
    telefono: [''],
    domicilio: [''],
    fechaNacimiento: [''],
    activo: [true],
    roles: [[] as string[]],
  });

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.get<any[]>('personas').subscribe({
      next: (resp) => {
        this.personas.set(resp);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  abrirModal(persona?: any) {
    this.editando.set(persona ?? null);
    this.form.reset({
      dni: '',
      cuil: '',
      nombre: '',
      apellido: '',
      titulo: '',
      tipoMatricula: '',
      numeroMatricula: '',
      email: '',
      telefono: '',
      domicilio: '',
      fechaNacimiento: '',
      activo: true,
      roles: [],
    });

    if (persona) {
      this.form.patchValue({
        dni: persona.dni,
        cuil: persona.cuil ?? '',
        nombre: persona.nombre,
        apellido: persona.apellido,
        titulo: persona.titulo ?? '',
        tipoMatricula: persona.tipoMatricula ?? '',
        numeroMatricula: persona.numeroMatricula ?? '',
        email: persona.email ?? '',
        telefono: persona.telefono ?? '',
        domicilio: persona.domicilio ?? '',
        fechaNacimiento: persona.fechaNacimiento
          ? String(persona.fechaNacimiento).substring(0, 10)
          : '',
        activo: persona.activo,
        roles: persona.roles?.map((r: any) => r.rol) ?? [],
      });

      this.form.get('dni')?.disable();
    } else {
      this.form.get('dni')?.enable();
    }

    this.modalOpen.set(true);
  }

  cerrarModal() {
    this.modalOpen.set(false);
    this.editando.set(null);
    this.form.get('dni')?.enable();
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (!this.editando()) {
      const body = {
        dni: raw.dni || undefined,
        cuil: raw.cuil || undefined,
        nombre: raw.nombre,
        apellido: raw.apellido,
        titulo: raw.titulo || undefined,
        tipoMatricula: raw.tipoMatricula || undefined,
        numeroMatricula: raw.numeroMatricula || undefined,
        email: raw.email || undefined,
        telefono: raw.telefono || undefined,
        domicilio: raw.domicilio || undefined,
        fechaNacimiento: raw.fechaNacimiento || undefined,
        roles: raw.roles ?? [],
      };

      this.api.post('personas', body).subscribe({
        next: () => {
          this.snack.open('Persona creada', '', { duration: 3000, panelClass: 'snack-success' });
          this.cerrarModal();
          this.cargar();
        },
        error: (err) => {
          this.snack.open(err?.error?.message ?? 'Error al crear', 'Cerrar', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        },
      });

      return;
    }

    const id = this.editando().id;

    const bodyUpdate = {
      cuil: raw.cuil || undefined,
      nombre: raw.nombre,
      apellido: raw.apellido,
      titulo: raw.titulo || undefined,
      tipoMatricula: raw.tipoMatricula || undefined,
      numeroMatricula: raw.numeroMatricula || undefined,
      email: raw.email || undefined,
      telefono: raw.telefono || undefined,
      domicilio: raw.domicilio || undefined,
      fechaNacimiento: raw.fechaNacimiento || undefined,
      activo: raw.activo ?? true,
    };

    this.api.put(`personas/${id}`, bodyUpdate).subscribe({
      next: () => {
        const roles = raw.roles ?? [];

        if (roles.length > 0) {
          this.api.put(`personas/${id}/roles`, { roles }).subscribe({
            next: () => {
              this.snack.open('Persona actualizada', '', { duration: 3000, panelClass: 'snack-success' });
              this.cerrarModal();
              this.cargar();
            },
            error: (err) => {
              this.snack.open(err?.error?.message ?? 'Error al actualizar roles', 'Cerrar', {
                duration: 4000,
                panelClass: 'snack-error',
              });
            },
          });
        } else {
          this.snack.open('Persona actualizada', '', { duration: 3000, panelClass: 'snack-success' });
          this.cerrarModal();
          this.cargar();
        }
      },
      error: (err) => {
        this.snack.open(err?.error?.message ?? 'Error al actualizar', 'Cerrar', {
          duration: 4000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  eliminar(persona: any) {
    if (!confirm(`¿Eliminar a ${persona.apellido} ${persona.nombre}?`)) return;

    this.api.delete(`personas/${persona.id}`).subscribe({
      next: () => {
        this.snack.open('Persona eliminada', '', { duration: 3000, panelClass: 'snack-success' });
        this.cargar();
      },
      error: () => {
        this.snack.open('Error al eliminar', '', { duration: 3000, panelClass: 'snack-error' });
      },
    });
  }

  getNombreCompleto(persona: any) {
    return `${persona.apellido}, ${persona.nombre}`;
  }

  getRolesLabel(persona: any) {
    return persona.roles?.map((r: any) => this.labelRol(r.rol)).join(', ') ?? '-';
  }

  labelRol(rol: string) {
    const encontrado = this.rolesDisponibles.find(r => r.value === rol);
    return encontrado?.label ?? rol;
  }

  labelTitulo(titulo: string | null) {
    const encontrado = this.titulos.find(t => t.value === titulo);
    return encontrado?.label ?? '-';
  }
}
