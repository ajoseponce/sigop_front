import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';

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
export class ObrasListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

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
  get anios(): number[] { return [...new Set<number>(this.obras.map(o => o.anioObra).filter(Boolean))].sort((a, b) => b - a); }
  get estados(): string[] { return [...new Set<string>(this.obras.map(o => o.estadoSeguimiento?.nombre).filter(Boolean))].sort(); }
  get obrasFiltradas() {
    const texto = this.busqueda.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return this.obras.filter(o => (!this.filtroAnio || String(o.anioObra) === this.filtroAnio)
      && (!this.filtroEstado || o.estadoSeguimiento?.nombre === this.filtroEstado)
      && (!texto || [o.nombre, o.expediente, o.empresa?.razonSocial, o.empresaOrigen, o.referenciaContratacion].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(texto)));
  }

  columnas: string[] = [
    'nombre',
    'expediente',
    'empresa',
    'sistemaContratacion',
    'numeroObra',
    'anioObra',
    'estadoSeguimiento',
    'financiamiento',
    'avance',
    'acciones',
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

  imprimirCaratula(id: number): void {
    this.router.navigate(['/obras', id, 'caratula']);
  }
}
