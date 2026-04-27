import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-step-ejecucion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-ejecucion.component.html',
  styleUrl: './step-ejecucion.component.scss',
})
export class StepEjecucionComponent {
  private fb = inject(FormBuilder);

  @Input() obraId!: number | null;

  form = this.fb.group({
    inspectorNombre: ['', Validators.required],
    inspectorDni: ['', Validators.required],
    inspectorMatricula: ['', Validators.required],

    fechaReplanteo: ['', Validators.required],
    observaciones: [''],
  });

  save(): void {
    if (!this.obraId) {
      console.error('No existe obraId');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      obraId: this.obraId,
      ...this.form.getRawValue(),
    };

    console.log('PAYLOAD EJECUCIÓN', payload);
  }
}