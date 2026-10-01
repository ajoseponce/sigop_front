import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from 'src/app/core/services/api.service';
import { descargarInformeAvancePdf } from './informe-avance-pdf.util';

interface ItemPlan {
  id?: number;
  itemRef: string;
  nombre: string;
  unidad: string;
  cantidad: string | number;
  precioUnitario: string | number;
}

interface RubroPlan {
  id?: number;
  rubroRef: string;
  nombre: string;
  orden: number;
  items: ItemPlan[];
}

interface ContratoPlan {
  id: number;
  tipo?: string;
  plazoObraDias?: number | null;
  planTrabajo?: string | null;
  numeroContrato?: string | null;
  rubros?: RubroPlan[];
}

interface ObraPlan {
  estado?: 'BORRADOR' | 'ACTIVA' | 'FINALIZADA';
  nombre?: string;
  fechaInicio?: string | null;
  contratos?: ContratoPlan[];
}

interface CertificadoPlan {
  id: number;
  numero: number;
  tipo: 'ANTICIPO_FINANCIERO' | 'OBRA';
  estado: 'BORRADOR' | 'APROBADO' | 'ANULADO';
  periodo: string | null;
  montoBruto: string | null;
  detalles: Array<{ precioUnitarioSnapshot: string; cantidadAcumulada: string }>;
}

interface FilaInformeAvance {
  mes: number;
  previstoParcial: number;
  previstoAcumulado: number;
  previstoMontoParcial: number;
  previstoMontoAcumulado: number;
  realAcumulado: number;
  realMontoParcial: number;
  realMontoAcumulado: number;
  realDisponible: boolean;
}

interface FilaPlan {
  clave: string;
  rubroRef: string;
  nombre: string;
  incidencia: number;
  porcentajes: number[];
}

interface PlanGuardado {
  version: 2;
  meses: number;
  rubros: Record<string, number[]>;
}

@Component({
  selector: 'app-step-plan-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './step-plan-trabajo.component.html',
  styleUrl: './step-plan-trabajo.component.scss',
})
export class StepPlanTrabajoComponent implements OnChanges {
  @Input() obraId: number | null = null;
  @Input() obra: ObraPlan | null = null;
  @Output() planSaved = new EventEmitter<void>();

  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  contrato: ContratoPlan | null = null;
  filas: FilaPlan[] = [];
  meses: number[] = [];
  certificados: CertificadoPlan[] = [];
  guardando = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['obra']) this.cargarPlan();
  }

  get plazoDias(): number {
    return Number(this.contrato?.plazoObraDias ?? 0);
  }

  get obraActiva(): boolean {
    return this.obra?.estado === 'ACTIVA';
  }

  get totalComputo(): number {
    return this.filas.reduce((total, fila) => total + fila.incidencia, 0);
  }

  totalFila(fila: FilaPlan): number {
    return this.redondear(fila.porcentajes.reduce((total, valor) => total + this.numero(valor), 0));
  }

  totalMes(indice: number): number {
    return this.redondear(this.filas.reduce(
      (total, fila) => total + (fila.incidencia * this.numero(fila.porcentajes[indice])) / 100,
      0,
    ));
  }

  totalPlan(): number {
    return this.redondear(this.filas.reduce(
      (total, fila) => total + fila.incidencia * fila.porcentajes.reduce(
        (subtotal, porcentaje) => subtotal + this.numero(porcentaje),
        0,
      ) / 100,
      0,
    ));
  }

  get totalContrato(): number {
    return (this.contrato?.rubros ?? []).reduce((total, rubro) => total + this.montoRubro(rubro), 0);
  }

  get informeAvance(): FilaInformeAvance[] {
    let previstoAcumulado = 0;
    let previstoMontoAcumulado = 0;
    let realMontoAcumulado = 0;
    return this.meses.map((mes, indice) => {
      const previstoParcial = this.totalMes(indice);
      previstoAcumulado = this.redondear(previstoAcumulado + previstoParcial);
      const previstoMontoParcial = this.redondear(this.totalContrato * previstoParcial / 100);
      previstoMontoAcumulado = this.redondear(previstoMontoAcumulado + previstoMontoParcial);
      const certificadosMes = this.certificadosDelMes(indice);
      const realDisponible = certificadosMes.length > 0;
      const realMontoParcial = this.redondear(certificadosMes.reduce(
        (total, certificado) => total + this.valorNumerico(certificado.montoBruto), 0,
      ));
      realMontoAcumulado = this.redondear(realMontoAcumulado + realMontoParcial);
      const ultimo = this.ultimoCertificadoHastaMes(indice);
      const realAcumulado = ultimo && this.totalContrato > 0
        ? this.redondear(ultimo.detalles.reduce((total, detalle) => total
          + this.valorNumerico(detalle.cantidadAcumulada) * this.valorNumerico(detalle.precioUnitarioSnapshot), 0,
        ) * 100 / this.totalContrato)
        : 0;
      return { mes, previstoParcial, previstoAcumulado, previstoMontoParcial, previstoMontoAcumulado, realAcumulado, realMontoParcial, realMontoAcumulado, realDisponible };
    });
  }

  puntosCurva(tipo: 'previsto' | 'real'): string {
    const filas = this.informeAvance;
    const ancho = 700;
    const alto = 230;
    const inicioX = 35;
    const inicioY = 20;
    const saltoX = filas.length ? ancho / filas.length : ancho;
    const filasCurva = tipo === 'real' ? filas.filter((fila) => fila.realDisponible) : filas;
    return [`${inicioX},${inicioY + alto}`, ...filasCurva.map((fila) => {
      const avance = tipo === 'previsto' ? fila.previstoAcumulado : fila.realAcumulado;
      return `${inicioX + saltoX * fila.mes},${inicioY + alto - alto * avance / 100}`;
    })].join(' ');
  }

  posicionX(mes: number): number {
    return 35 + 700 * mes / this.meses.length;
  }

  posicionY(avance: number): number {
    return 250 - 2.3 * avance;
  }

  posicionEtiqueta(avance: number, desplazamiento: number): number {
    return Math.max(14, this.posicionY(avance) + desplazamiento);
  }

  imprimirInforme(): void {
    descargarInformeAvancePdf({
      nombreObra: this.obra?.nombre ?? '—',
      numeroContrato: this.contrato?.numeroContrato ?? undefined,
      filas: this.informeAvance.map((fila) => ({
        mes: fila.mes,
        proyectadoParcial: fila.previstoParcial,
        proyectadoAcumulado: fila.previstoAcumulado,
        proyectadoMontoAcumulado: fila.previstoMontoAcumulado,
        realAcumulado: fila.realAcumulado,
        realMontoAcumulado: fila.realMontoAcumulado,
        realDisponible: fila.realDisponible,
      })),
    });
  }

  guardar(): void {
    if (!this.obraId || !this.contrato) {
      this.snack.open('Primero tenés que guardar la adjudicación', 'Cerrar', { duration: 3500 });
      return;
    }
    if (!this.obraActiva) {
      this.snack.open('La obra debe estar activa para cargar el plan de trabajo', 'Cerrar', { duration: 4000 });
      return;
    }
    if (!this.plazoDias || this.meses.length === 0) {
      this.snack.open('Cargá el plazo de obra en días para generar el plan de trabajo', 'Cerrar', { duration: 4000 });
      return;
    }
    if (this.filas.length === 0) {
      this.snack.open('Primero cargá los rubros del cómputo', 'Cerrar', { duration: 3500 });
      return;
    }

    const invalida = this.filas.find((fila) => this.totalFila(fila) > 100.01);
    if (invalida) {
      this.snack.open(`El rubro ${invalida.rubroRef} no puede superar el 100%`, 'Cerrar', { duration: 5000 });
      return;
    }

    const plan: PlanGuardado = {
      version: 2,
      meses: this.meses.length,
      rubros: Object.fromEntries(this.filas.map((fila) => [
        fila.clave,
        fila.porcentajes.map((valor) => this.redondear(this.numero(valor))),
      ])),
    };

    this.guardando = true;
    this.api.put<ContratoPlan>(`obras/${this.obraId}/plan-trabajo`, {
      planTrabajo: JSON.stringify(plan),
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.contrato!.planTrabajo = JSON.stringify(plan);
        const pendientes = this.filas.filter((fila) => this.totalFila(fila) < 99.99).length;
        this.snack.open(
          pendientes > 0
            ? `Avance guardado. Quedan ${pendientes} rubro${pendientes === 1 ? '' : 's'} por completar`
            : 'Plan de trabajo completo guardado correctamente',
          'Cerrar',
          { duration: 4000 },
        );
        this.planSaved.emit();
        this.cargarCertificados();
      },
      error: (error) => {
        this.guardando = false;
        this.snack.open(error?.error?.message || 'No se pudo guardar el plan de trabajo', 'Cerrar', { duration: 4500 });
      },
    });
  }

  trackFila(_: number, fila: FilaPlan): string {
    return fila.clave;
  }

  private cargarPlan(): void {
    this.contrato = this.obra?.contratos?.find((item) => item.tipo === 'ORIGINAL')
      ?? this.obra?.contratos?.[0]
      ?? null;
    const cantidadMeses = this.plazoDias > 0 ? Math.ceil(this.plazoDias / 30) : 0;
    this.meses = Array.from({ length: cantidadMeses }, (_, index) => index + 1);
    const guardado = this.leerPlan(this.contrato?.planTrabajo);
    const rubros = (this.contrato?.rubros ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden);
    const montoTotal = rubros.reduce((total, rubro) => total + this.montoRubro(rubro), 0);

    this.filas = rubros.map((rubro) => {
      const clave = rubro.id ? String(rubro.id) : rubro.rubroRef;
      const anteriores = guardado?.rubros?.[clave] ?? [];
      return {
        clave,
        rubroRef: rubro.rubroRef,
        nombre: rubro.nombre,
        incidencia: montoTotal > 0 ? this.redondear((this.montoRubro(rubro) / montoTotal) * 100) : 0,
        porcentajes: this.meses.map((_, index) => this.numero(anteriores[index])),
      };
    });
    this.cargarCertificados();
  }

  private cargarCertificados(): void {
    if (!this.obraId || !this.contrato?.planTrabajo) {
      this.certificados = [];
      return;
    }
    this.api.get<CertificadoPlan[]>(`obras/${this.obraId}/certificados`).subscribe({
      next: (certificados) => {
        this.certificados = certificados
          .filter((certificado) => certificado.tipo === 'OBRA'
            && certificado.estado === 'APROBADO'
            && certificado.periodo)
          .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
      },
      error: () => { this.certificados = []; },
    });
  }

  private certificadosDelMes(indice: number): CertificadoPlan[] {
    return this.certificados.filter((certificado, certificadoIndice) =>
      this.indiceMesCertificado(certificado, certificadoIndice) === indice,
    );
  }

  private ultimoCertificadoHastaMes(indice: number): CertificadoPlan | null {
    return this.certificados.reduce<CertificadoPlan | null>((ultimo, certificado, certificadoIndice) =>
      this.indiceMesCertificado(certificado, certificadoIndice) <= indice ? certificado : ultimo,
    null);
  }

  private indiceMesCertificado(certificado: CertificadoPlan, fallback: number): number {
    if (!this.obra?.fechaInicio || !certificado.periodo) return Math.min(fallback, this.meses.length - 1);
    const inicio = new Date(`${this.obra.fechaInicio.slice(0, 10)}T00:00:00`);
    const periodo = new Date(`${certificado.periodo.slice(0, 10)}T00:00:00`);
    const diferencia = (periodo.getFullYear() - inicio.getFullYear()) * 12
      + periodo.getMonth() - inicio.getMonth();
    return Math.max(0, Math.min(diferencia, this.meses.length - 1));
  }

  private leerPlan(valor?: string | null): PlanGuardado | null {
    if (!valor) return null;
    try {
      const plan = JSON.parse(valor) as PlanGuardado;
      return plan?.version === 2 && plan.rubros ? plan : null;
    } catch {
      return null;
    }
  }

  private montoItem(item: ItemPlan): number {
    return this.valorNumerico(item.cantidad) * this.valorNumerico(item.precioUnitario);
  }

  private montoRubro(rubro: RubroPlan): number {
    return rubro.items.reduce((total, item) => total + this.montoItem(item), 0);
  }

  private numero(valor: unknown): number {
    return Math.max(0, Math.min(100, this.valorNumerico(valor)));
  }

  private valorNumerico(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }

  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}
