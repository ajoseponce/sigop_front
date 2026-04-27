import { Component } from '@angular/core';
import { StepDatosBasicosComponent } from '../steps/step-datos-basicos/step-datos-basicos.component';
import { StepContratoComponent } from '../steps/step-contrato/step-contrato.component';
import { StepEjecucionComponent } from '../steps/step-ejecucion/step-ejecucion.component';
import { StepCertificacionComponent } from '../steps/step-certificacion/step-certificacion.component';

@Component({
  selector: 'app-obra-wizard',
  standalone: true,
  imports: [StepDatosBasicosComponent, StepContratoComponent, StepEjecucionComponent, StepCertificacionComponent],
  templateUrl: './obra-wizard.component.html',
  styleUrl: './obra-wizard.component.scss',
})
export class ObraWizardComponent {
  currentStep = 1;
  obraId: number | null = null;
  
goToStep(step: number): void {
  this.currentStep = step;
}

 
}