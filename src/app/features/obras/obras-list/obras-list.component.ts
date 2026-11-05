import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ObraResumenPdfData, crearResumenObraPdf } from './obra-resumen-pdf.util';

@Component({
  selector: 'app-obras-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './obras-list.component.html',
  styleUrl: './obras-list.component.scss',
})
export class ObrasListComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private resumenObjectUrl: string | null = null;

  obras: any[] = [];
  cargando = false;
  importaciones: { id: number; archivo: string; filas: { id: number; hoja: string; fila: number; obraId: number | null; datos: { celdas: { columna: number; valor: string | number | null }[] } }[] }[] = [];
  mostrarImportaciones = false;
  errorImportaciones = '';
  cargarImportaciones(): void {
    this.mostrarImportaciones = !this.mostrarImportaciones;
    if (!this.mostrarImportaciones || this.importaciones.length) return;
    this.api.get<typeof this.importaciones>('obras/importaciones').subscribe({
      next: datos => { this.importaciones = datos; this.errorImportaciones = ''; },
      error: () => this.errorImportaciones = 'No se pudieron cargar los antecedentes.',
    });
  }
  busqueda = '';
  filtroAnio = '';
  filtroEstado = '';
  filtroTipoContratacion = '';
  filtroNumeroLicitacionConcurso = '';
  vistaPreviaResumenUrl: SafeResourceUrl | null = null;
  resumenParaDescarga: ObraResumenPdfData | null = null;
  generandoResumen = false;
  get anios(): number[] { return [...new Set<number>(this.obras.map(o => o.anioObra).filter(Boolean))].sort((a, b) => b - a); }
  get estados(): string[] { return [...new Set<string>(this.obras.map(o => o.estadoSeguimiento?.nombre).filter(Boolean))].sort(); }
  get tiposContratacion(): string[] { return [...new Set<string>(this.obras.map(o => o.modalidadContratacion?.nombre).filter(Boolean))].sort(); }

  get obrasFiltradas() {
    const texto = this.busqueda.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const numeroLicitacionConcurso = this.filtroNumeroLicitacionConcurso.trim().toLowerCase();
    return this.obras.filter(o => (!this.filtroAnio || String(o.anioObra) === this.filtroAnio)
      && (!this.filtroEstado || o.estadoSeguimiento?.nombre === this.filtroEstado)
      && (!this.filtroTipoContratacion || o.modalidadContratacion?.nombre === this.filtroTipoContratacion)
      && (!numeroLicitacionConcurso || o.numeroContrato?.toLowerCase().includes(numeroLicitacionConcurso))
      && (!texto || [o.nombre, o.expediente, o.empresa?.razonSocial, o.empresaOrigen, o.referenciaContratacion].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(texto)));
  }

  columnas: string[] = [
    'acciones',
    'nombre',
    'expediente',
    'empresa',
    'sistemaContratacion',
    'numeroContrato',
    'numeroObra',
    'anioObra',
    'estadoSeguimiento',
    'financiamiento',
    'avance',
  ];

  readonly seccionesAvance = [
    { clave: 'datos', etiqueta: 'Datos' },
    { clave: 'adjudicacion', etiqueta: 'Adjudicación' },
    { clave: 'computo', etiqueta: 'Cómputo' },
    { clave: 'planTrabajo', etiqueta: 'Plan' },
    { clave: 'certificados', etiqueta: 'Certificados' },
  ];

  formatoContratacion(value: string | null | undefined): string {
    const formatos: Record<string, string> = {
      UNIDAD_DE_MEDIDA: 'Unidad de medida',
      AJUSTE_ALZADO: 'Ajuste alzado',
    };

    return value ? formatos[value] ?? value.replaceAll('_', ' ') : '—';
  }

  ngOnInit(): void {
    this.cargarObras();
  }

  cargarObras(): void {
    this.cargando = true;

    this.api.get<any[]>('obras').subscribe({
      next: (res) => {
        this.obras = res;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar obras', error);
        this.cargando = false;
      },
    });
  }

  nuevaObra(): void {
    this.router.navigate(['/obras/nueva']);
  }

  editarObra(id: number): void {
    this.router.navigate(['/obras', id, 'editar']);
  }

  imprimirResumenObra(id: number): void {
    this.cerrarVistaPreviaResumen();
    this.generandoResumen = true;
    forkJoin({
      obra: this.api.get<any>(`obras/${id}`),
      certificados: this.api.get<any[]>(`obras/${id}/certificados`),
    }).subscribe({
      next: async ({ obra, certificados }) => {
        try {
          this.resumenParaDescarga = { obra, certificados };
          const doc = await crearResumenObraPdf(this.resumenParaDescarga);
          this.resumenObjectUrl = URL.createObjectURL(doc.output('blob'));
          this.vistaPreviaResumenUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `${this.resumenObjectUrl}#toolbar=0&navpanes=0&scrollbar=1`,
          );
        } catch (error) {
          console.error('No se pudo generar el informe resumido de la obra', error);
        } finally {
          this.generandoResumen = false;
        }
      },
      error: (error) => {
        this.generandoResumen = false;
        console.error('No se pudo obtener la información para el informe resumido de la obra', error);
      },
    });
  }

  descargarResumen(): void {
    if (!this.resumenParaDescarga) return;
    void crearResumenObraPdf(this.resumenParaDescarga).then((doc) => {
      const nombre = String(this.resumenParaDescarga?.obra.nombre ?? 'obra').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'obra';
      doc.save(`informe-resumen-${nombre}.pdf`);
    });
  }

  cerrarVistaPreviaResumen(): void {
    if (this.resumenObjectUrl) URL.revokeObjectURL(this.resumenObjectUrl);
    this.resumenObjectUrl = null;
    this.vistaPreviaResumenUrl = null;
    this.resumenParaDescarga = null;
  }

  ngOnDestroy(): void {
    this.cerrarVistaPreviaResumen();
  }

}
