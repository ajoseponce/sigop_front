import { CommonModule, registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { ApiService } from 'src/app/core/services/api.service';
import {
  crearCertificadoPdf,
  crearFojaPdf,
  crearReadecuacionPdf,
  descargarCertificadoPdf,
  descargarFojaPdf,
  descargarReadecuacionPdf,
  MedicionPdfData,
  ReadecuacionPdfData,
} from './certificado-pdf.util';

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
  numeroContrato?: string;
  vigenciaDesde?: string;
  plazoObraDias?: number;
  decretoAdjudicacion?: string;
  decretoContrato?: string;
  rubros: RubroObra[];
}

interface ObraCertificacion {
  nombre?: string;
  expediente?: string;
  anioEmision?: number;
  estado?: string;
  seccion?: string;
  parcela?: string;
  calles?: string;
  inspectorNombre?: string;
  localidad?: string;
  fechaInicio?: string;
  empresa?: { razonSocial?: string; cuit?: string } | null;
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
  readecuacion: ReadecuacionGuardada | null;
  detalles: Array<{
    itemId: number;
    cantidadContratadaSnapshot: string;
    cantidadPeriodo: string;
    cantidadAcumulada: string;
    montoPeriodo: string;
  }>;
}

interface ReadecuacionGuardada {
  estado: 'BORRADOR' | 'APROBADO';
  estructura: { id: number; nombre: string };
  saltos: Array<{ orden: number; mesBase: string; mesCorte: string; fap: string; automatico: boolean }>;
  fapConsolidado: string;
  montoBase: string;
  deduccionAnticipo: string;
  montoNetoActualizar: string;
  montoNetoActualizado: string;
  incremento: string;
  porcentajeFondoReparo: string;
  deduccionFondoReparo: string;
  incrementoNetoPagar: string;
}

interface SaltoReadecuacion {
  orden: number;
  mesBase: string;
  mesCorte: string;
  fapCalculado: string | null;
  faltantes: string[];
  seleccionado: boolean;
  fap: string;
}

interface OpcionesReadecuacion {
  certificado: { id: number; numero: number; periodo: string; montoBase: string; deduccionAnticipo: string; montoNetoActualizar: string; porcentajeFondoReparo: string };
  estructuraId: number;
  estructuraNombre: string;
  estructuras: Array<{ id: number; nombre: string }>;
  saltos: Array<Omit<SaltoReadecuacion, 'seleccionado' | 'fap'>>;
  guardada: ReadecuacionGuardada | null;
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './step-certificacion.component.html',
  styleUrl: './step-certificacion.component.scss',
})
export class StepCertificacionComponent implements OnChanges, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);

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
  vistaPreviaUrl: SafeResourceUrl | null = null;
  vistaPreviaTitulo = '';
  generandoVistaPrevia = false;
  cambiandoValidacionId: number | null = null;
  readecuacionCertificado: Certificado | null = null;
  opcionesReadecuacion: OpcionesReadecuacion | null = null;
  saltosReadecuacion: SaltoReadecuacion[] = [];
  cargandoReadecuacion = false;
  guardandoReadecuacion = false;
  private vistaPreviaObjectUrl: string | null = null;

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
    if (!this.estaValidado(certificado)) {
      this.mostrarDescargaBloqueada();
      return;
    }
    descargarCertificadoPdf(this.datosPdf(certificado));
  }

  imprimirFoja(certificado: Certificado): void {
    if (!this.estaValidado(certificado)) {
      this.mostrarDescargaBloqueada();
      return;
    }
    descargarFojaPdf(this.datosPdf(certificado));
  }

  estaValidado(certificado: Certificado): boolean {
    return certificado.estado === 'APROBADO';
  }

  validarCertificado(certificado: Certificado): void {
    if (!this.obraId || this.cambiandoValidacionId !== null) return;
    this.cambiandoValidacionId = certificado.id;
    this.api.post<Certificado>(
      `obras/${this.obraId}/certificados/${certificado.id}/aprobar`,
      {},
    ).subscribe({
      next: () => {
        this.cambiandoValidacionId = null;
        this.snack.open(`Certificado N° ${certificado.numero} validado`, 'Cerrar', { duration: 3500 });
        this.cargarDatos();
      },
      error: (error) => {
        this.cambiandoValidacionId = null;
        this.snack.open(error?.error?.message || 'No se pudo validar el certificado', 'Cerrar', { duration: 4500 });
      },
    });
  }

  desvalidarCertificado(certificado: Certificado): void {
    if (!this.obraId || this.cambiandoValidacionId !== null) return;
    if (!confirm(`¿Desvalidar el certificado N° ${certificado.numero}? Se bloquearán sus descargas.`)) return;
    this.cambiandoValidacionId = certificado.id;
    this.api.post<Certificado>(
      `obras/${this.obraId}/certificados/${certificado.id}/desaprobar`,
      {},
    ).subscribe({
      next: () => {
        this.cambiandoValidacionId = null;
        this.snack.open(`Certificado N° ${certificado.numero} desvalidado`, 'Cerrar', { duration: 3500 });
        this.cargarDatos();
      },
      error: (error) => {
        this.cambiandoValidacionId = null;
        this.snack.open(error?.error?.message || 'No se pudo desvalidar el certificado', 'Cerrar', { duration: 4500 });
      },
    });
  }

  abrirReadecuacion(certificado: Certificado): void {
    if (!this.obraId) return;
    this.readecuacionCertificado = certificado;
    this.opcionesReadecuacion = null;
    this.saltosReadecuacion = [];
    this.cargandoReadecuacion = true;
    this.api.get<OpcionesReadecuacion>(`obras/${this.obraId}/certificados/${certificado.id}/readecuacion/opciones`).subscribe({
      next: (opciones) => {
        const guardados = new Map((opciones.guardada?.saltos ?? []).map((salto) => [salto.orden, salto]));
        this.opcionesReadecuacion = opciones;
        this.saltosReadecuacion = opciones.saltos.map((salto) => ({
          ...salto,
          seleccionado: guardados.has(salto.orden),
          fap: guardados.get(salto.orden)?.fap ?? salto.fapCalculado ?? '',
        }));
        this.cargandoReadecuacion = false;
      },
      error: (error) => {
        this.cargandoReadecuacion = false;
        this.cerrarReadecuacion();
        this.snack.open(error?.error?.message || 'No se pudieron cargar los ajustes FAP', 'Cerrar', { duration: 5000 });
      },
    });
  }

  cerrarReadecuacion(): void {
    if (this.guardandoReadecuacion) return;
    this.readecuacionCertificado = null;
    this.opcionesReadecuacion = null;
    this.saltosReadecuacion = [];
  }

  guardarReadecuacionPrecio(): void {
    if (!this.obraId || !this.readecuacionCertificado || !this.opcionesReadecuacion) return;
    const seleccionados = this.saltosReadecuacion.filter((salto) => salto.seleccionado);
    if (seleccionados.length === 0) {
      this.snack.open('Seleccioná al menos un ajuste mensual', 'Cerrar', { duration: 3500 });
      return;
    }
    const meses = seleccionados.map((salto) => salto.mesCorte);
    if (new Set(meses).size !== meses.length) {
      this.snack.open('No podés seleccionar dos veces el mismo mes', 'Cerrar', { duration: 3500 });
      return;
    }
    const invalido = seleccionados.find((salto) => !salto.fap || this.numero(salto.fap) <= 0);
    if (invalido) {
      this.snack.open(`Ingresá el FAP del ajuste ${invalido.orden}`, 'Cerrar', { duration: 3500 });
      return;
    }
    this.guardandoReadecuacion = true;
    this.api.put<ReadecuacionGuardada>(
      `obras/${this.obraId}/certificados/${this.readecuacionCertificado.id}/readecuacion`,
      {
        estructuraId: this.opcionesReadecuacion.estructuraId,
        saltos: seleccionados.map((salto) => ({
          orden: salto.orden,
          mesBase: salto.mesBase,
          mesCorte: salto.mesCorte,
          fap: salto.fap === salto.fapCalculado ? undefined : salto.fap,
        })),
      },
    ).subscribe({
      next: () => {
        const numeroCertificado = this.readecuacionCertificado?.numero;
        this.guardandoReadecuacion = false;
        this.cerrarReadecuacion();
        this.snack.open(`Readecuación del certificado N° ${numeroCertificado} guardada`, 'Cerrar', { duration: 4000 });
        this.cargarDatos();
      },
      error: (error) => {
        this.guardandoReadecuacion = false;
        this.snack.open(error?.error?.message || 'No se pudo guardar la readecuación', 'Cerrar', { duration: 5000 });
      },
    });
  }

  cambiarMesReadecuacion(salto: SaltoReadecuacion, mesCorte: string): void {
    const opcion = this.opcionesReadecuacion?.saltos.find((item) => item.mesCorte === mesCorte);
    if (!opcion) return;
    salto.mesBase = opcion.mesBase;
    salto.mesCorte = opcion.mesCorte;
    salto.fapCalculado = opcion.fapCalculado;
    salto.faltantes = opcion.faltantes;
    salto.fap = opcion.fapCalculado ?? '';
  }

  fapConsolidadoVista(): number {
    const producto = this.saltosReadecuacion
      .filter((salto) => salto.seleccionado)
      .reduce((total, salto) => total * this.numero(salto.fap || 1), 1);
    return Math.round((producto + Number.EPSILON) * 10000) / 10000;
  }

  incrementoVista(): number {
    return this.redondearCentavos(
      this.numero(this.opcionesReadecuacion?.certificado.montoNetoActualizar)
        * (this.fapConsolidadoVista() - 1),
    );
  }

  fondoReparoVista(): number {
    return this.redondearCentavos(
      this.incrementoVista()
        * this.numero(this.opcionesReadecuacion?.certificado.porcentajeFondoReparo) / 100,
    );
  }

  incrementoNetoVista(): number {
    return this.redondearCentavos(this.incrementoVista() - this.fondoReparoVista());
  }

  async abrirVistaPrevia(
    tipo: 'foja' | 'certificado' | 'readecuacion',
    certificado: Certificado,
  ): Promise<void> {
    this.cerrarVistaPrevia();
    this.generandoVistaPrevia = true;
    try {
      const data = this.datosPdf(certificado);
      const doc = tipo === 'foja'
        ? await crearFojaPdf(data)
        : tipo === 'certificado'
          ? await crearCertificadoPdf(data)
          : await crearReadecuacionPdf(this.datosReadecuacionPdf(certificado));
      this.vistaPreviaObjectUrl = URL.createObjectURL(doc.output('blob'));
      this.vistaPreviaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `${this.vistaPreviaObjectUrl}#toolbar=0&navpanes=0&scrollbar=1`,
      );
      this.vistaPreviaTitulo = tipo === 'foja'
        ? `Vista previa - Foja N° ${String(data.numeroFoja).padStart(2, '0')}`
        : tipo === 'certificado'
          ? `Vista previa - Certificado N° ${data.numero}`
          : `Vista previa - Readecuación del certificado N° ${data.numero}`;
    } catch {
      this.snack.open('No se pudo generar la vista previa', 'Cerrar', { duration: 4000 });
    } finally {
      this.generandoVistaPrevia = false;
    }
  }

  validarReadecuacion(certificado: Certificado): void {
    if (!this.obraId || this.cambiandoValidacionId !== null) return;
    this.cambiandoValidacionId = certificado.id;
    this.api.post<ReadecuacionGuardada>(`obras/${this.obraId}/certificados/${certificado.id}/readecuacion/aprobar`, {}).subscribe({
      next: () => {
        this.cambiandoValidacionId = null;
        this.snack.open('Readecuación validada correctamente', 'Cerrar', { duration: 3500 });
        this.cargarDatos();
      },
      error: (error) => {
        this.cambiandoValidacionId = null;
        this.snack.open(error?.error?.message || 'No se pudo validar la readecuación', 'Cerrar', { duration: 4500 });
      },
    });
  }

  desvalidarReadecuacion(certificado: Certificado): void {
    if (!this.obraId || this.cambiandoValidacionId !== null) return;
    this.cambiandoValidacionId = certificado.id;
    this.api.post<ReadecuacionGuardada>(`obras/${this.obraId}/certificados/${certificado.id}/readecuacion/desaprobar`, {}).subscribe({
      next: () => {
        this.cambiandoValidacionId = null;
        this.snack.open('Readecuación desvalidada', 'Cerrar', { duration: 3500 });
        this.cargarDatos();
      },
      error: (error) => {
        this.cambiandoValidacionId = null;
        this.snack.open(error?.error?.message || 'No se pudo desvalidar la readecuación', 'Cerrar', { duration: 4500 });
      },
    });
  }

  imprimirReadecuacion(certificado: Certificado): void {
    if (!certificado.readecuacion || certificado.readecuacion.estado !== 'APROBADO') return;
    descargarReadecuacionPdf(this.datosReadecuacionPdf(certificado));
  }

  cerrarVistaPrevia(): void {
    if (this.vistaPreviaObjectUrl) {
      URL.revokeObjectURL(this.vistaPreviaObjectUrl);
    }
    this.vistaPreviaObjectUrl = null;
    this.vistaPreviaUrl = null;
    this.vistaPreviaTitulo = '';
  }

  ngOnDestroy(): void {
    this.cerrarVistaPrevia();
  }

  private mostrarDescargaBloqueada(): void {
    this.snack.open(
      'La descarga estará disponible cuando la foja y el certificado estén validados',
      'Cerrar',
      { duration: 4500 },
    );
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
    const contrato = this.obra?.contratos?.find((item) => item.tipo === 'ORIGINAL')
      ?? this.obra?.contratos?.[0];
    return {
      numero: certificado.numero,
      numeroFoja: foja?.numeroFoja ?? certificado.numero,
      periodo: certificado.periodo,
      fechaMedicion: foja?.fechaMedicion,
      nombreObra: this.obra?.nombre ?? 'Obra',
      expediente: this.obra?.expediente,
      anioEmision: this.obra?.anioEmision,
      empresa: this.obra?.empresa?.razonSocial,
      empresaCuit: this.obra?.empresa?.cuit,
      numeroContrato: contrato?.numeroContrato,
      aprobacion: contrato?.decretoContrato ?? contrato?.decretoAdjudicacion,
      localidad: this.obra?.localidad,
      fechaInicio: this.obra?.fechaInicio ?? contrato?.vigenciaDesde,
      plazoObraDias: contrato?.plazoObraDias,
      ubicacion: [
        this.obra?.seccion ? `Sección ${this.obra.seccion}` : '',
        this.obra?.parcela ? `Parcela ${this.obra.parcela}` : '',
        this.obra?.calles ? `Calles ${this.obra.calles}` : '',
      ].filter(Boolean).join(' - '),
      responsableInstitucional: this.obra?.inspectorNombre,
      porcentajeAnticipo: certificado.porcentajeAnticipoSnapshot,
      montoBruto: certificado.montoBruto,
      deduccionAnticipo: certificado.deduccionAnticipo,
      deduccionFondoReparo: certificado.deduccionFondoReparo,
      montoFinal: certificado.montoFinal,
      rubros: this.rubros,
      detalles: certificado.detalles,
    };
  }

  private datosReadecuacionPdf(certificado: Certificado): ReadecuacionPdfData {
    if (!certificado.readecuacion) throw new Error('El certificado no tiene readecuación');
    return { ...this.datosPdf(certificado), readecuacion: certificado.readecuacion };
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

  private redondearCentavos(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
