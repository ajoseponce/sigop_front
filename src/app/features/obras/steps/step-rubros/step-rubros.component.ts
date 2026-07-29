import { CommonModule, registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from 'src/app/core/services/api.service';
import { descargarComputoPdf } from './computo-pdf.util';

registerLocaleData(localeEsAr);

interface ItemObra {
  itemRef: string;
  nombre: string;
  unidad: string;
  cantidad: string | number;
  precioUnitario: string | number;
}

interface RubroObra {
  rubroRef: string;
  nombre: string;
  orden: number;
  items: ItemObra[];
}

interface ContratoObra {
  tipo?: string;
  rubros?: RubroObra[];
}

interface ObraConRubros {
  nombre?: string;
  contratos?: ContratoObra[];
}

interface RubrosPayload {
  rubros: Array<{
    rubroRef: string;
    nombre: string;
    orden: number;
    items: Array<{
      itemRef: string;
      nombre: string;
      unidad: string;
      cantidad: number;
      precioUnitario: number;
    }>;
  }>;
}

@Component({
  selector: 'app-step-rubros',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './step-rubros.component.html',
  styleUrl: './step-rubros.component.scss',
})
export class StepRubrosComponent implements OnChanges {
  @Input() obraId: number | null = null;
  @Input() obra: ObraConRubros | null = null;
  @Output() rubrosSaved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly form = this.fb.group({
    rubros: this.fb.array<FormGroup>([]),
  });

  guardando = false;

  get rubros(): FormArray<FormGroup> {
    return this.form.controls.rubros;
  }

  get tieneContrato(): boolean {
    return Boolean(this.obra?.contratos?.length);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['obra'] && this.obra) {
      this.cargarRubrosExistentes();
    }
  }

  itemsDe(rubroIndex: number): FormArray<FormGroup> {
    return this.rubros.at(rubroIndex).get('items') as FormArray<FormGroup>;
  }

  agregarRubro(): void {
    const numero = this.rubros.length + 1;
    this.rubros.push(this.crearRubro({
      rubroRef: String(numero),
      nombre: '',
      orden: numero,
      items: [],
    }));
    this.agregarItem(this.rubros.length - 1);
  }

  eliminarRubro(index: number): void {
    this.rubros.removeAt(index);
    this.reordenarRubros();
  }

  agregarItem(rubroIndex: number): void {
    const items = this.itemsDe(rubroIndex);
    const rubroRef = String(this.rubros.at(rubroIndex).get('rubroRef')?.value || rubroIndex + 1);
    items.push(this.crearItem({
      itemRef: `${rubroRef}.${items.length + 1}`,
      nombre: '',
      unidad: 'un',
      cantidad: 1,
      precioUnitario: 0,
    }));
  }

  eliminarItem(rubroIndex: number, itemIndex: number): void {
    const items = this.itemsDe(rubroIndex);
    if (items.length === 1) {
      this.snack.open('Cada rubro debe contener al menos un ítem', 'Cerrar', { duration: 3000 });
      return;
    }
    items.removeAt(itemIndex);
  }

  subtotalItem(rubroIndex: number, itemIndex: number): number {
    const item = this.itemsDe(rubroIndex).at(itemIndex);
    return this.numero(item.get('cantidad')?.value) * this.numero(item.get('precioUnitario')?.value);
  }

  totalRubro(rubroIndex: number): number {
    return this.itemsDe(rubroIndex).controls.reduce(
      (total, _, itemIndex) => total + this.subtotalItem(rubroIndex, itemIndex),
      0,
    );
  }

  get totalGeneral(): number {
    return this.rubros.controls.reduce(
      (total, _, rubroIndex) => total + this.totalRubro(rubroIndex),
      0,
    );
  }

  incidenciaRubro(rubroIndex: number): number {
    return this.totalGeneral > 0 ? (this.totalRubro(rubroIndex) / this.totalGeneral) * 100 : 0;
  }

  guardar(): void {
    if (!this.obraId || !this.tieneContrato) {
      this.snack.open('Primero tenés que guardar la adjudicación y el contrato', 'Cerrar', { duration: 3500 });
      return;
    }
    if (this.form.invalid || this.rubros.length === 0) {
      this.form.markAllAsTouched();
      this.snack.open('Completá los rubros e ítems requeridos', 'Cerrar', { duration: 3500 });
      return;
    }

    const payload = this.crearPayload();
    this.guardando = true;
    this.api.post<RubroObra[]>(`obras/${this.obraId}/rubros`, payload).subscribe({
      next: () => {
        this.guardando = false;
        this.snack.open('Cómputo y presupuesto guardado correctamente', 'Cerrar', { duration: 3000 });
        this.rubrosSaved.emit();
      },
      error: (error) => {
        this.guardando = false;
        this.snack.open(
          error?.error?.message || 'Error al guardar los rubros e ítems',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  descargarPdf(): void {
    if (this.form.invalid || this.rubros.length === 0) {
      this.form.markAllAsTouched();
      this.snack.open('Completá los rubros e ítems antes de generar el PDF', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    const payload = this.crearPayload();
    descargarComputoPdf({
      nombreObra: this.obra?.nombre?.trim() || 'Obra',
      rubros: payload.rubros,
    });
  }

  private cargarRubrosExistentes(): void {
    const contrato = this.obra?.contratos?.find((item) => item.tipo === 'ORIGINAL')
      ?? this.obra?.contratos?.[0];
    const existentes = contrato?.rubros ?? [];

    this.rubros.clear();
    existentes
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .forEach((rubro) => this.rubros.push(this.crearRubro(rubro)));

    if (this.rubros.length === 0 && this.tieneContrato) {
      this.agregarRubro();
    }
  }

  private crearRubro(rubro: RubroObra): FormGroup {
    return this.fb.group({
      rubroRef: [rubro.rubroRef, [Validators.required, Validators.maxLength(20)]],
      nombre: [rubro.nombre, [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
      orden: [rubro.orden, [Validators.required, Validators.min(1)]],
      items: this.fb.array(rubro.items.map((item) => this.crearItem(item))),
    });
  }

  private crearItem(item: ItemObra): FormGroup {
    return this.fb.group({
      itemRef: [item.itemRef, [Validators.required, Validators.maxLength(20)]],
      nombre: [item.nombre, [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
      unidad: [item.unidad, [Validators.required, Validators.maxLength(50)]],
      cantidad: [this.numero(item.cantidad), [Validators.required, Validators.min(0.0001)]],
      precioUnitario: [this.numero(item.precioUnitario), [Validators.required, Validators.min(0)]],
    });
  }

  private crearPayload(): RubrosPayload {
    return {
      rubros: this.rubros.controls.map((rubro, rubroIndex) => ({
        rubroRef: String(rubro.get('rubroRef')?.value).trim(),
        nombre: String(rubro.get('nombre')?.value).trim(),
        orden: rubroIndex + 1,
        items: this.itemsDe(rubroIndex).controls.map((item) => ({
          itemRef: String(item.get('itemRef')?.value).trim(),
          nombre: String(item.get('nombre')?.value).trim(),
          unidad: String(item.get('unidad')?.value).trim(),
          cantidad: this.numero(item.get('cantidad')?.value),
          precioUnitario: this.numero(item.get('precioUnitario')?.value),
        })),
      })),
    };
  }

  private reordenarRubros(): void {
    this.rubros.controls.forEach((rubro, index) => {
      rubro.get('orden')?.setValue(index + 1);
    });
  }

  private numero(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
