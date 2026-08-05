import { CommonModule, registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { ApiService } from 'src/app/core/services/api.service';
import { descargarCertificadoPdf, descargarFojaPdf, MedicionPdfData } from './certificado-pdf.util';

registerLocaleData(localeEsAr);

interface ItemObra {
  id: number;
  itemRef: string;
  nombre: string;
  unidad: string;
  cantidad: string;
  precioUnitario: string;
}

interface RubroObra {
  id: number;
  rubroRef: string;
  nombre: string;
  orden: number;
  items: ItemObra[];
}

interface ContratoObra {
  tipo: string;
  montoDelta?: string;
  rubros: RubroObra[];
}

interface ObraCertificacion {
  nombre?: string;
  expediente?: string;
  anioEmision?: number;
  estado?: string;
  empresa?: { razonSocial?: string } | null;
  contratos?: ContratoObra[];
}

interface Certificado {
  id: number;
  numero: number;
  tipo: 'ANTICIPO_FINANCIERO' | 'OBRA';
  periodo: string | null;
  fojaId: number | null;
  estado: 'BORRADOR' | 'APROBADO' | 'ANULADO';
  porcentajeAnticipoSnapshot: string;
  montoBruto: string | null;
  deduccionAnticipo: string | null;
  deduccionFondoReparo: string | null;
  montoFinal: string | null;
  detalles: Array<{
    itemId: number;
    cantidadContratadaSnapshot: string;
    cantidadPeriodo: string;
    cantidadAcumulada: string;
    montoPeriodo: string;
  }>;
}

interface Foja {
  id: number;
  numeroFoja: number;
  periodo: string;
  fechaMedicion: string;
  estado: string;
  certificadoId: number | null;
}

@Component({
  selector: 'app-step-certificacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './step-certificacion.component.html',
  styleUrl: './step-certificacion.component.scss',
})
export class StepCertificacionComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  @Input() obraId: number | null = null;
  @Input() obra: ObraCertificacion | null = null;

  readonly form = this.fb.group({
    periodo: ['', Validators.required],
    fechaMedicion: ['', Validators.required],
    descripcion: [''],
    items: this.fb.array([]),
  });

  rubros: RubroObra[] = [];
  certificados: Certificado[] = [];
  fojas: Foja[] = [];
  cargando = false;
  guardando = false;
  preparandoSiguiente = false;
  editandoCertificado: Certificado | null = null;

  get proximoNumeroFoja(): number {
    return this.fojas.reduce((maximo, foja) => Math.max(maximo, foja.numeroFoja), 0) + 1;
  }

  get numeroFojaActual(): string {
    if (this.editandoCertificado) {
      const foja = this.fojas.find((item) => item.id === this.editandoCertificado?.fojaId);
      return String(foja?.numeroFoja ?? this.editandoCertificado.numero).padStart(2, '0');
    }
    return String(this.proximoNumeroFoja).padStart(2, '0');
  }

  puedeEditar(certificado: Certificado): boolean {
    const numeros = this.certificados
      .filter((item) => item.tipo === 'OBRA' && item.estado !== 'ANULADO')
      .map((item) => item.numero);
    return certificado.numero === Math.max(...numeros);
  }

  get items(): FormArray {
    return this.form.controls.items;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['obraId'] || changes['obra']) && this.obraId && this.obra) {
      this.inicializarFechaActual();
      this.cargarDatos();
    }
  }

  anterior(itemId: number): number {
    return this.certificados
      .filter((cert) =>
        cert.tipo === 'OBRA'
        && cert.estado === 'APROBADO'
        && cert.id !== this.editandoCertificado?.id,
      )
      .flatMap((cert) => cert.detalles)
      .filter((detalle) => detalle.itemId === itemId)
      .reduce((total, detalle) => total + this.numero(detalle.cantidadPeriodo), 0);
  }

  actual(index: number): number {
    return this.numero(this.items.at(index)?.value);
  }

  acumulado(itemId: number, index: number): number {
    return this.anterior(itemId) + this.actual(index);
  }

  montoActual(item: ItemObra, index: number): number {
    return this.actual(index) * this.numero(item.precioUnitario);
  }

  indiceItem(itemId: number): number {
    return this.itemsContrato().findIndex((item) => item.id === itemId);
  }

  guardarYGenerar(): void {
    if (!this.obraId || this.form.invalid || this.rubros.length === 0) {
      this.form.markAllAsTouched();
      this.snack.open('Completá el período, la fecha y las cantidades actuales', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    const items = this.itemsContrato();
    const excedido = items.find((item, index) =>
      this.acumulado(item.id, index) > this.numero(item.cantidad),
    );
    if (excedido) {
      this.snack.open(`El ítem ${excedido.itemRef} supera la cantidad contratada`, 'Cerrar', {
        duration: 4500,
      });
      return;
    }

    const periodo = `${this.form.controls.periodo.value}-01`;
    const payload = {
      periodo,
      fechaMedicion: this.form.controls.fechaMedicion.value,
      descripcion: this.form.controls.descripcion.value || undefined,
      detalles: items.map((item, index) => ({
        itemId: item.id,
        cantidadMedida: String(this.actual(index)),
      })),
    };

    this.guardando = true;
    const operacion$ = this.editandoCertificado
      ? this.api.put<Certificado>(
        `obras/${this.obraId}/certificados/${this.editandoCertificado.id}/medicion`,
        { detalles: payload.detalles },
      )
      : this.asegurarAnticipo().pipe(
      switchMap(() => this.api.post<Foja>(`obras/${this.obraId}/fojas`, payload)),
      switchMap((foja) =>
        this.api.post<Foja>(`obras/${this.obraId}/fojas/${foja.id}/aprobar`, {}),
      ),
      switchMap((foja) =>
        this.api.post<Certificado>(`obras/${this.obraId}/certificados`, {
          periodo,
          fojaId: foja.id,
        }),
      ),
      switchMap((certificado) =>
        this.api.post<Certificado>(
          `obras/${this.obraId}/certificados/${certificado.id}/aprobar`,
          {},
        ),
      ),
      );
    operacion$.subscribe({
      next: (certificado) => {
        this.guardando = false;
        this.snack.open(
          this.editandoCertificado
            ? `Foja N° ${certificado.numero} actualizada correctamente`
            : `Foja y certificado N° ${certificado.numero} generados correctamente`,
          'Cerrar',
          { duration: 4500 },
        );
        this.editandoCertificado = null;
        this.form.patchValue({ descripcion: '' });
        this.items.controls.forEach((control) => control.setValue(0));
        this.preparandoSiguiente = true;
        this.cargarDatos();
      },
      error: (error) => {
        this.guardando = false;
        this.snack.open(
          error?.error?.message || 'No se pudo generar la foja y el certificado',
          'Cerrar',
          { duration: 5500 },
        );
      },
    });
  }

  imprimirCertificado(certificado: Certificado): void {
    descargarCertificadoPdf(this.datosPdf(certificado));
  }

  imprimirFoja(certificado: Certificado): void {
    descargarFojaPdf(this.datosPdf(certificado));
  }

  editarFoja(certificado: Certificado): void {
    const foja = this.fojas.find((item) => item.id === certificado.fojaId);
    this.editandoCertificado = certificado;
    this.preparandoSiguiente = false;
    this.form.patchValue({
      periodo: certificado.periodo?.slice(0, 7) ?? '',
      fechaMedicion: foja?.fechaMedicion ?? '',
    });
    const porItem = new Map(certificado.detalles.map((detalle) => [detalle.itemId, detalle.cantidadPeriodo]));
    this.itemsContrato().forEach((item, index) => {
      this.items.at(index)?.setValue(this.numero(porItem.get(item.id)));
    });
  }

  cancelarEdicion(): void {
    this.editandoCertificado = null;
    this.items.controls.forEach((control) => control.setValue(0));
    this.prepararPeriodoSiguiente();
  }

  private datosPdf(certificado: Certificado): MedicionPdfData {
    const foja = this.fojas.find((item) => item.id === certificado.fojaId);
    return {
      numero: certificado.numero,
      numeroFoja: foja?.numeroFoja ?? certificado.numero,
      periodo: certificado.periodo,
      nombreObra: this.obra?.nombre ?? 'Obra',
      expediente: this.obra?.expediente,
      anioEmision: this.obra?.anioEmision,
      empresa: this.obra?.empresa?.razonSocial,
      porcentajeAnticipo: certificado.porcentajeAnticipoSnapshot,
      montoBruto: certificado.montoBruto,
      deduccionAnticipo: certificado.deduccionAnticipo,
      deduccionFondoReparo: certificado.deduccionFondoReparo,
      montoFinal: certificado.montoFinal,
      rubros: this.rubros,
      detalles: certificado.detalles,
    };
  }

  crearSiguienteFoja(): void {
    this.prepararPeriodoSiguiente();
    this.items.controls.forEach((control) => control.setValue(0));
    this.preparandoSiguiente = false;
  }

  private cargarDatos(): void {
    if (!this.obraId) return;
    this.cargando = true;
    forkJoin({
      certificados: this.api.get<Certificado[]>(`obras/${this.obraId}/certificados`),
      fojas: this.api.get<Foja[]>(`obras/${this.obraId}/fojas`),
    }).subscribe({
      next: ({ certificados, fojas }) => {
        this.certificados = certificados;
        this.fojas = fojas;
        this.rubros = this.contratoVigente()?.rubros ?? [];
        this.recrearControles();
        if (!this.preparandoSiguiente && this.fojas.some(
          (foja) => foja.estado !== 'RECHAZADA' && foja.periodo.slice(0, 7) === this.form.controls.periodo.value,
        )) {
          this.prepararPeriodoSiguiente();
        }
        this.cargando = false;
      },
      error: (error) => {
        this.cargando = false;
        this.snack.open(error?.error?.message || 'No se pudo cargar la certificación', 'Cerrar', {
          duration: 4500,
        });
      },
    });
  }

  private asegurarAnticipo(): Observable<Certificado | null> {
    const anticipo = this.certificados.find(
      (cert) => cert.tipo === 'ANTICIPO_FINANCIERO' && cert.estado !== 'ANULADO',
    );
    return anticipo
      ? of(anticipo)
      : this.api.post<Certificado>(`obras/${this.obraId}/certificados/anticipo`, {});
  }

  private recrearControles(): void {
    this.items.clear();
    this.itemsContrato().forEach(() =>
      this.items.push(this.fb.control(0, [Validators.required, Validators.min(0)])),
    );
  }

  private inicializarFechaActual(): void {
    const hoy = new Date();
    const fecha = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0'),
    ].join('-');

    this.form.patchValue({
      periodo: fecha.slice(0, 7),
      fechaMedicion: fecha,
      descripcion: '',
    });
  }

  private prepararPeriodoSiguiente(): void {
    const ultima = this.fojas
      .filter((foja) => foja.estado !== 'RECHAZADA')
      .slice()
      .sort((a, b) => b.periodo.localeCompare(a.periodo))[0];
    const base = ultima ? new Date(`${ultima.periodo.slice(0, 7)}-01T12:00:00`) : new Date();

    if (ultima) {
      base.setMonth(base.getMonth() + 1);
    }

    const periodo = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
    const fechaMedicion = `${periodo}-${String(
      new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate(),
    ).padStart(2, '0')}`;

    this.form.patchValue({ periodo, fechaMedicion, descripcion: '' });
  }

  private contratoVigente(): ContratoObra | undefined {
    return this.obra?.contratos?.find((contrato) => contrato.tipo === 'ORIGINAL')
      ?? this.obra?.contratos?.[0];
  }

  private itemsContrato(): ItemObra[] {
    return this.rubros
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .flatMap((rubro) => rubro.items);
  }

  numero(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
