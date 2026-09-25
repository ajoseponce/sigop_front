import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';

interface Parametro { id: number; grupo: string; nombre: string; activo: boolean }
interface CeldaOrigen { columna: number; valor: unknown }
interface FilaOrigen { hoja: string; fila: number; datos: { celdas?: CeldaOrigen[] } }
interface ObraSeguimiento {
  id: number; anioObra?: number | null; financiamientoId?: number | null;
  modalidadContratacionId?: number | null; estadoSeguimientoId?: number | null; planoConformeId?: number | null;
  referenciaContratacion?: string | null; desarrolloObra?: string | null; estadoHeredado?: string | null;
  estadoActual?: string | null; enManosDe?: string | null; presupuestoSeguimiento?: string | null;
  comentariosSeguimiento?: string | null; deudaInformada?: string | null; documentacionUrl?: string | null;
  filasImportadas?: FilaOrigen[];
}

@Component({
  selector: 'app-seguimiento-obra', standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './seguimiento-obra.component.html',
  styles: [`:host{display:block;margin-bottom:24px}details{background:white;padding:20px;border:1px solid #ddd;border-radius:12px}summary{cursor:pointer;font-weight:600;font-size:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:20px 0}label{display:flex;flex-direction:column;gap:6px}input,select,textarea{padding:10px;border:1px solid #aaa;border-radius:6px;font:inherit;max-width:100%;box-sizing:border-box}textarea{min-height:100px}button{padding:10px 16px;margin:6px 8px 6px 0;cursor:pointer}.wide{grid-column:1/-1}.antecedente{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border-bottom:1px solid #ddd}small{color:#555}.catalogo{margin-top:20px}`],
})
export class SeguimientoObraComponent implements OnChanges, OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  @Input({ required: true }) obra!: ObraSeguimiento;
  @Output() guardado = new EventEmitter<ObraSeguimiento>();
  parametros: Parametro[] = [];
  guardando = false;
  nuevoGrupo = 'ESTADO_SEGUIMIENTO';
  nuevoNombre = '';
  readonly catalogos = [
    { campo: 'financiamientoId', grupo: 'FINANCIAMIENTO', etiqueta: 'Financiamiento' },
    { campo: 'modalidadContratacionId', grupo: 'MODALIDAD_CONTRATACION', etiqueta: 'Modalidad de contratación' },
    { campo: 'estadoSeguimientoId', grupo: 'ESTADO_SEGUIMIENTO', etiqueta: 'Estado en Construcciones' },
    { campo: 'planoConformeId', grupo: 'PLANO_CONFORME', etiqueta: 'Plano conforme a obra' },
  ];
  readonly textos = [
    { campo: 'desarrolloObra', etiqueta: 'Desarrollo de obra' },
    { campo: 'estadoHeredado', etiqueta: 'Estado heredado' },
    { campo: 'estadoActual', etiqueta: 'Estado actual / trámites' },
    { campo: 'comentariosSeguimiento', etiqueta: 'Comentarios' },
  ];
  form = this.fb.group({
    anioObra: this.fb.control<number | null>(null), financiamientoId: this.fb.control<number | null>(null),
    modalidadContratacionId: this.fb.control<number | null>(null), estadoSeguimientoId: this.fb.control<number | null>(null),
    planoConformeId: this.fb.control<number | null>(null), referenciaContratacion: [''], desarrolloObra: [''],
    estadoHeredado: [''], estadoActual: [''], enManosDe: [''], presupuestoSeguimiento: [''],
    comentariosSeguimiento: [''], deudaInformada: [''], documentacionUrl: [''],
  });
  ngOnInit(): void { this.cargarCatalogos(); }
  ngOnChanges(): void {
    if (this.obra) this.form.reset({ ...this.obra, deudaInformada: this.obra.deudaInformada ?? '' });
  }
  cargarCatalogos(): void {
    this.api.get<Parametro[]>('obras/parametros').subscribe({ next: p => this.parametros = p, error: () => this.error('No se pudieron cargar los catálogos') });
  }
  opciones(grupo: string, campo: string): Parametro[] {
    const seleccionado = this.form.get(campo)?.value;
    return this.parametros.filter(p => p.grupo === grupo && (p.activo || p.id === seleccionado));
  }
  guardar(): void {
    if (this.guardando || this.form.invalid) return;
    const valor = this.form.getRawValue();
    this.guardando = true;
    this.api.put<ObraSeguimiento>(`obras/${this.obra.id}/seguimiento`, { ...valor, deudaInformada: valor.deudaInformada?.trim() || null, documentacionUrl: valor.documentacionUrl?.trim() || null }).subscribe({
      next: obra => { this.guardando = false; this.guardado.emit(obra); this.snack.open('Seguimiento guardado', 'Cerrar', { duration: 3000 }); },
      error: err => { this.guardando = false; this.error(err?.error?.message || 'No se pudo guardar'); },
    });
  }
  agregarParametro(): void {
    if (this.nuevoNombre.trim().length < 2) return;
    this.api.post<Parametro>('obras/parametros', { grupo: this.nuevoGrupo, nombre: this.nuevoNombre.trim() }).subscribe({
      next: () => { this.nuevoNombre = ''; this.cargarCatalogos(); }, error: err => this.error(err?.error?.message || 'No se pudo crear el parámetro'),
    });
  }
  cambiarActivo(parametro: Parametro): void {
    this.api.put<Parametro>(`obras/parametros/${parametro.id}`, { activo: !parametro.activo }).subscribe({
      next: () => this.cargarCatalogos(), error: () => this.error('No se pudo actualizar el parámetro'),
    });
  }
  parametrosGrupo(): Parametro[] { return this.parametros.filter(p => p.grupo === this.nuevoGrupo); }
  get enlaceDocumentacion(): string | null {
    const url = this.obra.documentacionUrl;
    return url && /^https?:\/\//i.test(url) ? url : null;
  }
  valorCelda(valor: unknown): string {
    if (valor === null || valor === undefined) return '';
    if (typeof valor !== 'object') return String(valor);
    const v = valor as { text?: string; result?: unknown; richText?: { text: string }[] };
    return v.text ?? v.richText?.map(x => x.text).join('') ?? (v.result !== undefined ? String(v.result) : JSON.stringify(valor));
  }
  private error(mensaje: string): void { this.snack.open(mensaje, 'Cerrar', { duration: 5000 }); }
}
