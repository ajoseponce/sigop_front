import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from 'src/app/core/services/api.service';

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
  rubros?: RubroPlan[];
}

interface ObraPlan {
  estado?: 'BORRADOR' | 'ACTIVA' | 'FINALIZADA';
  contratos?: ContratoPlan[];
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
    return this.redondear(this.meses.reduce((total, _, indice) => total + this.totalMes(indice), 0));
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
        const pendientes = this.filas.filter((fila) => this.totalFila(fila) < 99.99).length;
        this.snack.open(
          pendientes > 0
            ? `Avance guardado. Quedan ${pendientes} rubro${pendientes === 1 ? '' : 's'} por completar`
            : 'Plan de trabajo completo guardado correctamente',
          'Cerrar',
          { duration: 4000 },
        );
        this.planSaved.emit();
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
