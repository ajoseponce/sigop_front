import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-step-certificacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-certificacion.component.html',
  styleUrl: './step-certificacion.component.scss',
})
export class StepCertificacionComponent {
  private fb = inject(FormBuilder);

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
    const payload = {
      obraId: this.obraId,
      ...this.form.getRawValue(),
    };

    console.log('PAYLOAD CERTIFICACIÓN', payload);
  }
}