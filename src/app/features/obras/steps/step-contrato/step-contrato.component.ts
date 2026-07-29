import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

const FIELD_LABELS: Record<string, string> = {
  fechaApertura: 'Fecha de apertura',
  numeroLicitacion: 'N° de licitación / concurso',
  empresaId: 'Empresa',
  responsableLegalId: 'Responsable legal',
  responsableTecnicoId: 'Responsable técnico',
  presupuestoAdjudicado: 'Presupuesto adjudicado',
  plazoObraDias: 'Plazo de obra en días',
  fechaContrato: 'Fecha de contrato',
};

@Component({
  selector: 'app-step-contrato',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatAutocompleteModule, MatInputModule, MatFormFieldModule, MatSnackBarModule],
  templateUrl: './step-contrato.component.html',
  styleUrl: './step-contrato.component.scss',
})
export class StepContratoComponent implements OnInit , OnChanges{
  private fb = inject(FormBuilder);
  empresas = signal<any[]>([]);
  personas = signal<any[]>([]);
  cargando = signal(false);
  @Input() obra: any = null;
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
    this.cargarEmpresas();
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
  cargarEmpresas(): void {
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
        this.actualizarNombresResponsables();

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['obra'] && this.obra) {
      const contrato =
        this.obra.contratos?.find((c: any) => c.tipo === 'ORIGINAL') ??
        this.obra.contratos?.[0];

      if (!contrato) {
        return;
      }

      this.form.patchValue({
        fechaApertura: this.toDateInput(contrato.vigenciaDesde),
        numeroLicitacion: contrato.numeroContrato,
        empresaId: this.obra.empresa?.id ?? null,
        responsableLegalId: contrato.responsableLegalId ?? null,
        responsableTecnicoId: contrato.responsableTecnicoId ?? null,
        presupuestoAdjudicado: contrato.montoDelta,
        plazoObraDias: contrato.plazoObraDias ?? null,
        ofertaItemizada: contrato.ofertaItemizada ?? '',
        planTrabajo: contrato.planTrabajo ?? '',
        estructuraPonderacion: contrato.estructuraPonderacion ?? '',
        fechaContrato: this.toDateInput(contrato.fechaFirma),
        decretoAdjudicacion: contrato.decretoAdjudicacion ?? contrato.descripcion ?? '',
        decretoContrato: contrato.decretoContrato ?? '',
      });

      this.empresaSearch.setValue(
        this.obra.empresa?.razonSocial ?? this.obra.empresa?.nombreFantasia ?? '',
        { emitEvent: false }
      );
      this.actualizarNombresResponsables();
    }
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

  get mesBase(): string {
    const fechaApertura = this.form.get('fechaApertura')?.value;
    if (!fechaApertura) {
      return '';
    }
    const fecha = new Date(fechaApertura);
    fecha.setMonth(fecha.getMonth() - 1);
    return fecha.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
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
    ofertaItemizada: [''],
    planTrabajo: [''],
    estructuraPonderacion: [''],

    fechaContrato: ['', Validators.required],

    decretoAdjudicacion: [''],
    decretoContrato: [''],
  });

  save(): void {
    if (!this.obraId) {
      console.error('No existe obraId');
      this.snack.open('Primero tenés que guardar los datos básicos de la obra', 'Cerrar', {
        duration: 4000,
        panelClass: 'snack-error',
      });
      return;
    }

    if (this.form.invalid) {
      console.error('Revisar los datos del formulario');
      this.form.markAllAsTouched();
      this.mostrarFormularioInvalido();
      return;
    }

    const raw = this.form.getRawValue();
    const porcentajeAnticipo = this.obra?.porcentajeAnticipo ?? 0;
    const presupuestoOficial = Number(this.obra?.presupuestoOficial ?? 0);
    const presupuestoAdjudicado = Number(raw.presupuestoAdjudicado ?? 0);

    if (presupuestoOficial > 0 && presupuestoAdjudicado > presupuestoOficial * 1.2) {
      this.snack.open('El presupuesto adjudicado no debe superar el 120% del presupuesto oficial', 'Cerrar', {
        duration: 4000,
        panelClass: 'snack-error',
      });
      return;
    }

    const payload = {
      empresaId: raw.empresaId,
      numeroContrato: raw.numeroLicitacion || undefined,
      fechaFirma: raw.fechaContrato,
      vigenciaDesde: raw.fechaApertura,
      montoDelta: raw.presupuestoAdjudicado,
      porcentajeAnticipo,
      porcentajeFondoReparo: 0,
      montoPresupuestoOficial: raw.presupuestoAdjudicado || undefined,
      fechaPresupuesto: raw.fechaContrato || undefined,
      descripcion: raw.decretoAdjudicacion || raw.decretoContrato || undefined,
      responsableLegalId: raw.responsableLegalId,
      responsableTecnicoId: raw.responsableTecnicoId,
      decretoAdjudicacion: raw.decretoAdjudicacion || undefined,
      decretoContrato: raw.decretoContrato || undefined,
      plazoObraDias: raw.plazoObraDias,
      ofertaItemizada: raw.ofertaItemizada || undefined,
      planTrabajo: raw.planTrabajo || undefined,
      estructuraPonderacion: raw.estructuraPonderacion || undefined,
    };

    this.adjudicacionCreated.emit(payload);
  }

  hasError(controlName: string, errorName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.touched && control.hasError(errorName);
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

  private actualizarNombresResponsables(): void {
    const responsableLegalId = this.form.get('responsableLegalId')?.value;
    const responsableTecnicoId = this.form.get('responsableTecnicoId')?.value;
    const responsableLegal = this.personas().find((persona) => persona.id === responsableLegalId);
    const responsableTecnico = this.personas().find((persona) => persona.id === responsableTecnicoId);

    this.responsableLegalSearch.setValue(
      responsableLegal
        ? `${responsableLegal.apellido ?? ''} ${responsableLegal.nombre ?? ''}`.trim()
        : '',
      { emitEvent: false },
    );
    this.responsableTecnicoSearch.setValue(
      responsableTecnico
        ? `${responsableTecnico.apellido ?? ''} ${responsableTecnico.nombre ?? ''}`.trim()
        : '',
      { emitEvent: false },
    );
  }

  private toDateInput(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  }
}
