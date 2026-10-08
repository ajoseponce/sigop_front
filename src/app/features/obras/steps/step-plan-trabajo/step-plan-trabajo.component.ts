import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from 'src/app/core/services/api.service';
import { crearInformeAvancePdf, descargarInformeAvancePdf } from './informe-avance-pdf.util';

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
  vigenciaDesde?: string | null;
  montoAnticipo?: string | null;
  rubros?: RubroPlan[];
}

interface ObraPlan {
  estado?: 'BORRADOR' | 'ACTIVA' | 'FINALIZADA';
  nombre?: string;
  fechaInicio?: string | null;
  expediente?: string | null;
  anioEmision?: number | null;
  localidad?: string | null;
  empresa?: { razonSocial?: string | null; cuit?: string | null } | null;
  contratos?: ContratoPlan[];
}

interface CertificadoPlan {
  id: number;
  numero: number;
  tipo: 'ANTICIPO_FINANCIERO' | 'OBRA';
  estado: 'BORRADOR' | 'APROBADO' | 'ANULADO';
  periodo: string | null;
  montoBruto: string | null;
  deduccionAnticipo?: string | null;
  deduccionFondoReparo?: string | null;
  montoFinal?: string | null;
  readecuacion?: {
    estado: 'BORRADOR' | 'APROBADO';
    incremento: string;
    incrementoNetoPagar: string;
  } | null;
  detalles: Array<{ itemId: number; precioUnitarioSnapshot: string; cantidadAcumulada: string; montoPeriodo: string }>;
}

interface FilaInformeAvance {
  mes: number;
  previstoParcial: number;
  previstoAcumulado: number;
  previstoMontoParcial: number;
  previstoMontoAcumulado: number;
  realAcumulado: number;
  realParcial: number;
  realMontoParcial: number;
  realMontoAcumulado: number;
  deduccionesParcial: number;
  deduccionesAcumuladas: number;
  deduccionAnticipoAcumulada: number;
  inversionRealAcumuladaBase: number;
  readecuacionesParcial: number;
  readecuacionesAcumuladas: number;
  pagoAcumulado: number;
  realDisponible: boolean;
}

interface FilaPlan {
  clave: string;
  rubroRef: string;
  nombre: string;
  incidencia: number;
  porcentajes: number[];
  itemIds: number[];
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
export class StepPlanTrabajoComponent implements OnChanges, OnDestroy {
  @Input() obraId: number | null = null;
  @Input() obra: ObraPlan | null = null;
  @Output() planSaved = new EventEmitter<void>();

  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);

  contrato: ContratoPlan | null = null;
  filas: FilaPlan[] = [];
  meses: number[] = [];
  certificados: CertificadoPlan[] = [];
  anticipoFinanciero = 0;
  guardando = false;
  vistaPreviaUrl: SafeResourceUrl | null = null;
  generandoVistaPrevia = false;
  private vistaPreviaObjectUrl: string | null = null;

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
    let deduccionesAcumuladas = 0;
    let deduccionAnticipoAcumulada = 0;
    let readecuacionesAcumuladas = 0;
    let pagoAcumulado = 0;
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
      const deduccionesParcial = this.redondear(certificadosMes.reduce(
        (total, certificado) => total + this.valorNumerico(certificado.deduccionAnticipo)
          + this.valorNumerico(certificado.deduccionFondoReparo), 0,
      ));
      deduccionesAcumuladas = this.redondear(deduccionesAcumuladas + deduccionesParcial);
      deduccionAnticipoAcumulada = this.redondear(deduccionAnticipoAcumulada + certificadosMes.reduce(
        (total, certificado) => total + this.valorNumerico(certificado.deduccionAnticipo), 0,
      ));
      const inversionRealAcumuladaBase = this.redondear(
        this.anticipoFinanciero + realMontoAcumulado - deduccionAnticipoAcumulada,
      );
      const readecuacionesParcial = this.redondear(certificadosMes.reduce(
        (total, certificado) => total + (certificado.readecuacion?.estado === 'APROBADO'
          ? this.valorNumerico(certificado.readecuacion.incremento) : 0), 0,
      ));
      readecuacionesAcumuladas = this.redondear(readecuacionesAcumuladas + readecuacionesParcial);
      pagoAcumulado = this.redondear(pagoAcumulado + certificadosMes.reduce(
        (total, certificado) => total + this.valorNumerico(certificado.montoFinal)
          + (certificado.readecuacion?.estado === 'APROBADO'
            ? this.valorNumerico(certificado.readecuacion.incrementoNetoPagar) : 0), 0,
      ));
      const ultimo = this.ultimoCertificadoHastaMes(indice);
      const realAcumulado = ultimo && this.totalContrato > 0
        ? this.redondear(ultimo.detalles.reduce((total, detalle) => total
          + this.valorNumerico(detalle.cantidadAcumulada) * this.valorNumerico(detalle.precioUnitarioSnapshot), 0,
        ) * 100 / this.totalContrato)
        : 0;
      const realParcial = this.totalContrato > 0 ? this.redondear(realMontoParcial * 100 / this.totalContrato) : 0;
      return { mes, previstoParcial, previstoAcumulado, previstoMontoParcial, previstoMontoAcumulado, realParcial, realAcumulado, realMontoParcial, realMontoAcumulado, deduccionesParcial, deduccionesAcumuladas, deduccionAnticipoAcumulada, inversionRealAcumuladaBase, readecuacionesParcial, readecuacionesAcumuladas, pagoAcumulado, realDisponible };
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
    descargarInformeAvancePdf(this.datosInformePdf());
  }

  async abrirVistaPrevia(): Promise<void> {
    this.cerrarVistaPrevia();
    this.generandoVistaPrevia = true;
    try {
      const doc = await crearInformeAvancePdf(this.datosInformePdf());
      this.vistaPreviaObjectUrl = URL.createObjectURL(doc.output('blob'));
      this.vistaPreviaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `${this.vistaPreviaObjectUrl}#toolbar=0&navpanes=0&scrollbar=1`,
      );
    } catch {
      this.snack.open('No se pudo generar la vista previa', 'Cerrar', { duration: 4000 });
    } finally {
      this.generandoVistaPrevia = false;
    }
  }

  cerrarVistaPrevia(): void {
    if (this.vistaPreviaObjectUrl) URL.revokeObjectURL(this.vistaPreviaObjectUrl);
    this.vistaPreviaObjectUrl = null;
    this.vistaPreviaUrl = null;
  }

  ngOnDestroy(): void {
    this.cerrarVistaPrevia();
  }

  private datosInformePdf() {
    return {
      nombreObra: this.obra?.nombre ?? '—',
      numeroContrato: this.contrato?.numeroContrato ?? undefined,
      fechaInicio: this.obra?.fechaInicio,
      expediente: this.obra?.expediente,
      anioEmision: this.obra?.anioEmision,
      fechaApertura: this.contrato?.vigenciaDesde,
      plazoObraDias: this.contrato?.plazoObraDias,
      localidad: this.obra?.localidad,
      empresa: this.obra?.empresa?.razonSocial,
      empresaCuit: this.obra?.empresa?.cuit,
      totalContrato: this.totalContrato,
      anticipoFinanciero: this.anticipoFinanciero,
      rubros: this.filas.map((fila) => ({
        rubroRef: fila.rubroRef,
        nombre: fila.nombre,
        monto: this.redondear(this.totalContrato * fila.incidencia / 100),
        incidencia: fila.incidencia,
        porcentajes: fila.porcentajes,
        reales: this.avanceRealRubroPorMes(fila),
      })),
      filas: this.informeAvance.map((fila) => ({
        mes: fila.mes,
        proyectadoParcial: fila.previstoParcial,
        proyectadoAcumulado: fila.previstoAcumulado,
        proyectadoMontoParcial: fila.previstoMontoParcial,
        proyectadoMontoAcumulado: fila.previstoMontoAcumulado,
        realParcial: fila.realParcial,
        realAcumulado: fila.realAcumulado,
        realMontoParcial: fila.realMontoParcial,
        realMontoAcumulado: fila.realMontoAcumulado,
        deduccionesParcial: fila.deduccionesParcial,
        deduccionesAcumuladas: fila.deduccionesAcumuladas,
        deduccionAnticipoAcumulada: fila.deduccionAnticipoAcumulada,
        inversionRealAcumuladaBase: fila.inversionRealAcumuladaBase,
        readecuacionesParcial: fila.readecuacionesParcial,
        readecuacionesAcumuladas: fila.readecuacionesAcumuladas,
        pagoAcumulado: fila.pagoAcumulado,
        realDisponible: fila.realDisponible,
      })),
    };
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
        itemIds: rubro.items.map((item) => item.id).filter((id): id is number => id !== undefined),
      };
    });
    this.cargarCertificados();
  }

  private cargarCertificados(): void {
    if (!this.obraId || !this.contrato?.planTrabajo) {
      this.certificados = [];
      this.anticipoFinanciero = 0;
      return;
    }
    this.api.get<CertificadoPlan[]>(`obras/${this.obraId}/certificados`).subscribe({
      next: (certificados) => {
        const anticipoEmitido = certificados
          .filter((certificado) => certificado.tipo === 'ANTICIPO_FINANCIERO' && certificado.estado !== 'ANULADO')
          .reduce((total, certificado) => total + this.valorNumerico(certificado.montoBruto), 0);
        const anticipoConfigurado = this.valorNumerico(this.contrato?.montoAnticipo);
        this.anticipoFinanciero = anticipoConfigurado > 0 ? anticipoConfigurado : anticipoEmitido;
        this.certificados = certificados
          .filter((certificado) => certificado.tipo === 'OBRA'
            && certificado.estado !== 'ANULADO'
            && certificado.periodo)
          .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
      },
      error: () => { this.certificados = []; },
    });
  }

  private certificadosDelMes(indice: number): CertificadoPlan[] {
    return this.certificados.filter((certificado) =>
      this.indiceMesCertificado(certificado) === indice,
    );
  }

  private ultimoCertificadoHastaMes(indice: number): CertificadoPlan | null {
    return this.certificados.reduce<CertificadoPlan | null>((ultimo, certificado) =>
      this.indiceMesCertificado(certificado) <= indice ? certificado : ultimo,
    null);
  }

  private indiceMesCertificado(certificado: CertificadoPlan): number {
    const primerPeriodo = this.certificados[0]?.periodo;
    if (!primerPeriodo || !certificado.periodo) return 0;
    // El primer certificado siempre corresponde al mes 1, aunque la obra haya
    // iniciado al final del mes calendario anterior.
    const inicio = new Date(`${primerPeriodo.slice(0, 10)}T00:00:00`);
    const periodo = new Date(`${certificado.periodo.slice(0, 10)}T00:00:00`);
    const diferencia = (periodo.getFullYear() - inicio.getFullYear()) * 12
      + periodo.getMonth() - inicio.getMonth();
    return Math.max(0, Math.min(diferencia, this.meses.length - 1));
  }

  private avanceRealRubroPorMes(fila: FilaPlan): number[] {
    const montoRubro = this.redondear(this.totalContrato * fila.incidencia / 100);
    if (!montoRubro || fila.itemIds.length === 0) return this.meses.map(() => 0);
    return this.meses.map((_, indice) => this.redondear(
      this.certificadosDelMes(indice).reduce((total, certificado) => total + certificado.detalles
        .filter((detalle) => fila.itemIds.includes(detalle.itemId))
        .reduce((subtotal, detalle) => subtotal + this.valorNumerico(detalle.montoPeriodo), 0), 0,
      ) * 100 / montoRubro,
    ));
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
