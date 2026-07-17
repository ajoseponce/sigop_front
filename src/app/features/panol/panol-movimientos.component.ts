import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';

type TipoMovimientoPanol = 'EGRESO' | 'INGRESO';
type EstadoCatalogo = 'A' | 'I';

interface Material {
  id: number;
  categoriaNombre: string;
  nombre: string;
  stockeable: boolean;
  cantidad: number;
  estado: EstadoCatalogo;
}

interface DetalleMovimiento {
  id: number;
  materialId: number;
  materialNombre: string;
  categoriaNombre: string;
  stockeable: boolean;
  cantidad: number;
  cantidadReingresada: number;
  cantidadPendiente: number;
  observacion: string | null;
  egresoDetalleId: number | null;
}

interface MovimientoPanol {
  id: number;
  tipo: TipoMovimientoPanol;
  numeroOrden: string;
  fecha: string;
  detalle: string | null;
  destino: string | null;
  autoriza: string | null;
  retira: string | null;
  traeAlPanol: string | null;
  detalles: DetalleMovimiento[];
}

interface FilaMovimiento {
  uid: number;
  materialId: number | null;
  materialNombre: string;
  categoriaNombre: string;
  stockeable: boolean;
  stockDisponible: number;
  cantidad: number;
  cantidadMax: number | null;
  observacion: string;
  egresoDetalleId: number | null;
  seleccionado: boolean;
  bloqueado: boolean;
}

@Component({
  selector: 'app-panol-movimientos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './panol-movimientos.component.html',
  styleUrls: ['./panol-movimientos.component.scss'],
})
export class PanolMovimientosComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private uid = 1;
  detalleDialog = viewChild<TemplateRef<unknown>>('detalleMovimientoDialog');

  materiales = signal<Material[]>([]);
  movimientos = signal<MovimientoPanol[]>([]);
  movimientoDetalle = signal<MovimientoPanol | null>(null);
  filas = signal<FilaMovimiento[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  buscandoEgreso = signal(false);
  tipoMovimiento = signal<TipoMovimientoPanol>('EGRESO');

  columnasFilas = ['seleccionado', 'material', 'stock', 'cantidad', 'observacion', 'acciones'];
  columnasMovimientos = ['tipo', 'fecha', 'orden', 'responsable', 'items', 'acciones'];
  columnasDetalle = ['material', 'categoria', 'cantidad', 'estado', 'observacion'];

  materialesActivos = computed(() => this.materiales().filter(material => material.estado === 'A'));
  tipoActual = computed(() => this.tipoMovimiento());
  esIngreso = computed(() => this.tipoActual() === 'INGRESO');
  filasSeleccionadas = computed(() =>
    this.filas().filter(fila => fila.seleccionado && fila.materialId && fila.cantidad > 0),
  );

  movimientoForm = this.fb.group({
    numeroOrden: ['', [Validators.required]],
    fecha: [this.hoy(), [Validators.required]],
    destino: [''],
    autoriza: [''],
    retira: [''],
    traeAlPanol: [''],
    egresoOrigenNumeroOrden: [''],
  });

  filtroForm = this.fb.group({
    fechaDesde: [''],
    fechaHasta: [''],
    tipo: ['' as '' | TipoMovimientoPanol],
  });

  ngOnInit(): void {
    this.cargarBase();
    this.agregarFila();
  }

  cargarBase() {
    this.cargando.set(true);
    this.api.get<Material[]>('panol/materiales').subscribe({
      next: materiales => {
        this.materiales.set(materiales);
        this.cargarMovimientos();
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

  cargarMovimientos() {
    const filtros = this.filtroForm.getRawValue();
    const params = new URLSearchParams();
    if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    const query = params.toString();

    this.api.get<MovimientoPanol[]>(`panol/movimientos${query ? `?${query}` : ''}`).subscribe({
      next: movimientos => {
        this.movimientos.set(movimientos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snack.open('Error al cargar movimientos', 'Cerrar', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  aplicarFiltros() {
    this.cargando.set(true);
    this.cargarMovimientos();
  }

  limpiarFiltros() {
    this.filtroForm.reset({ fechaDesde: '', fechaHasta: '', tipo: '' });
    this.aplicarFiltros();
  }

  cambiarTipo(tipo: TipoMovimientoPanol) {
    if (this.tipoActual() === tipo) return;

    this.tipoMovimiento.set(tipo);
    this.movimientoForm.patchValue({
      destino: '',
      autoriza: '',
      retira: '',
      traeAlPanol: '',
      egresoOrigenNumeroOrden: '',
    });
    this.filas.set([]);
    this.agregarFila();
  }

  agregarFila() {
    this.filas.update(filas => [
      ...filas,
      {
        uid: this.uid++,
        materialId: null,
        materialNombre: '',
        categoriaNombre: '',
        stockeable: false,
        stockDisponible: 0,
        cantidad: 1,
        cantidadMax: null,
        observacion: '',
        egresoDetalleId: null,
        seleccionado: true,
        bloqueado: false,
      },
    ]);
  }

  quitarFila(uid: number) {
    this.filas.update(filas => filas.filter(fila => fila.uid !== uid));
    if (this.filas().length === 0) this.agregarFila();
  }

  cambiarMaterial(uid: number, materialId: number) {
    const material = this.materiales().find(item => item.id === materialId);
    if (!material) return;

    this.filas.update(filas =>
      filas.map(fila =>
        fila.uid === uid
          ? {
              ...fila,
              materialId: material.id,
              materialNombre: material.nombre,
              categoriaNombre: material.categoriaNombre,
              stockeable: material.stockeable,
              stockDisponible: material.cantidad,
              cantidad: Math.max(fila.cantidad, 1),
            }
          : fila,
      ),
    );
  }

  cambiarCantidad(uid: number, cantidad: string | number) {
    const valor = Math.max(Number(cantidad) || 0, 0);
    this.filas.update(filas =>
      filas.map(fila =>
        fila.uid === uid
          ? { ...fila, cantidad: fila.cantidadMax ? Math.min(valor, fila.cantidadMax) : valor }
          : fila,
      ),
    );
  }

  cambiarObservacion(uid: number, observacion: string) {
    this.filas.update(filas =>
      filas.map(fila => (fila.uid === uid ? { ...fila, observacion } : fila)),
    );
  }

  cambiarSeleccion(uid: number, seleccionado: boolean) {
    this.filas.update(filas =>
      filas.map(fila => (fila.uid === uid ? { ...fila, seleccionado } : fila)),
    );
  }

  buscarEgreso() {
    const numero = this.movimientoForm.get('egresoOrigenNumeroOrden')?.value?.trim();
    if (!numero) {
      this.snack.open('Ingresá el número de egreso a buscar', 'Cerrar', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.buscandoEgreso.set(true);
    this.api.get<MovimientoPanol>(`panol/movimientos/egresos/${encodeURIComponent(numero)}/reingreso`).subscribe({
      next: egreso => {
        const pendientes = egreso.detalles.filter(detalle => detalle.cantidadPendiente > 0);
        this.buscandoEgreso.set(false);

        if (pendientes.length === 0) {
          this.snack.open('Ese egreso no tiene materiales stockeables pendientes', 'Cerrar', {
            duration: 3500,
            panelClass: 'snack-error',
          });
          return;
        }

        this.movimientoForm.patchValue({
          numeroOrden: this.movimientoForm.get('numeroOrden')?.value || egreso.numeroOrden,
        });
        this.tipoMovimiento.set('INGRESO');
        this.filas.set(pendientes.map(detalle => this.filaDesdeDetalle(detalle)));
      },
      error: err => {
        this.buscandoEgreso.set(false);
        this.snack.open(err?.error?.message ?? 'No se pudo buscar el egreso', 'Cerrar', {
          duration: 4000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  guardarMovimiento() {
    if (this.movimientoForm.invalid) {
      this.movimientoForm.markAllAsTouched();
      return;
    }

    const filas = this.filasSeleccionadas();
    if (filas.length === 0) {
      this.snack.open('Agregá al menos un material con cantidad', 'Cerrar', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    if (!this.validarFilas(filas)) return;

    const raw = this.movimientoForm.getRawValue();
    const body = {
      tipo: this.tipoActual(),
      numeroOrden: raw.numeroOrden?.trim(),
      fecha: raw.fecha,
      detalle: null,
      destino: this.tipoActual() === 'EGRESO' ? this.valor(raw.destino) : null,
      autoriza: this.valor(raw.autoriza),
      retira: this.tipoActual() === 'EGRESO' ? this.valor(raw.retira) : null,
      traeAlPanol: this.tipoActual() === 'INGRESO' ? this.valor(raw.traeAlPanol) : null,
      egresoOrigenNumeroOrden:
        this.tipoActual() === 'INGRESO' ? this.valor(raw.egresoOrigenNumeroOrden) : null,
      detalles: filas.map(fila => ({
        materialId: fila.materialId,
        cantidad: fila.cantidad,
        observacion: this.valor(fila.observacion),
        egresoDetalleId: fila.egresoDetalleId,
      })),
    };

    this.guardando.set(true);
    this.api.post('panol/movimientos', body).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snack.open('Movimiento registrado', '', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.limpiar();
        this.cargarBase();
      },
      error: err => {
        this.guardando.set(false);
        this.snack.open(err?.error?.message ?? 'Error al registrar movimiento', 'Cerrar', {
          duration: 4500,
          panelClass: 'snack-error',
        });
      },
    });
  }

  limpiar() {
    const tipo = this.tipoActual();
    this.movimientoForm.reset({
      numeroOrden: '',
      fecha: this.hoy(),
      destino: '',
      autoriza: '',
      retira: '',
      traeAlPanol: '',
      egresoOrigenNumeroOrden: '',
    });
    this.filas.set([]);
    this.agregarFila();
  }

  tipoLabel(tipo: TipoMovimientoPanol) {
    return tipo === 'EGRESO' ? 'Egreso' : 'Ingreso';
  }

  responsableMovimiento(movimiento: MovimientoPanol) {
    if (movimiento.tipo === 'INGRESO') return movimiento.traeAlPanol || '-';
    return movimiento.retira || movimiento.destino || '-';
  }

  abrirDetalle(movimiento: MovimientoPanol) {
    const template = this.detalleDialog();
    if (!template) return;

    this.movimientoDetalle.set(movimiento);
    this.dialog.open(template, {
      width: '860px',
      maxWidth: '96vw',
      panelClass: 'movement-detail-dialog',
    });
  }

  private validarFilas(filas: FilaMovimiento[]) {
    for (const fila of filas) {
      if (fila.cantidadMax && fila.cantidad > fila.cantidadMax) {
        this.snack.open(`La cantidad supera el pendiente de ${fila.materialNombre}`, 'Cerrar', {
          duration: 3500,
          panelClass: 'snack-error',
        });
        return false;
      }
    }
    return true;
  }

  private filaDesdeDetalle(detalle: DetalleMovimiento): FilaMovimiento {
    return {
      uid: this.uid++,
      materialId: detalle.materialId,
      materialNombre: detalle.materialNombre,
      categoriaNombre: detalle.categoriaNombre,
      stockeable: detalle.stockeable,
      stockDisponible: detalle.cantidad,
      cantidad: detalle.cantidadPendiente,
      cantidadMax: detalle.cantidadPendiente,
      observacion: detalle.observacion ?? '',
      egresoDetalleId: detalle.id,
      seleccionado: true,
      bloqueado: true,
    };
  }

  private hoy() {
    return new Date().toISOString().slice(0, 10);
  }

  private valor(valor?: string | null) {
    const limpio = valor?.trim();
    return limpio ? limpio : null;
  }
}
