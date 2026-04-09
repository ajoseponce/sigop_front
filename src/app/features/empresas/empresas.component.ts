import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatSelectModule,
  ],
  templateUrl: './empresas.component.html',
  styleUrls: ['./empresas.component.scss'],
})
export class EmpresasComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  empresas = signal<any[]>([]);
  cargando = signal(false);
  modalOpen = signal(false);
  editando = signal<any | null>(null);

  columnas = ['nombre', 'cuit', 'email', 'telefono', 'estado', 'acciones'];

  estados = [
    { value: 'ACTIVA', label: 'Activa' },
    { value: 'INACTIVA', label: 'Inactiva' },
    { value: 'SUSPENDIDA', label: 'Suspendida' },
  ];

  form = this.fb.group({
    razonSocial: ['', [Validators.required, Validators.minLength(2)]],
    nombreFantasia: [''],
    cuit: ['', [Validators.required, Validators.minLength(11)]],
    estado: [''],
    direccion: [''],
    ciudad: [''],
    provincia: [''],
    pais: [''],
    telefono: [''],
    email: ['', [Validators.email]],
    representanteLegalId: [null as number | null],
    representanteTecnicoId: [null as number | null],
    activo: [true],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);

    this.api.get<any>('empresas').subscribe({
      next: (resp) => {
        this.empresas.set(resp?.data ?? resp ?? []);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar empresas:', err);
        this.cargando.set(false);
        this.snack.open('Error al cargar empresas', 'Cerrar', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  abrirModal(empresa?: any) {
    this.editando.set(empresa ?? null);

    this.form.reset({
      razonSocial: '',
      nombreFantasia: '',
      cuit: '',
      estado: '',
      direccion: '',
      ciudad: '',
      provincia: '',
      pais: '',
      telefono: '',
      email: '',
      representanteLegalId: null,
      representanteTecnicoId: null,
      activo: true,
    });

    if (empresa) {
      this.form.patchValue({
        razonSocial: empresa.razonSocial ?? '',
        nombreFantasia: empresa.nombreFantasia ?? '',
        cuit: empresa.cuit ?? '',
        estado: empresa.estado ?? '',
        direccion: empresa.direccion ?? '',
        ciudad: empresa.ciudad ?? '',
        provincia: empresa.provincia ?? '',
        pais: empresa.pais ?? '',
        telefono: empresa.telefono ?? '',
        email: empresa.email ?? '',
        representanteLegalId: empresa.representanteLegalId ?? null,
        representanteTecnicoId: empresa.representanteTecnicoId ?? null,
        activo: empresa.activo ?? true,
      });

      this.form.get('cuit')?.disable();
    } else {
      this.form.get('cuit')?.enable();
    }

    this.modalOpen.set(true);
  }

  cerrarModal() {
    this.modalOpen.set(false);
    this.editando.set(null);
    this.form.get('cuit')?.enable();
  }

  guardar() {
  console.log('ENTRO A GUARDAR');
  console.log('form valid?', this.form.valid);
  console.log('form errors', this.form.errors);
  console.log('raw', this.form.getRawValue());

  
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (!this.editando()) {
      const body = {
        razonSocial: raw.razonSocial,
        nombreFantasia: raw.nombreFantasia || undefined,
        cuit: raw.cuit,
        estado: raw.estado || undefined,
        direccion: raw.direccion || undefined,
        ciudad: raw.ciudad || undefined,
        provincia: raw.provincia || undefined,
        pais: raw.pais || undefined,
        telefono: raw.telefono || undefined,
        email: raw.email || undefined,
        representanteLegalId: raw.representanteLegalId || undefined,
        representanteTecnicoId: raw.representanteTecnicoId || undefined,
      };

      this.api.post('empresas', body).subscribe({
        next: () => {
          this.snack.open('Empresa creada', '', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.cerrarModal();
          this.cargar();
        },
        error: (err) => {
          console.error('Error al crear empresa:', err);
          this.snack.open(err?.error?.message ?? 'Error al crear empresa', 'Cerrar', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        },
      });

      return;
    }

    const bodyUpdate = {
      razonSocial: raw.razonSocial || undefined,
      nombreFantasia: raw.nombreFantasia || undefined,
      estado: raw.estado || undefined,
      direccion: raw.direccion || undefined,
      ciudad: raw.ciudad || undefined,
      provincia: raw.provincia || undefined,
      pais: raw.pais || undefined,
      telefono: raw.telefono || undefined,
      email: raw.email || undefined,
      representanteLegalId: raw.representanteLegalId || undefined,
      representanteTecnicoId: raw.representanteTecnicoId || undefined,
      activo: raw.activo ?? true,
    };

    this.api.put(`empresas/${this.editando().id}`, bodyUpdate).subscribe({
      next: () => {
        this.snack.open('Empresa actualizada', '', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.cerrarModal();
        this.cargar();
      },
      error: (err) => {
        console.error('Error al actualizar empresa:', err);
        this.snack.open(err?.error?.message ?? 'Error al actualizar empresa', 'Cerrar', {
          duration: 4000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  eliminar(empresa: any) {
    if (!confirm(`¿Eliminar la empresa ${empresa.razonSocial}?`)) {
      return;
    }

    this.api.delete(`empresas/${empresa.id}`).subscribe({
      next: () => {
        this.snack.open('Empresa eliminada', '', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.cargar();
      },
      error: (err) => {
        console.error('Error al eliminar empresa:', err);
        this.snack.open(err?.error?.message ?? 'Error al eliminar empresa', 'Cerrar', {
          duration: 4000,
          panelClass: 'snack-error',
        });
      },
    });
  }
}