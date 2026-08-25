import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

type SerieDia = { fecha: string; litros: number; cargas: number };
type SerieChofer = { nombre: string; legajo: string | null; litros: number; cargas: number };
type SerieInterno = { interno: number; litros: number; cargas: number };
type Estadisticas = {
  resumen: { totalLitros: number; totalCargas: number; promedioLitros: number; totalInternos: number };
  porDia: SerieDia[]; porChofer: SerieChofer[]; porInterno: SerieInterno[];
};

@Component({
  selector: 'app-combustible-estadisticas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSelectModule, MatSnackBarModule],
  templateUrl: './estadisticas.component.html',
  styleUrls: ['./estadisticas.component.scss'],
})
export class EstadisticasComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  datos = signal<Estadisticas | null>(null);
  choferes = signal<any[]>([]);
  cargando = signal(false);
  readonly grafico = { ancho: 900, alto: 285, izquierda: 56, derecha: 24, arriba: 22, abajo: 48 };

  form = this.fb.group({
    fechaDesde: [this.fechaHaceDias(30)],
    fechaHasta: [this.hoy()],
    choferId: [null as number | null],
    interno: [''],
    litrosDesde: [null as number | null],
  });

  ngOnInit() {
    forkJoin({
      choferes: this.api.get<any[]>('combustible/choferes?incluirInactivos=true'),
      datos: this.api.get<Estadisticas>(`combustible/estadisticas?${this.parametros()}`),
    }).subscribe({
      next: ({ choferes, datos }) => { this.choferes.set(choferes); this.datos.set(this.normalizar(datos)); },
      error: () => this.snack.open('No se pudieron cargar las estadísticas', 'Cerrar', { duration: 4000 }),
    });
  }

  aplicarFiltros() {
    this.cargando.set(true);
    this.api.get<Estadisticas>(`combustible/estadisticas?${this.parametros()}`).subscribe({
      next: datos => { this.datos.set(this.normalizar(datos)); this.cargando.set(false); },
      error: err => { this.cargando.set(false); this.snack.open(err?.error?.message ?? 'No se pudieron aplicar los filtros', 'Cerrar', { duration: 4000 }); },
    });
  }

  limpiar() {
    this.form.reset({ fechaDesde: this.fechaHaceDias(30), fechaHasta: this.hoy(), choferId: null, interno: '', litrosDesde: null });
    this.aplicarFiltros();
  }

  get dias() { return this.datos()?.porDia ?? []; }
  get choferesTop() { return (this.datos()?.porChofer ?? []).slice(0, 10); }
  get internosTop() { return (this.datos()?.porInterno ?? []).slice(0, 10); }
  get maxDia() { return Math.max(...this.dias.map(item => item.litros), 1); }
  get maxChofer() { return Math.max(...this.choferesTop.map(item => item.litros), 1); }
  get maxInterno() { return Math.max(...this.internosTop.map(item => item.litros), 1); }
  get ticksY() { return [0, 1, 2, 3, 4].map(i => ({ valor: this.maxDia * i / 4, y: this.y(this.maxDia * i / 4) })); }
  get puntosLinea() { return this.dias.map((item, i) => `${this.x(i)},${this.y(item.litros)}`).join(' '); }

  x(index: number) {
    const usable = this.grafico.ancho - this.grafico.izquierda - this.grafico.derecha;
    return this.grafico.izquierda + (this.dias.length <= 1 ? usable / 2 : index * usable / (this.dias.length - 1));
  }
  y(litros: number) {
    const usable = this.grafico.alto - this.grafico.arriba - this.grafico.abajo;
    return this.grafico.arriba + usable - litros / this.maxDia * usable;
  }
  anchoBarra(valor: number, maximo: number) { return `${Math.max(valor / maximo * 100, valor > 0 ? 2 : 0)}%`; }
  fechaCorta(fecha: string) { const [, mes, dia] = fecha.split('-'); return `${dia}/${mes}`; }
  formatoLitros(valor: unknown, decimales = 2) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '0';
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: decimales }).format(numero);
  }

  private parametros() {
    const raw = this.form.getRawValue();
    const params = new URLSearchParams();
    if (raw.fechaDesde) params.set('fechaDesde', raw.fechaDesde);
    if (raw.fechaHasta) params.set('fechaHasta', raw.fechaHasta);
    if (raw.choferId) params.set('choferId', String(raw.choferId));
    if (raw.interno) params.set('interno', raw.interno);
    if (raw.litrosDesde !== null) params.set('litrosDesde', String(raw.litrosDesde));
    return params.toString();
  }
  private normalizar(datos: Estadisticas): Estadisticas {
    const numero = (valor: unknown) => Number.isFinite(Number(valor)) ? Number(valor) : 0;
    return {
      resumen: {
        totalLitros: numero(datos?.resumen?.totalLitros),
        totalCargas: numero(datos?.resumen?.totalCargas),
        promedioLitros: numero(datos?.resumen?.promedioLitros),
        totalInternos: numero(datos?.resumen?.totalInternos),
      },
      porDia: (datos?.porDia ?? []).map(item => ({ ...item, litros: numero(item.litros), cargas: numero(item.cargas) })),
      porChofer: (datos?.porChofer ?? []).map(item => ({ ...item, litros: numero(item.litros), cargas: numero(item.cargas) })),
      porInterno: (datos?.porInterno ?? []).map(item => ({
        ...item,
        interno: numero(item.interno),
        litros: numero(item.litros),
        cargas: numero(item.cargas),
      })),
    };
  }
  private hoy() { const d = new Date(); return this.fechaInput(d); }
  private fechaHaceDias(dias: number) { const d = new Date(); d.setDate(d.getDate() - dias); return this.fechaInput(d); }
  private fechaInput(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
}
