import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-step-datos-basicos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSelectModule, MatFormFieldModule, MatAutocompleteModule, MatInputModule],
  templateUrl: './step-datos-basicos.component.html',
  styleUrl: './step-datos-basicos.component.scss',
})
export class StepDatosBasicosComponent {
  private fb = inject(FormBuilder);
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
  @Output() obraCreated = new EventEmitter<any>();

  form = this.fb.group({
    expediente: ['', Validators.required],
    anio: [null, Validators.required],
    fechaEmision: ['', Validators.required],
    nombre: ['', Validators.required],

    departamento: ['04', { disabled: true }],
    municipio: ['54', { disabled: true }],
    seccion: [''],
    manzana: [''],
    parcela: [''],
    calles: [''],

    presupuestoOficial: [null],
    anticipo: [null],

    tipoObraId: [null as number | null      , Validators.required]
  }); 
ngOnInit(): void {
  this.tipoObraSearch.valueChanges.subscribe(() => {
    this.filtrarTiposObra();
  });
}
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const payload = {
      empresaId: 1, // ← temporal (después vendrá de select)
      tipoObraId: raw.tipoObraId,

      nombre: raw.nombre,

      expediente: `${raw.expediente}-${raw.anio}`, // 🔥 concatenado

      seccion: raw.seccion,
      localidad: raw.municipio,
      departamento: raw.departamento,

      porcentajeAnticipo: raw.anticipo,
      porcentajeFondoReparo: 0, // temporal
    };

    console.log('PAYLOAD FINAL', payload);

    this.obraCreated.emit(payload);
  }
  tipoObraSearch = this.fb.control('');

tiposObraFiltrados = this.tiposObra;

filtrarTiposObra(): void {
  const value = this.tipoObraSearch.value?.toLowerCase() ?? '';

  this.tiposObraFiltrados = this.tiposObra.filter((tipo) =>
    tipo.nombre.toLowerCase().includes(value)
  );
}

seleccionarTipoObra(tipo: { id: number; nombre: string }): void {
  this.form.patchValue({
    tipoObraId: tipo.id,
  });

  this.tipoObraSearch.setValue(tipo.nombre);
}
}