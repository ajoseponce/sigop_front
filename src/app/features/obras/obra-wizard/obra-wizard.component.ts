import { Component, inject } from '@angular/core';
import { StepDatosBasicosComponent } from '../steps/step-datos-basicos/step-datos-basicos.component';
import { StepContratoComponent } from '../steps/step-contrato/step-contrato.component';
import { StepEjecucionComponent } from '../steps/step-ejecucion/step-ejecucion.component';
import { StepCertificacionComponent } from '../steps/step-certificacion/step-certificacion.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from 'src/app/core/services/api.service';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-obra-wizard',
  standalone: true,
  imports: [StepDatosBasicosComponent, StepContratoComponent, StepEjecucionComponent, StepCertificacionComponent],
  templateUrl: './obra-wizard.component.html',
  styleUrl: './obra-wizard.component.scss',
})
export class ObraWizardComponent {

  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);

  currentStep = 1;
  obraId: number | null = null;
  obra: any = null;

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.obraId = Number(id);
      this.cargarObra(this.obraId);
    }
  }
  
  saveAdjudicacion(payload: any): void {
    if (!this.obraId) {
      this.snack.open('Primero tenés que guardar los datos básicos de la obra', 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    const contratoId = this.obra?.contratos?.find((c: any) => c.tipo === 'ORIGINAL')?.id ??
      this.obra?.contratos?.[0]?.id;

    const request$ = contratoId
      ? this.api.put<any>(`obras/${this.obraId}/contrato/${contratoId}`, payload)
      : this.api.post<any>(`obras/${this.obraId}/contrato`, payload);

    request$.subscribe({
      next: () => {
        this.currentStep = 3;

        this.snack.open('Adjudicación guardada correctamente', 'Cerrar', {
          duration: 3000,
        });

        this.cargarObra(this.obraId!);
      },
      error: (error) => {
        console.error('Error al guardar adjudicación', error);

        this.snack.open(
          error?.error?.message || 'Error al guardar adjudicación',
          'Cerrar',
          { duration: 3000 }
        );
      },
    });
  }
  cargarObra(id: number): void {
    this.api.get<any>(`obras/${id}`).subscribe({
      next: (obra) => {
        console.log('OBRA PARA EDITAR', obra);

        this.obra = obra;
        this.obraId = obra.id;
      },
      error: (error) => {
        console.error('Error al cargar obra', error);
        this.snack.open('Error al cargar la obra', 'Cerrar', {
          duration: 3000,
        });
      },
    });
  }

  goToStep(step: number): void {
    this.currentStep = step;
  }

  saveObra(payload: any): void {
    const request$ = this.obraId
      ? this.api.put<any>(`obras/${this.obraId}`, payload)
      : this.api.post<any>('obras', payload);

    request$.subscribe({
      next: (obra) => {
        this.obraId = obra.id;
        this.obra = obra;
        this.currentStep = 2;

        this.snack.open('Obra guardada correctamente', 'Cerrar', {
          duration: 3000,
        });
      },
      error: (error) => {
        console.error('Error al guardar obra', error);

        this.snack.open('Error al guardar la obra', 'Cerrar', {
          duration: 3000,
        });
      },
    });
  }

  createAdjudicacion(payload: any): void {
    console.log('crear adjudicación', payload);

    this.api.post<any>('adjudicaciones', payload).subscribe({
      next: (adjudicacion) => {
        console.log('Adjudicación creada', adjudicacion);

        this.currentStep = 3;

        this.snack.open('Adjudicación guardada correctamente', 'Cerrar', {
          duration: 3000,
        });
      },
      error: (error) => {
        console.error('Error al guardar adjudicación', error);

        this.snack.open(
          error?.error?.message || 'Error al guardar adjudicación',
          'Cerrar',
          { duration: 3000 }
        );
      },
    });
  }

}