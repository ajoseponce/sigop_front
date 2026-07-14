import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from 'src/app/core/services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

const FIELD_LABELS: Record<string, string> = {
  inspectorNombre: 'Nombre del inspector',
  inspectorDni: 'DNI del inspector',
  inspectorMatricula: 'Matrícula del inspector',
  fechaReplanteo: 'Fecha de replanteo',
};

@Component({
  selector: 'app-step-ejecucion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './step-ejecucion.component.html',
  styleUrl: './step-ejecucion.component.scss',
})
export class StepEjecucionComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  @Input() obraId!: number | null;
  @Input() obra: any = null;
  @Output() ejecucionSaved = new EventEmitter<void>();

  form = this.fb.group({
    inspectorNombre: ['', Validators.required],
    inspectorDni: ['', Validators.required],
    inspectorMatricula: ['', Validators.required],

    fechaReplanteo: ['', Validators.required],
    observaciones: [''],
    fechaNeutralizacion: [''],
    fechaReinicio: [''],
    fechaAmpliacionPlazo: [''],
    modificacion: [''],
    fechaRescision: [''],
    fechaRecepcionProvisoria: [''],
    fechaRecepcionDefinitiva: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['obra'] && this.obra) {
      this.form.patchValue({
        inspectorNombre: this.obra.inspectorNombre ?? this.obra.inspector?.nombre ?? '',
        inspectorDni: this.obra.inspectorDni ?? this.obra.inspector?.dni ?? '',
        inspectorMatricula: this.obra.inspectorMatricula ?? '',
        fechaReplanteo: this.obra.fechaInicio ?? '',
        observaciones: this.obra.observaciones ?? '',
        fechaNeutralizacion: this.obra.fechaNeutralizacion ?? '',
        fechaReinicio: this.obra.fechaReinicio ?? '',
        fechaAmpliacionPlazo: this.obra.fechaAmpliacionPlazo ?? '',
        modificacion: this.obra.modificacion ?? '',
        fechaRescision: this.obra.fechaRescision ?? '',
        fechaRecepcionProvisoria: this.obra.fechaRecepcionProvisoria ?? '',
        fechaRecepcionDefinitiva: this.obra.fechaRecepcionDefinitiva ?? '',
      });
    }
  }

  save(): void {
    if (!this.obraId) {
      console.error('No existe obraId');
      this.snack.open('Primero tenés que guardar los pasos anteriores de la obra', 'Cerrar', {
        duration: 4000,
        panelClass: 'snack-error',
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mostrarFormularioInvalido();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      fechaInicio: raw.fechaReplanteo,
      inspectorNombre: raw.inspectorNombre,
      inspectorDni: raw.inspectorDni,
      inspectorMatricula: raw.inspectorMatricula,
      observaciones: raw.observaciones || undefined,
      fechaNeutralizacion: raw.fechaNeutralizacion || undefined,
      fechaReinicio: raw.fechaReinicio || undefined,
      fechaAmpliacionPlazo: raw.fechaAmpliacionPlazo || undefined,
      modificacion: raw.modificacion || undefined,
      fechaRescision: raw.fechaRescision || undefined,
      fechaRecepcionProvisoria: raw.fechaRecepcionProvisoria || undefined,
      fechaRecepcionDefinitiva: raw.fechaRecepcionDefinitiva || undefined,
    };

    this.api.put<any>(`obras/${this.obraId}`, payload).subscribe({
      next: () => {
        this.snack.open('Ejecución guardada correctamente', 'Cerrar', {
          duration: 3000,
        });
        this.ejecucionSaved.emit();
      },
      error: (error) => {
        console.error('Error al guardar ejecución', error);
        this.snack.open(error?.error?.message || 'Error al guardar ejecución', 'Cerrar', {
          duration: 3000,
        });
      },
    });
  }

  private mostrarFormularioInvalido(): void {
    const faltantes = Object.entries(this.form.controls)
      .filter(([, control]) => control.hasError('required'))
      .map(([name]) => FIELD_LABELS[name] ?? name);

    this.snack.open(
      faltantes.length
        ? `Faltan campos obligatorios: ${faltantes.join(', ')}`
        : 'Revisá los campos marcados antes de continuar',
      'Cerrar',
      {
        duration: 5000,
        panelClass: 'snack-error',
      },
    );
  }
}
