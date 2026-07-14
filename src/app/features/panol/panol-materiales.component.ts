import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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

interface Material {
  id: number;
  categoriaId: number;
  categoriaNombre: string;
  nombre: string;
  stockeable: boolean;
  cantidad: number;
  numeroSerial: string | null;
  patrimonio: string | null;
  estado: EstadoCatalogo;
}

@Component({
  selector: 'app-panol-materiales',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './panol-materiales.component.html',
  styleUrls: ['./panol-materiales.component.scss'],
})
export class PanolMaterialesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  categorias = signal<CategoriaRecurso[]>([]);
  materiales = signal<Material[]>([]);
  cargando = signal(false);
  materialEditando = signal<Material | null>(null);
  filtroCategoriaId = signal<number | null>(null);

  columnasMateriales = ['nombre', 'categoria', 'stock', 'estado', 'acciones'];

  categoriasActivas = computed(() => this.categorias().filter(c => c.estado === 'A'));

  materialForm = this.fb.group({
    categoriaId: [null as number | null, [Validators.required]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    stockeable: [false],
    cantidad: [0, [Validators.min(0)]],
    numeroSerial: [''],
    patrimonio: [''],
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
        this.cargarMateriales();
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

  cargarMateriales() {
    const categoriaId = this.filtroCategoriaId();
    const path = categoriaId ? `panol/materiales?categoriaId=${categoriaId}` : 'panol/materiales';

    this.api.get<Material[]>(path).subscribe({
      next: materiales => {
        this.materiales.set(materiales);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snack.open('Error al cargar materiales', 'Cerrar', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  cambiarFiltroCategoria(categoriaId: number | null) {
    this.filtroCategoriaId.set(categoriaId);
    this.cargando.set(true);
    this.cargarMateriales();
  }

  editarMaterial(material: Material) {
    this.materialEditando.set(material);
    this.materialForm.reset({
      categoriaId: material.categoriaId,
      nombre: material.nombre,
      stockeable: material.stockeable,
      cantidad: material.cantidad,
      numeroSerial: material.numeroSerial ?? '',
      patrimonio: material.patrimonio ?? '',
      estado: material.estado,
    });
  }

  cancelarMaterial() {
    this.materialEditando.set(null);
    this.materialForm.reset({
      categoriaId: null,
      nombre: '',
      stockeable: false,
      cantidad: 0,
      numeroSerial: '',
      patrimonio: '',
      estado: 'A',
    });
  }

  guardarMaterial() {
    if (this.materialForm.invalid) {
      this.materialForm.markAllAsTouched();
      return;
    }

    const raw = this.materialForm.getRawValue();
    const stockeable = raw.stockeable ?? false;
    const numeroSerial = raw.numeroSerial?.trim() || null;
    const patrimonio = raw.patrimonio?.trim() || null;
    if (stockeable && !numeroSerial && !patrimonio) {
      this.snack.open('Ingresá número de serial o patrimonio para materiales stockeables', 'Cerrar', {
        duration: 4000,
        panelClass: 'snack-error',
      });
      return;
    }

    const body = {
      categoriaId: raw.categoriaId,
      nombre: raw.nombre?.trim(),
      stockeable,
      cantidad: raw.cantidad ?? 0,
      numeroSerial: stockeable ? numeroSerial : null,
      patrimonio: stockeable ? patrimonio : null,
      estado: raw.estado ?? 'A',
    };
    const editando = this.materialEditando();
    const op = editando
      ? this.api.put(`panol/materiales/${editando.id}`, body)
      : this.api.post('panol/materiales', body);

    op.subscribe({
      next: () => {
        this.snack.open(editando ? 'Material actualizado' : 'Material creado', '', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.cancelarMaterial();
        this.cargar();
      },
      error: err => this.snack.open(err?.error?.message ?? 'Error al guardar material', 'Cerrar', {
        duration: 4000,
        panelClass: 'snack-error',
      }),
    });
  }

  eliminarMaterial(material: Material) {
    if (!confirm(`¿Eliminar material ${material.nombre}?`)) return;

    this.api.delete(`panol/materiales/${material.id}`).subscribe({
      next: () => {
        this.snack.open('Material eliminado', '', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.cargar();
      },
      error: () => this.snack.open('Error al eliminar material', 'Cerrar', {
        duration: 3000,
        panelClass: 'snack-error',
      }),
    });
  }

  estadoLabel(estado: EstadoCatalogo) {
    return estado === 'A' ? 'Activo' : 'Inactivo';
  }

  esStockeable() {
    return this.materialForm.get('stockeable')?.value === true;
  }
}
