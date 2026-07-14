import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

const FIELD_LABELS: Record<string, string> = {
  numeroCertificado: 'Número de certificado',
  descripcion: 'Descripción',
  montoBruto: 'Monto bruto',
};

@Component({
  selector: 'app-step-certificacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './step-certificacion.component.html',
  styleUrl: './step-certificacion.component.scss',
})
export class StepCertificacionComponent {
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  @Input() obraId!: number | null;

  form = this.fb.group({
    numeroCertificado: ['', Validators.required],
    descripcion: ['', Validators.required],
    montoBruto: [null, Validators.required],
    deduccionAnticipo: [null],
    deduccionFondoReparo: [null],
    montoNeto: [null],
    expediente: [''],
    ubicacionExpediente: [''],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mostrarFormularioInvalido();
      return;
    }

    const payload = {
      obraId: this.obraId,
      ...this.form.getRawValue(),
    };

    console.log('PAYLOAD CERTIFICACIÓN', payload);
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
