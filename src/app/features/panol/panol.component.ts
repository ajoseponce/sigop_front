import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';

type EstadoCatalogo = 'A' | 'I';

interface CategoriaRecurso {
  id: number;
  nombre: string;
  estado: EstadoCatalogo;
  materialesCount: number;
}

@Component({
  selector: 'app-panol',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './panol.component.html',
  styleUrls: ['./panol.component.scss'],
})
export class PanolComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  categorias = signal<CategoriaRecurso[]>([]);
  cargando = signal(false);
  categoriaEditando = signal<CategoriaRecurso | null>(null);

  columnasCategorias = ['nombre', 'materiales', 'estado', 'acciones'];

  categoriaForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    estado: ['A' as EstadoCatalogo, [Validators.required]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.get<CategoriaRecurso[]>('panol/categorias').subscribe({
      next: categorias => {
        this.categorias.set(categorias);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snack.open('Error al cargar categorías', 'Cerrar', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  editarCategoria(categoria: CategoriaRecurso) {
    this.categoriaEditando.set(categoria);
    this.categoriaForm.reset({
      nombre: categoria.nombre,
      estado: categoria.estado,
    });
  }

  cancelarCategoria() {
    this.categoriaEditando.set(null);
    this.categoriaForm.reset({ nombre: '', estado: 'A' });
  }

  guardarCategoria() {
    if (this.categoriaForm.invalid) {
      this.categoriaForm.markAllAsTouched();
      return;
    }

    const raw = this.categoriaForm.getRawValue();
    const body = {
      nombre: raw.nombre?.trim(),
      estado: raw.estado ?? 'A',
    };
    const editando = this.categoriaEditando();
    const op = editando
      ? this.api.put(`panol/categorias/${editando.id}`, body)
      : this.api.post('panol/categorias', body);

    op.subscribe({
      next: () => {
        this.snack.open(editando ? 'Categoria actualizada' : 'Categoria creada', '', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.cancelarCategoria();
        this.cargar();
      },
      error: err => this.snack.open(err?.error?.message ?? 'Error al guardar categoría', 'Cerrar', {
        duration: 4000,
        panelClass: 'snack-error',
      }),
    });
  }

  eliminarCategoria(categoria: CategoriaRecurso) {
    if (!confirm(`¿Eliminar categoría ${categoria.nombre}?`)) return;

    this.api.delete(`panol/categorias/${categoria.id}`).subscribe({
      next: () => {
        this.snack.open('Categoria eliminada', '', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.cargar();
      },
      error: err => this.snack.open(err?.error?.message ?? 'Error al eliminar categoría', 'Cerrar', {
        duration: 4000,
        panelClass: 'snack-error',
      }),
    });
  }

  estadoLabel(estado: EstadoCatalogo) {
    return estado === 'A' ? 'Activo' : 'Inactivo';
  }
}
