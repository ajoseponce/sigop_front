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
  tiposObra = [
    { id: 1, nombre: 'Obras de hormigón elaborado / cordón cuneta' },
    { id: 2, nombre: 'Obras de cordón cuneta y empedrado' },
    { id: 3, nombre: 'Obras de concreto asfáltico' },
    { id: 4, nombre: 'Obras de paquete estructural' },
    { id: 5, nombre: 'Obra mixta (pavimento y luminarias)' },
    { id: 6, nombre: 'Espacios para juventudes' },
    { id: 7, nombre: 'Centro de atención al vecino / SUM / Delegaciones municipales' },
    { id: 8, nombre: 'Plazas' },
    { id: 9, nombre: 'Parques' },
    { id: 10, nombre: 'Arquitectura tipo A (Restauración y reciclaje)' },
    { id: 11, nombre: 'Arquitectura tipo B (Obra nueva mediana escala)' },
    { id: 12, nombre: 'Arquitectura tipo C (Obra nueva gran escala)' },
    { id: 13, nombre: 'Arquitectura tipo D (Obra nueva mayor complejidad)' },
    { id: 14, nombre: 'Galpones productivos' },
  ];

  form = this.fb.group({
    expediente: ['', Validators.required],
    anio: [null, Validators.required],
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
      fechaEmision: raw.fechaEmision,
      sistemaContratacion: raw.sistemaContratacion,

      departamento: raw.departamento,
      municipio: raw.municipio,
      localidad: raw.municipio,

      seccion: raw.seccion,
      manzana: raw.manzana,
      parcela: raw.parcela,
      calles: raw.calles,

      presupuestoOficial,
      porcentajeAnticipo,
    };
    console.log('PAYLOAD FINAL', payload);

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
    console.log('OBRA PARA EDITAR', this.obra);
    if (changes['obra'] && this.obra) {
      const tipoObraId = this.obra.tipoObra?.id ?? this.obra.tipoObraId;
      const tipoObraNombre = this.obra.tipoObra?.nombre ?? null;

      this.form.patchValue({
        tipoObraId,
        nombre: this.obra.nombre,
        expediente: this.obra.expediente,
        anio: this.obra.anioEmision,
        fechaEmision: this.obra.fechaEmision,
        sistemaContratacion: this.obra.sistemaContratacion ?? 'UNIDAD_DE_MEDIDA',
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
