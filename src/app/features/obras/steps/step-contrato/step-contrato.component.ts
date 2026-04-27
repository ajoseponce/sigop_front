import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { OnInit, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ApiService } from 'src/app/core/services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-step-contrato',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatAutocompleteModule, MatInputModule, MatFormFieldModule],
  templateUrl: './step-contrato.component.html',
  styleUrl: './step-contrato.component.scss',
})
export class StepContratoComponent implements OnInit {
  private fb = inject(FormBuilder);
  empresas = signal<any[]>([]);
  personas = signal<any[]>([]);
  cargando = signal(false);



  personasFiltradasLegal: any[] = [];
  personasFiltradasTecnico: any[] = [];

  responsableLegalSearch = new FormControl('');
  responsableTecnicoSearch = new FormControl('');

  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  empresaSearch = new FormControl('');
  empresasFiltradas: any[] = [];
  @Input() obraId!: number | null;
  @Output() adjudicacionCreated = new EventEmitter<any>();

  ngOnInit(): void {
    this.emmpresas();
    this.cargarPersonas();

    this.responsableLegalSearch.valueChanges.subscribe(() => {
      this.filtrarPersonasLegal();
    });

    this.responsableTecnicoSearch.valueChanges.subscribe(() => {
      this.filtrarPersonasTecnico();
    });
    this.empresaSearch.valueChanges.subscribe(() => {
      this.filtrarEmpresas();
    });
  }
  emmpresas(): void {
    this.cargando.set(true);

    this.api.get<any>('empresas').subscribe({
      next: (resp) => {
        const data = resp?.data ?? resp ?? [];

        this.empresas.set(data);
        this.empresasFiltradas = data;

        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar empresas:', err);
        this.cargando.set(false);

        this.snack.open('Error al cargar empresas', 'Cerrar', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }
  cargarPersonas(): void {
    this.cargando.set(true);

    this.api.get<any>('personas').subscribe({
      next: (resp) => {
        const data = resp?.data ?? resp ?? [];

        this.personas.set(data);
        this.personasFiltradasLegal = data;
        this.personasFiltradasTecnico = data;

        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar personas:', err);
        this.cargando.set(false);

        this.snack.open('Error al cargar personas', 'Cerrar', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }



  filtrarEmpresas(): void {
    const value = this.empresaSearch.value?.toLowerCase() ?? '';

    this.empresasFiltradas = this.empresas().filter((empresa) =>
      (empresa.razonSocial ?? empresa.nombreFantasia ?? '')
        .toLowerCase()
        .includes(value)
    );
  }

  filtrarPersonasLegal(): void {
    const value = this.responsableLegalSearch.value?.toLowerCase() ?? '';

    this.personasFiltradasLegal = this.personas().filter((persona) =>
      `${persona.apellido ?? ''} ${persona.nombre ?? ''} ${persona.dni ?? ''}`
        .toLowerCase()
        .includes(value)
    );
  }

  filtrarPersonasTecnico(): void {
    const value = this.responsableTecnicoSearch.value?.toLowerCase() ?? '';

    this.personasFiltradasTecnico = this.personas().filter((persona) =>
      `${persona.apellido ?? ''} ${persona.nombre ?? ''} ${persona.dni ?? ''}`
        .toLowerCase()
        .includes(value)
    );
  }

  seleccionarResponsableLegal(persona: any): void {
    this.form.patchValue({
      responsableLegalId: persona.id,
    });

    this.responsableLegalSearch.setValue(
      `${persona.apellido ?? ''} ${persona.nombre ?? ''}`.trim()
    );
  }

  seleccionarResponsableTecnico(persona: any): void {
    this.form.patchValue({
      responsableTecnicoId: persona.id,
    });

    this.responsableTecnicoSearch.setValue(
      `${persona.apellido ?? ''} ${persona.nombre ?? ''}`.trim()
    );
  }

  seleccionarEmpresa(empresa: any): void {
    this.form.patchValue({
      empresaId: empresa.id,
    });

    this.empresaSearch.setValue(
      empresa.razonSocial ?? empresa.nombreFantasia ?? ''
    );
  }

  form = this.fb.group({
    fechaApertura: ['', Validators.required],
    numeroLicitacion: ['', Validators.required],

    empresaId: [null, Validators.required],

    responsableLegalId: [null, Validators.required],
    responsableTecnicoId: [null, Validators.required],

    presupuestoAdjudicado: [null, Validators.required],
    plazoObraDias: [null, Validators.required],

    fechaContrato: ['', Validators.required],

    decretoAdjudicacion: [''],
    decretoContrato: [''],
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

    const raw = this.form.getRawValue();

    const payload = {
      obraId: this.obraId,
      fechaApertura: raw.fechaApertura,
      numeroLicitacion: raw.numeroLicitacion,
      empresaId: raw.empresaId,

      responsableLegalId: raw.responsableLegalId,
      responsableTecnicoId: raw.responsableTecnicoId,

      presupuestoAdjudicado: raw.presupuestoAdjudicado,
      plazoObraDias: raw.plazoObraDias,
      fechaContrato: raw.fechaContrato,

      decretoAdjudicacion: raw.decretoAdjudicacion || null,
      decretoContrato: raw.decretoContrato || null,
    };

    console.log('PAYLOAD ADJUDICACIÓN', payload);
    this.adjudicacionCreated.emit(payload);
  }

  hasError(controlName: string, errorName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.touched && control.hasError(errorName);
  }
}