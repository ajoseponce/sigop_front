import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../../core/services/api.service';
import { crearInformePendientesPdf, InformePendienteFila } from './informe-pendientes-pdf.util';

@Component({
  selector: 'app-informe-pendientes',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTableModule],
  templateUrl: './informe-pendientes.component.html',
  styleUrl: './informe-pendientes.component.scss',
})
export class InformePendientesComponent implements OnInit {
  private api = inject(ApiService);
  filas: InformePendienteFila[] = [];
  cargando = false;
  columnas = ['anio', 'contratacion', 'obra', 'empresa', 'evolucion', 'montoPendiente', 'avancePendiente', 'observaciones'];
  readonly money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando = true;
    this.api.get<any[]>('obras').subscribe({
      next: (obras) => {
        this.filas = obras
          .map((obra) => this.aFila(obra))
          .filter((fila): fila is InformePendienteFila => fila !== null)
          .sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0) || a.obra.localeCompare(b.obra, 'es'));
        this.cargando = false;
      },
      error: () => { this.cargando = false; },
    });
  }

  async exportarPdf(): Promise<void> {
    const doc = await crearInformePendientesPdf(this.filas);
    doc.save('informe-obras-pendientes-de-ejecucion.pdf');
  }

  get totalPendiente(): number { return this.filas.reduce((total, fila) => total + fila.montoPendiente, 0); }

  private aFila(obra: any): InformePendienteFila | null {
    const informe = obra.informePendiente;
    if (!informe) return null;
    const avanceAcumulado = Number(informe.avanceFisicoAcumulado ?? 0);
    // Una obra finalizada o certificada al 100 % no integra el pendiente de ejecución.
    if (obra.estado === 'FINALIZADA' || avanceAcumulado >= 99.995) return null;
    const montoContrato = Number(informe.montoContrato ?? 0);
    const montoCertificado = Number(informe.montoCertificado ?? 0);
    return {
      anio: obra.anioObra ?? obra.anioEmision ?? null,
      contratacion: obra.modalidadContratacion?.nombre ?? obra.referenciaContratacion ?? 'Sin informar',
      obra: obra.nombre,
      empresa: obra.empresa?.razonSocial ?? obra.empresaOrigen ?? 'Sin informar',
      avanceFisicoAcumulado: avanceAcumulado,
      avanceFinancieroAcumulado: Number(informe.avanceFinancieroAcumulado ?? 0),
      avancePendiente: Math.max(0, 100 - avanceAcumulado),
      montoAnticipoCertificado: Number(informe.montoAnticipoCertificado ?? 0),
      deudaAnticipoFinanciero: Number(informe.deudaAnticipoFinanciero ?? 0),
      montoPendiente: Math.max(0, montoContrato - montoCertificado) * Number(informe.fapConsolidado ?? 1),
      observaciones: obra.observaciones ?? '',
      estadoActual: obra.estadoActual ?? obra.estadoSeguimiento?.nombre ?? 'Sin informar',
    };
  }
}
