import { ApiService } from '../../../../core/services/api.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

const FIELD_LABELS: Record<string, string> = {
  expediente: 'Expediente madre',
  anio: 'Año',
  fechaEmision: 'Fecha de emisión',
  nombre: 'Nombre de la obra',
  sistemaContratacion: 'Sistema de contratación',
  anticipo: 'Anticipo financiero (%)',
};

@Component({
  selector: 'app-step-datos-basicos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSelectModule, MatFormFieldModule, MatAutocompleteModule, MatInputModule, MatSnackBarModule],
  templateUrl: './step-datos-basicos.component.html',
  styleUrl: './step-datos-basicos.component.scss',
})
export class StepDatosBasicosComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  @Input() obra: any = null;
  @Input() obraId: number | null = null;
  @Output() obraSaved = new EventEmitter<any>();
  private api = inject(ApiService);
  tiposObra: { id: number; nombre: string }[] = [];

  form = this.fb.group({
    expediente: ['', Validators.required],
    anio: [null, Validators.required],
    anioObra: this.fb.control<number | null>(null, [Validators.min(1900), Validators.max(2100)]),
    fechaEmision: ['', Validators.required],
    nombre: ['', Validators.required],
    sistemaContratacion: ['UNIDAD_DE_MEDIDA', Validators.required],

    departamento: ['04', { disabled: true }],
    municipio: ['54', { disabled: true }],
    seccion: [''],
    manzana: [''],
    parcela: [''],
    calles: [''],

    presupuestoOficial: [null, [Validators.min(0)]],
    anticipo: [null, [Validators.min(0), Validators.max(100)]],

    tipoObraId: [null],
  });
  ngOnInit(): void {
    this.api.get<{ id: number; nombre: string }[]>('obras/tipos').subscribe({
      next: tipos => { this.tiposObra = tipos; this.filtrarTiposObra(); },
      error: () => this.snack.open('No se pudieron cargar los tipos de obra', 'Cerrar', { duration: 4000 }),
    });
    this.tipoObraSearch.valueChanges.subscribe(() => {
      this.filtrarTiposObra();
    });
  }
  get numeroObra(): string {
    const expediente = this.form.get('expediente')?.value?.toString().trim() ?? '';
    const anio = this.form.get('anio')?.value;
    if (!expediente || !anio) {
      return '';
    }
    return `01-${expediente}-${anio}`;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mostrarFormularioInvalido();
      return;
    }

    const raw = this.form.getRawValue();
    const tipoObraId = raw.tipoObraId ?? this.tiposObra.find((tipo) => tipo.nombre === this.tipoObraSearch.value)?.id;

    const presupuestoOficial = raw.presupuestoOficial === null
      ? undefined
      : Number(raw.presupuestoOficial);
    const porcentajeAnticipo = raw.anticipo === null
      ? undefined
      : Number(raw.anticipo);

    const payload = {
      tipoObraId,

      nombre: raw.nombre,
      numeroObra: this.numeroObra,
      expediente: raw.expediente,
      anioEmision: Number(raw.anio),
      anioObra: raw.anioObra,
      fechaEmision: raw.fechaEmision,
      sistemaContratacion: raw.sistemaContratacion,

      departamento: raw.departamento,
      municipio: raw.municipio,

      seccion: raw.seccion,
      manzana: raw.manzana,
      parcela: raw.parcela,
      calles: raw.calles,

      presupuestoOficial,
      porcentajeAnticipo,
    };
    this.obraSaved.emit(payload);
  }
  tipoObraSearch = this.fb.control('');

  tiposObraFiltrados = this.tiposObra;

  filtrarTiposObra(): void {
    const value = this.tipoObraSearch.value?.toLowerCase() ?? '';

    this.tiposObraFiltrados = this.tiposObra.filter((tipo) =>
      tipo.nombre.toLowerCase().includes(value)
    );
  }

 seleccionarTipoObra(tipo: any): void {
  this.form.patchValue({
    tipoObraId: tipo.id,
  });

  this.tipoObraSearch.setValue(tipo.nombre, {
    emitEvent: false,
  });
}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['obra'] && this.obra) {
      const tipoObraId = this.obra.tipoObra?.id ?? this.obra.tipoObraId;
      const tipoObraNombre = this.obra.tipoObra?.nombre ?? null;

      this.form.patchValue({
        tipoObraId,
        nombre: this.obra.nombre,
        expediente: this.obra.expediente,
        anio: this.obra.anioEmision,
        anioObra: this.obra.anioObra ?? null,
        fechaEmision: this.toDateInput(this.obra.fechaEmision),
        sistemaContratacion: this.obra.sistemaContratacion ?? null,
        departamento: this.obra.departamento ?? '04',
        municipio: this.obra.municipio ?? '54',
        seccion: this.obra.seccion ?? '',
        manzana: this.obra.manzana ?? '',
        parcela: this.obra.parcela ?? '',
        calles: this.obra.calles ?? '',
        presupuestoOficial: this.obra.presupuestoOficial ?? null,
        anticipo: this.obra.porcentajeAnticipo ?? null,
      });

      if (tipoObraNombre) {
        this.tipoObraSearch.setValue(tipoObraNombre, {
          emitEvent: false,
        });
      } else {
        const tipoSeleccionado = this.tiposObra.find(
          (tipo) => tipo.id === tipoObraId
        );

        if (tipoSeleccionado) {
          this.tipoObraSearch.setValue(tipoSeleccionado.nombre, {
            emitEvent: false,
          });
        }
      }
    }
  }

  private toDateInput(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  }

  private mostrarFormularioInvalido(): void {
    const faltantes = Object.entries(this.form.controls)
      .filter(([, control]) => control.hasError('required'))
      .map(([name]) => FIELD_LABELS[name] ?? name);

    const fueraDeRango = this.form.get('anticipo')?.hasError('max')
      ? 'El anticipo financiero no puede superar el 100%'
      : null;

    const message = fueraDeRango
      ?? (faltantes.length
        ? `Faltan campos obligatorios: ${faltantes.join(', ')}`
        : 'Revisá los campos marcados antes de continuar');

    this.snack.open(message, 'Cerrar', {
      duration: 5000,
      panelClass: 'snack-error',
    });
  }
}
