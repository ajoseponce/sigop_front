import { jsPDF } from 'jspdf';
import { RowInput, autoTable } from 'jspdf-autotable';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../../shared/pdf/pdf-header.util';
import { redondearMoneda } from '../../../../shared/utils/money.util';

interface PdfItem {
  id: number;
  itemRef: string;
  nombre: string;
  unidad: string;
  cantidad: string;
  precioUnitario: string;
}

interface PdfRubro {
  rubroRef: string;
  nombre: string;
  orden: number;
  items: PdfItem[];
}

interface PdfDetalle {
  itemId: number;
  cantidadContratadaSnapshot: string;
  cantidadPeriodo: string;
  cantidadAcumulada: string;
  montoPeriodo: string;
}

interface CertificadoResumenPdf {
  numero: number;
  tipo: 'ANTICIPO_FINANCIERO' | 'OBRA';
  estado: 'BORRADOR' | 'APROBADO' | 'ANULADO';
  montoBruto: string | null;
  montoPostAnticipo?: string | null;
  deduccionAnticipo: string | null;
  deduccionFondoReparo: string | null;
  montoFinal: string | null;
  readecuacion?: {
    estado: 'BORRADOR' | 'APROBADO';
    incremento: string;
    deduccionFondoReparo: string;
    incrementoNetoPagar: string;
  } | null;
}

export interface MedicionPdfData {
  numero: number;
  numeroFoja: number;
  periodo: string | null;
  fechaMedicion?: string;
  nombreObra: string;
  expediente?: string;
  anioEmision?: number;
  empresa?: string;
  empresaCuit?: string;
  numeroContrato?: string;
  responsableLegal?: string;
  responsableTecnico?: string;
  ubicacion?: string;
  aprobacion?: string;
  localidad?: string;
  fechaInicio?: string;
  plazoObraDias?: number;
  porcentajeAnticipo: string;
  montoBruto: string | null;
  deduccionAnticipo: string | null;
  deduccionFondoReparo: string | null;
  montoFinal: string | null;
  rubros: PdfRubro[];
  detalles: PdfDetalle[];
  certificados?: CertificadoResumenPdf[];
}

export interface ReadecuacionPdfData extends MedicionPdfData {
  readecuacion: {
    saltos: Array<{ orden: number; mesBase: string; mesCorte: string; fap: string }>;
    fapConsolidado: string;
    montoBase: string;
    deduccionAnticipo: string;
    montoNetoActualizar: string;
    montoNetoActualizado: string;
    incremento: string;
    porcentajeFondoReparo: string;
    deduccionFondoReparo: string;
    incrementoNetoPagar: string;
  };
}

export interface AnexoIIIPdfData extends MedicionPdfData {
  certificados: CertificadoResumenPdf[];
}

const quantity = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const money = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sentenceCase(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('es-AR');
  return normalized ? `${normalized[0].toLocaleUpperCase('es-AR')}${normalized.slice(1)}` : normalized;
}

const unidades = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];

function apocopar(value: string): string {
  return value
    .replace(/VEINTIUNO$/, 'VEINTIÚN')
    .replace(/ Y UNO$/, ' Y UN')
    .replace(/UNO$/, 'UN');
}

function menoresAMil(value: number): string {
  if (value < 30) return unidades[value];
  if (value < 100) {
    const decena = Math.floor(value / 10) * 10;
    const resto = value % 10;
    const nombres: Record<number, string> = {
      30: 'TREINTA', 40: 'CUARENTA', 50: 'CINCUENTA', 60: 'SESENTA',
      70: 'SETENTA', 80: 'OCHENTA', 90: 'NOVENTA',
    };
    return resto ? `${nombres[decena]} Y ${unidades[resto]}` : nombres[decena];
  }
  if (value === 100) return 'CIEN';
  const centena = Math.floor(value / 100);
  const resto = value % 100;
  const centenas: Record<number, string> = {
    1: 'CIENTO', 2: 'DOSCIENTOS', 3: 'TRESCIENTOS', 4: 'CUATROCIENTOS',
    5: 'QUINIENTOS', 6: 'SEISCIENTOS', 7: 'SETECIENTOS', 8: 'OCHOCIENTOS',
    9: 'NOVECIENTOS',
  };
  return resto ? `${centenas[centena]} ${menoresAMil(resto)}` : centenas[centena];
}

function enteroEnLetras(value: number): string {
  if (value < 1000) return menoresAMil(value);
  if (value < 1_000_000) {
    const miles = Math.floor(value / 1000);
    const resto = value % 1000;
    const prefijo = miles === 1 ? 'MIL' : `${apocopar(enteroEnLetras(miles))} MIL`;
    return resto ? `${prefijo} ${enteroEnLetras(resto)}` : prefijo;
  }
  if (value < 1_000_000_000) {
    const millones = Math.floor(value / 1_000_000);
    const resto = value % 1_000_000;
    const prefijo = millones === 1
      ? 'UN MILLÓN'
      : `${apocopar(enteroEnLetras(millones))} MILLONES`;
    return resto ? `${prefijo} ${enteroEnLetras(resto)}` : prefijo;
  }
  const milesDeMillones = Math.floor(value / 1_000_000_000);
  const resto = value % 1_000_000_000;
  const prefijo = `${apocopar(enteroEnLetras(milesDeMillones))} MIL MILLONES`;
  return resto ? `${prefijo} ${enteroEnLetras(resto)}` : prefijo;
}

export function montoEnLetras(value: number): string {
  const centavosTotales = Math.round(Math.abs(value) * 100);
  const pesos = Math.floor(centavosTotales / 100);
  const centavos = centavosTotales % 100;
  const signo = value < 0 ? 'MENOS ' : '';
  const moneda = pesos === 1 ? 'PESO' : 'PESOS';
  const textoCentavos = centavos === 1 ? 'CENTAVO' : 'CENTAVOS';
  return sentenceCase(`${signo}${enteroEnLetras(pesos)} ${moneda} CON ${enteroEnLetras(centavos)} ${textoCentavos}`);
}

function periodoTexto(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(value))
    : 'Sin período';
}

function fechaTexto(value?: string): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
}

function encabezadoFoja(doc: jsPDF, data: MedicionPdfData, cabecera: string): number {
  const left = 16;
  const right = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - left - right;
  const splitX = left + 112;
  const finCabecera = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.6);
  const y = finCabecera + 3;

  doc.setDrawColor(30);
  doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);

  doc.rect(left, y, width, 10);
  doc.text(`Foja de medición N° ${data.numeroFoja}`, left + width / 2, y + 6.3, { align: 'center' });

  doc.rect(left, y + 12, width, 9);
  doc.text(`Obra: ${data.nombreObra ? sentenceCase(data.nombreObra) : '—'}`, left + 2, y + 17.7);

  doc.rect(left, y + 23, splitX - left, 55);
  doc.rect(splitX, y + 23, pageWidth - right - splitX, 55);

  const labelX = left + 2;
  const valueX = left + 39;
  const rowsLeft = [
    ['Organismo otorgante', 'Municipalidad de Posadas'],
    ['Expediente madre N°', `${data.expediente ?? '—'}${data.anioEmision ? ` / ${data.anioEmision}` : ''}`],
    ['Programa', 'Municipal'],
    ['Modo de ejecución', data.numeroContrato ? `Concurso de precios ${data.numeroContrato}` : 'Concurso de precios'],
    ['Ubicación', data.ubicacion ? sentenceCase(data.ubicacion) : '—'],
    ['Período', periodoTexto(data.periodo)],
    ['Fecha de Carga', fechaTexto(data.fechaMedicion)],
    ['Responsable legal', data.responsableLegal || '—'],
    ['Responsable técnico', data.responsableTecnico || '—'],
  ];
  rowsLeft.forEach(([label, value], index) => {
    const rowY = y + 29 + index * 5.5;
    doc.text(label, labelX, rowY);
    doc.text(doc.splitTextToSize(value, splitX - valueX - 3)[0] ?? '', valueX, rowY);
  });

  const rightLabelX = splitX + 2;
  const rightValueX = splitX + 29;
  const rowsRight: Array<[string, string]> = [
    ['Certificado', `Certificado N° ${data.numero}`],
    ['Monto contrato', `$ ${money.format(totalContrato(data))}`],
    ['Anticipo financiero', `$ ${money.format(montoAnticipoFinanciero(data))}`],
  ];
  if (tieneReadecuacionAprobada(data)) {
    rowsRight.splice(2, 0, ['Monto actualizado', `$ ${money.format(montoActualizado(data))}`]);
  }
  rowsRight.forEach(([label, value], index) => {
    const rowY = y + 29 + index * 6;
    doc.text(label, rightLabelX, rowY);
    doc.text(value, rightValueX, rowY);
  });
  doc.text('Empresa:', rightLabelX, y + 54);
  doc.text(
    doc.splitTextToSize(
      `${data.empresa ? sentenceCase(data.empresa) : '—'}${data.empresaCuit ? ` - CUIT: ${data.empresaCuit}` : ''}`,
      pageWidth - right - rightLabelX - 3,
    ),
    rightLabelX,
    y + 60,
  );

  return y + 81;
}

function encabezadoCertificado(doc: jsPDF, data: MedicionPdfData, cabecera: string): number {
  const ancho = doc.internal.pageSize.getWidth();
  const left = 25;
  const right = 10;
  const finCabecera = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.5);
  const width = ancho - left - right;
  const col1 = left + 84;
  const col2 = col1 + 90;
  const y = finCabecera + 2;

  doc.setDrawColor(30);
  doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);

  doc.rect(left, y, width - 28, 7);
  doc.rect(ancho - right - 28, y, 28, 7);
  doc.text(
    `Certificado básico de obra N° ${data.numero} / (${periodoTexto(data.periodo)})`,
    left + 2,
    y + 4.7,
  );
  doc.text('Anexo I', ancho - right - 14, y + 4.7, { align: 'center' });

  doc.rect(left, y + 8.5, width, 7);
  doc.text(`Obra: ${data.nombreObra ? sentenceCase(data.nombreObra) : '—'}`, left + 2, y + 13.2);

  doc.rect(left, y + 17, col1 - left, 36);
  doc.rect(col1, y + 17, col2 - col1, 36);
  doc.rect(col2, y + 17, ancho - right - col2, 36);
  doc.setFontSize(6.1);

  const drawRows = (
    rows: Array<[string, string]>,
    labelX: number,
    valueX: number,
    maxWidth: number,
    startY = y + 21.8,
  ) => rows.forEach(([label, value], index) => {
    const rowY = startY + index * 4.15;
    doc.text(label, labelX, rowY);
    doc.text(doc.splitTextToSize(value, maxWidth)[0] ?? '', valueX, rowY);
  });

  drawRows([
    ['Organismo otorgante', 'Municipalidad de Posadas'],
    ['Aprobación', data.aprobacion || '—'],
    ['Programa', 'Municipal'],
    ['Localidad', data.localidad ? sentenceCase(data.localidad) : 'Posadas - Misiones'],
    ['Responsable legal', data.responsableLegal || '—'],
    ['Responsable técnico', data.responsableTecnico || '—'],
  ], left + 2, left + 33, col1 - left - 36);

  drawRows([
    ['Monto total', `$ ${money.format(totalContrato(data))}`],
    ['Monto provincia / Nación', '—'],
    ['Monto municipio', `$ ${money.format(totalContrato(data))}`],
    ['Modo de ejecución', data.numeroContrato ? `Concurso de precios ${data.numeroContrato}` : 'Concurso de precios'],
    ['Empresa', data.empresa ? sentenceCase(data.empresa) : '—'],
    ['CUIT', data.empresaCuit || '—'],
    ['Monto contrato original', `$ ${money.format(totalContrato(data))}`],
  ], col1 + 2, col1 + 36, col2 - col1 - 39);

  if (tieneReadecuacionAprobada(data)) {
    drawRows([
      ['Monto total actualizado', `$ ${money.format(montoTotalActualizado(data))}`],
    ], col1 + 2, col1 + 36, col2 - col1 - 39, y + 50.85);
  }

  drawRows([
    ['Período', periodoTexto(data.periodo)],
    ['Fecha de carga', fechaTexto(data.fechaMedicion)],
    ['Fecha de inicio', fechaTexto(data.fechaInicio)],
    ['Plazo de ejecución', data.plazoObraDias ? `${data.plazoObraDias} días` : '—'],
    ['Expediente madre N°', `${data.expediente ?? '—'}${data.anioEmision ? ` / ${data.anioEmision}` : ''}`],
  ], col2 + 2, col2 + 32, ancho - right - col2 - 35, y + 21.8);

  return y + 55;
}

function totalContrato(data: MedicionPdfData): number {
  return redondearMoneda(
    data.rubros.flatMap((rubro) => rubro.items)
      .reduce(
        (total, item) => total + redondearMoneda(n(item.cantidad) * n(item.precioUnitario)),
        0,
      ),
  );
}

function certificadosEmitidos(data: MedicionPdfData): CertificadoResumenPdf[] {
  return (data.certificados ?? []).filter(
    (certificado) => certificado.tipo === 'OBRA'
      && certificado.estado === 'APROBADO'
      && certificado.numero <= data.numero,
  );
}

function montoAnticipoFinanciero(data: MedicionPdfData): number {
  return (data.certificados ?? [])
    .filter((certificado) => certificado.tipo === 'ANTICIPO_FINANCIERO' && certificado.estado !== 'ANULADO')
    .reduce((total, certificado) => total + n(certificado.montoBruto), 0);
}

function incrementosReadecuacionAprobados(data: MedicionPdfData): number {
  return certificadosEmitidos(data).reduce(
    (total, certificado) => total + (certificado.readecuacion?.estado === 'APROBADO'
      ? n(certificado.readecuacion.incremento)
      : 0),
    0,
  );
}

function tieneReadecuacionAprobada(data: MedicionPdfData): boolean {
  return certificadosEmitidos(data).some(
    (certificado) => certificado.readecuacion?.estado === 'APROBADO',
  );
}

function montoTotalActualizado(data: MedicionPdfData): number {
  return redondearMoneda(totalContrato(data) + incrementosReadecuacionAprobados(data));
}

/** Importe efectivamente invertido: anticipo + netos básicos + incrementos redeterminados. */
function montoActualizado(data: MedicionPdfData): number {
  const certificados = certificadosEmitidos(data);
  const netosBasicos = certificados.reduce(
    (total, certificado) => total + (certificado.montoPostAnticipo !== undefined
      ? n(certificado.montoPostAnticipo)
      : n(certificado.montoBruto) - n(certificado.deduccionAnticipo)),
    0,
  );
  return redondearMoneda(
    montoAnticipoFinanciero(data) + netosBasicos + incrementosReadecuacionAprobados(data),
  );
}

function bodyConRubros(data: MedicionPdfData, certificado: boolean): RowInput[] {
  const detallePorItem = new Map(data.detalles.map((detalle) => [detalle.itemId, detalle]));
  const rows: RowInput[] = [];

  data.rubros.slice().sort((a, b) => a.orden - b.orden).forEach((rubro) => {
    const columnas = certificado ? 12 : 7;
    rows.push([{ content: `${rubro.rubroRef}  ${sentenceCase(rubro.nombre)}`, colSpan: columnas, styles: {
      fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [17, 24, 39],
    } }]);
    rubro.items.forEach((item) => {
      const detalle = detallePorItem.get(item.id);
      const actual = n(detalle?.cantidadPeriodo);
      const acumulado = n(detalle?.cantidadAcumulada);
      const anterior = Math.max(0, acumulado - actual);
      const precio = n(item.precioUnitario);
      const base = [
        item.itemRef, sentenceCase(item.nombre), item.unidad,
        quantity.format(n(detalle?.cantidadContratadaSnapshot ?? item.cantidad)),
      ];
      rows.push(certificado
        ? [...base, `$ ${money.format(precio)}`, `$ ${money.format(n(item.cantidad) * precio)}`,
          quantity.format(anterior), quantity.format(actual), quantity.format(acumulado),
          `$ ${money.format(anterior * precio)}`, `$ ${money.format(n(detalle?.montoPeriodo))}`,
          `$ ${money.format(acumulado * precio)}`]
        : [...base, quantity.format(anterior), quantity.format(actual), quantity.format(acumulado)]);
    });
  });
  return rows;
}

export async function crearFojaPdf(data: MedicionPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const inicioTabla = encabezadoFoja(doc, data, cabecera);
  autoTable(doc, {
    startY: inicioTabla,
    margin: { top: inicioTabla, left: 16, right: 10 },
    head: [['Ítem', 'Designación', 'Un.', 'Cant.', 'Anterior', 'Actual', 'Acumulado']],
    body: bodyConRubros(data, false),
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.8 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, halign: 'center', fontSize: 7.2 },
    columnStyles: {
      0: { cellWidth: 14 }, 1: { cellWidth: 78 }, 2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' }, 4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right', fillColor: [219, 234, 254] },
      6: { cellWidth: 20, halign: 'right' },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) encabezadoFoja(doc, data, cabecera);
    },
  });
  return doc;
}

export async function descargarFojaPdf(data: MedicionPdfData): Promise<void> {
  (await crearFojaPdf(data)).save(`foja-medicion-${String(data.numeroFoja).padStart(2, '0')}.pdf`);
}

export async function crearCertificadoPdf(data: MedicionPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const inicioTabla = encabezadoCertificado(doc, data, cabecera);
  autoTable(doc, {
    startY: inicioTabla,
    margin: { top: inicioTabla, left: 25, right: 10 },
    head: [[
      'Ítem', 'Designación', 'Un.', 'Cant.', 'Precio unit.', 'Monto ítem',
      'Cant. anterior', 'Cant. actual', 'Cant. acum.',
      'Monto anterior', 'Monto actual', 'Monto acum.',
    ]],
    body: bodyConRubros(data, true),
    theme: 'grid',
    styles: { fontSize: 6.4, cellPadding: 1.15, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, halign: 'center', fontSize: 6 },
    columnStyles: {
      0: { cellWidth: 11 }, 1: { cellWidth: 55 }, 2: { cellWidth: 9, halign: 'center' },
      3: { cellWidth: 14, halign: 'right' }, 4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 17, halign: 'right' },
      7: { cellWidth: 16, halign: 'right', fillColor: [219, 234, 254] },
      8: { cellWidth: 17, halign: 'right' }, 9: { cellWidth: 27, halign: 'right' },
      10: { cellWidth: 27, halign: 'right' }, 11: { cellWidth: 27, halign: 'right' },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) encabezadoCertificado(doc, data, cabecera);
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  const pageHeight = doc.internal.pageSize.getHeight();
  let resumenY = finalY + 5;
  if (resumenY + 34 > pageHeight - 10) {
    doc.addPage();
    resumenY = encabezadoCertificado(doc, data, cabecera);
  }

  const montoFinal = n(data.montoFinal);
  autoTable(doc, {
    startY: resumenY,
    margin: { left: 25, right: 10 },
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.7, lineColor: [55, 65, 81], lineWidth: 0.25 },
    body: [
      [
        { content: 'Total contrato', colSpan: 5, styles: { fontStyle: 'bold', fillColor: [226, 232, 240], halign: 'right' } },
        { content: `$ ${money.format(totalContrato(data))}`, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: 'Total monto bruto', colSpan: 5, styles: { fontStyle: 'bold', fillColor: [226, 232, 240], halign: 'right' } },
        { content: `$ ${money.format(n(data.montoBruto))}`, styles: { fontStyle: 'bold', halign: 'right' } },
      ],
      [
        { content: '', colSpan: 6 },
        { content: 'Deducción anticipo financiero', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${money.format(n(data.porcentajeAnticipo))}%  - $ ${money.format(n(data.deduccionAnticipo))}`, styles: { halign: 'right' } },
      ],
      [
        { content: '', colSpan: 6 },
        { content: 'Deducción fondo de reparo', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `6%  - $ ${money.format(n(data.deduccionFondoReparo))}`, styles: { halign: 'right' } },
      ],
      [
        { content: 'Suma a pagar en el presente certificado', colSpan: 11, styles: { fontStyle: 'bold', fontSize: 8.5, fillColor: [219, 234, 254] } },
        { content: `$ ${money.format(montoFinal)}`, styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'right', fillColor: [219, 234, 254] } },
      ],
      [
        { content: `Son: ${montoEnLetras(montoFinal)}`, colSpan: 12, styles: { fontStyle: 'bold', fontSize: 7.2, halign: 'right' } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 11 }, 1: { cellWidth: 55 }, 2: { cellWidth: 9 }, 3: { cellWidth: 14 },
      4: { cellWidth: 20 }, 5: { cellWidth: 22 }, 6: { cellWidth: 17 }, 7: { cellWidth: 16 },
      8: { cellWidth: 17 }, 9: { cellWidth: 27 }, 10: { cellWidth: 27 }, 11: { cellWidth: 27 },
    },
  });
  return doc;
}

export async function descargarCertificadoPdf(data: MedicionPdfData): Promise<void> {
  (await crearCertificadoPdf(data)).save(`certificado-${String(data.numero).padStart(2, '0')}.pdf`);
}

interface MovimientoAnexo {
  porcentaje: number;
  importe: number;
}

function movimientoAnexo(importe: number, contrato: number): MovimientoAnexo {
  return { importe, porcentaje: contrato > 0 ? importe * 100 / contrato : 0 };
}

function textoMovimiento(movimiento: MovimientoAnexo, moneda = false): string {
  return moneda ? `$ ${money.format(movimiento.importe)}` : `${money.format(movimiento.porcentaje)}%`;
}

export async function crearAnexoIIIPdf(data: AnexoIIIPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const left = 10;
  const right = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - left - right;
  const inicio = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.5) + 2;
  const contrato = totalContrato(data);
  const certificadosObra = data.certificados
    .filter((certificado) => certificado.tipo === 'OBRA' && certificado.estado === 'APROBADO' && certificado.numero <= data.numero)
    .sort((a, b) => a.numero - b.numero);
  const certificadoActual = certificadosObra.find((certificado) => certificado.numero === data.numero);
  const anteriores = certificadosObra.filter((certificado) => certificado.numero < data.numero);
  const suma = (certificados: typeof certificadosObra, selector: (certificado: typeof certificadosObra[number]) => number) =>
    certificados.reduce((total, certificado) => total + selector(certificado), 0);
  const readecuacion = (certificado: typeof certificadosObra[number]) => certificado.readecuacion?.estado === 'APROBADO'
    ? certificado.readecuacion : null;
  const netoCertificado = (certificado: typeof certificadosObra[number]) => certificado.montoPostAnticipo !== undefined
    ? n(certificado.montoPostAnticipo)
    : n(certificado.montoBruto) - n(certificado.deduccionAnticipo);
  const actual = certificadoActual ?? {
    montoBruto: data.montoBruto,
    montoPostAnticipo: null,
    deduccionAnticipo: data.deduccionAnticipo,
    deduccionFondoReparo: data.deduccionFondoReparo,
    montoFinal: data.montoFinal,
    readecuacion: null,
  } as typeof certificadosObra[number];
  const anticipo = data.certificados
    .filter((certificado) => certificado.tipo === 'ANTICIPO_FINANCIERO' && certificado.estado === 'APROBADO')
    .reduce((total, certificado) => total + n(certificado.montoBruto), 0);
  const anteriorBruto = suma(anteriores, (certificado) => n(certificado.montoBruto));
  const presenteBruto = n(actual.montoBruto);
  const anteriorReadecuacion = suma(anteriores, (certificado) => n(readecuacion(certificado)?.incremento));
  const presenteReadecuacion = n(readecuacion(actual)?.incremento);
  const anteriorDescuentoAnticipo = suma(anteriores, (certificado) => n(certificado.deduccionAnticipo));
  const presenteDescuentoAnticipo = n(actual.deduccionAnticipo);
  const anteriorNeto = suma(anteriores, netoCertificado);
  const presenteNeto = netoCertificado(actual);
  const anteriorReparo = suma(anteriores, (certificado) => n(certificado.deduccionFondoReparo));
  const presenteReparo = n(actual.deduccionFondoReparo);
  const anteriorReparoReadecuacion = suma(anteriores, (certificado) => n(readecuacion(certificado)?.deduccionFondoReparo));
  const presenteReparoReadecuacion = n(readecuacion(actual)?.deduccionFondoReparo);
  const anteriorPago = suma(anteriores, (certificado) => n(certificado.montoFinal) + n(readecuacion(certificado)?.incrementoNetoPagar));
  const presentePago = n(actual.montoFinal) + n(readecuacion(actual)?.incrementoNetoPagar);

  doc.setDrawColor(30);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.rect(left, inicio, width - 32, 7);
  doc.rect(left + width - 32, inicio, 32, 7);
  doc.text('DDJJ de avance físico y financiero de obra', left + 1.5, inicio + 4.7);
  doc.text('Anexo III-B', left + width - 16, inicio + 4.7, { align: 'center' });

  const datosY = inicio + 8.5;
  const division = left + width * 0.57;
  const datosHeight = 46;
  doc.rect(left, datosY, division - left, datosHeight);
  doc.rect(division, datosY, left + width - division, datosHeight);
  doc.setFontSize(6.2);
  const fila = (label: string, value: string, x: number, y: number, valueX: number, maxWidth: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(value, maxWidth)[0] ?? '—', valueX, y);
  };
  const izquierda = [
    ['Organismo otorgante:', 'Municipalidad de Posadas'],
    ['Convenio / proyecto:', `${data.expediente ?? '—'}${data.anioEmision ? ` / ${data.anioEmision}` : ''}`],
    ['Dispositivo de aprobación:', data.aprobacion ?? '—'],
    ['Obra:', data.nombreObra ? sentenceCase(data.nombreObra) : '—'],
    ['Programa:', 'Municipal'],
    ['Municipalidad:', data.localidad ? sentenceCase(data.localidad) : 'Posadas'],
    ['Provincia:', 'Misiones'],
    ['Monto total contrato:', `$ ${money.format(contrato)}`],
    ['Monto Nación / Provincia:', '—'],
    ['Monto Municipio:', `$ ${money.format(contrato)}`],
    ['Empresa:', data.empresa ? sentenceCase(data.empresa) : '—'],
    ['CUIT:', data.empresaCuit ?? '—'],
    ['Domicilio:', data.ubicacion ? sentenceCase(data.ubicacion) : '—'],
  ];
  izquierda.forEach(([label, value], index) => fila(label, value, left + 1.5, datosY + 3.5 + index * 3.25, left + 35, division - left - 37));
  const derecha = [
    ['Certificado N°:', String(data.numero)],
    ['Fecha de carga:', fechaTexto(data.fechaMedicion)],
    ['Mes y año certificado:', periodoTexto(data.periodo)],
    ['Fecha inicio:', fechaTexto(data.fechaInicio)],
    ['Plazo obra:', data.plazoObraDias ? `${data.plazoObraDias} días` : '—'],
  ];
  derecha.forEach(([label, value], index) => fila(label, value, division + 1.5, datosY + 3.5 + index * 3.9, division + 29, left + width - division - 31));

  const fisicoAnterior = movimientoAnexo(anteriorBruto, contrato);
  const fisicoPresente = movimientoAnexo(presenteBruto, contrato);
  const fisicoTotal = movimientoAnexo(anteriorBruto + presenteBruto, contrato);
  const tituloFisicoY = datosY + datosHeight + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.text('Avance físico', left, tituloFisicoY);
  autoTable(doc, {
    startY: tituloFisicoY + 1.5,
    margin: { left, right },
    theme: 'grid',
    styles: { fontSize: 6.7, cellPadding: 1.4, valign: 'middle' },
    headStyles: { fillColor: [226, 232, 240], textColor: [17, 24, 39], halign: 'center', fontStyle: 'bold' },
    head: [['Concepto', 'Acumulado anterior', 'Presente certificado', 'Acumulado total']],
    body: [[
      { content: 'Avance físico obra', styles: { fontStyle: 'bold' } },
      textoMovimiento(fisicoAnterior), textoMovimiento(fisicoPresente), textoMovimiento(fisicoTotal),
    ]],
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 40, halign: 'center' }, 3: { cellWidth: 40, halign: 'center' } },
  });

  const financieroY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tituloFisicoY + 14) + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.text('Avance financiero', left, financieroY);
  const movimiento = (importe: number) => movimientoAnexo(importe, contrato);
  const filasFinancieras: Array<[string, number, number, number, boolean?]> = [
    ['Total bruto certificado', anteriorBruto, presenteBruto, anteriorBruto + presenteBruto],
    ['Total bruto readecuaciones', anteriorReadecuacion, presenteReadecuacion, anteriorReadecuacion + presenteReadecuacion],
    ['Anticipo financiero', anticipo, 0, anticipo],
    ['(-) Deducción anticipo financiero', anteriorDescuentoAnticipo, presenteDescuentoAnticipo, anteriorDescuentoAnticipo + presenteDescuentoAnticipo],
    ['Total neto certificado', anteriorNeto, presenteNeto, anteriorNeto + presenteNeto],
    ['(-) Deducción garantía de obra', anteriorReparo, presenteReparo, anteriorReparo + presenteReparo],
    ['(-) Deducción garantía de obra de readecuaciones', anteriorReparoReadecuacion, presenteReparoReadecuacion, anteriorReparoReadecuacion + presenteReparoReadecuacion],
    ['Pago / desembolso financiero', anteriorPago, presentePago, anteriorPago + presentePago, true],
  ];
  autoTable(doc, {
    startY: financieroY + 1.5,
    margin: { left, right },
    theme: 'grid',
    styles: { fontSize: 5.9, cellPadding: 1.05, valign: 'middle' },
    headStyles: { fillColor: [226, 232, 240], textColor: [17, 24, 39], halign: 'center', fontStyle: 'bold' },
    head: [['Concepto', 'Acumulado anterior', 'Presente certificado', 'Acumulado total']],
    body: filasFinancieras.map(([concepto, anterior, presente, total, destacado]) => {
      const style = destacado ? { fontStyle: 'bold' as const, fillColor: [226, 232, 240] as [number, number, number] } : undefined;
      const celda = (importe: number, sinValor = false) => sinValor
        ? '—'
        : `${textoMovimiento(movimiento(importe))}\n${textoMovimiento(movimiento(importe), true)}`;
      return [
        { content: concepto, styles: style },
        { content: celda(anterior), styles: { ...style, halign: 'right' as const } },
        { content: celda(presente, presente === 0 && concepto === 'Anticipo financiero'), styles: { ...style, halign: 'right' as const } },
        { content: celda(total), styles: { ...style, halign: 'right' as const } },
      ];
    }),
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 40 }, 2: { cellWidth: 40 }, 3: { cellWidth: 40 } },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? financieroY + 45;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  const declaracion = 'Declaro que los datos consignados en este formulario son correctos y completos y que he confeccionado la presente DDJJ utilizando el software entregado y aprobado por el Tribunal de Cuentas de la Provincia de Misiones, sin omitir ni falsear dato alguno que deba contener, siendo fiel expresión de la verdad.';
  doc.text(doc.splitTextToSize(declaracion, width), left, finalY + 7);
  const firmasY = Math.max(finalY + 24, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  [['Firma y sello', 'Intendente'], ['Firma y sello', 'Tesorero'], ['Firma y sello', 'Contador']].forEach(([firma, cargo], index) => {
    const x = left + width * ((index + 0.5) / 3);
    doc.text(firma, x, firmasY, { align: 'center' });
    doc.text(cargo, x, firmasY + 4, { align: 'center' });
  });
  return doc;
}

export async function descargarAnexoIIIPdf(data: AnexoIIIPdfData): Promise<void> {
  (await crearAnexoIIIPdf(data)).save(`anexo-iii-b-certificado-${String(data.numero).padStart(2, '0')}.pdf`);
}

export async function crearReadecuacionPdf(data: ReadecuacionPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const left = 5;
  const right = 5;
  const width = doc.internal.pageSize.getWidth() - left - right;
  const inicio = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.5) + 2;
  const r = data.readecuacion;

  doc.setDrawColor(40);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.rect(left, inicio, width, 8);
  doc.text('Planilla de determinación del incremento del certificado básico de obra por montos readecuados por aplicación del FAP', left + width / 2, inicio + 5, { align: 'center' });
  doc.rect(left, inicio + 9, width, 7);
  doc.text(`Cálculo de montos readecuados para el certificado básico N° ${data.numero} - saltos ${r.saltos.map((s) => s.orden).join(' y ')}`, left + width / 2, inicio + 13.5, { align: 'center' });

  autoTable(doc, {
    startY: inicio + 18,
    margin: { left, right },
    theme: 'plain',
    styles: { fontSize: 6.4, cellPadding: 1.1 },
    body: [
      ['Obra:', data.nombreObra ? sentenceCase(data.nombreObra) : '—', 'Monto contrato original:', `$ ${money.format(totalContrato(data))}`, 'Mes y año certificado:', periodoTexto(data.periodo)],
      ['Organismo ejecutor:', 'Municipalidad de Posadas', 'Monto anticipo:', `$ ${money.format(n(data.deduccionAnticipo))}`, 'Nro. certificado:', String(data.numero)],
      ['Provincia:', 'Misiones', 'Empresa:', data.empresa ? sentenceCase(data.empresa) : '—', 'Tipo de certificado:', 'Actualización'],
      ['Municipio:', data.localidad ? sentenceCase(data.localidad) : 'Posadas', 'CUIT:', data.empresaCuit ?? '—', 'Fecha inicio:', fechaTexto(data.fechaInicio)],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 70 }, 2: { fontStyle: 'bold', cellWidth: 38 }, 3: { cellWidth: 48 }, 4: { fontStyle: 'bold', cellWidth: 37 }, 5: { cellWidth: 64 } },
  });

  const tablaY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? inicio + 46;
  const saltos = r.saltos.map((salto, index) => [
    index === 0 ? String(data.numero) : '', index === 0 ? periodoTexto(data.periodo) : '',
    index === 0 ? `$ ${money.format(n(r.montoBase))}` : '', index === 0 ? `$ ${money.format(n(r.deduccionAnticipo))}` : '',
    index === 0 ? `$ ${money.format(n(r.montoNetoActualizar))}` : '', `Salto ${salto.orden}`, salto.fap,
    index === 0 ? r.fapConsolidado : '', index === 0 ? `$ ${money.format(n(r.montoNetoActualizado))}` : '',
    index === 0 ? `$ ${money.format(n(r.incremento))}` : '',
  ]);
  autoTable(doc, {
    startY: tablaY + 3,
    margin: { left, right },
    theme: 'grid',
    styles: { fontSize: 5.7, cellPadding: 1.2, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [239, 242, 225], textColor: 20, fontStyle: 'bold' },
    head: [['Certificado básico N°', 'Mes certificado', 'Monto certificado a precios base', 'Descuento anticipo', 'Monto neto a actualizar', 'Salto', 'Factor de actualización', 'FAP consolidado', 'Monto neto actualizado', 'Incremento por actualización']],
    body: saltos,
  });

  const resumenY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tablaY + 22;
  autoTable(doc, {
    startY: resumenY + 2,
    margin: { left: 184, right },
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    body: [
      ['Total monto incrementado por actualizaciones', `$ ${money.format(n(r.incremento))}`],
      ['Descuento de fondo de reparo', `$ ${money.format(n(r.deduccionFondoReparo))}`],
      ['Total del incremento neto a pagar', `$ ${money.format(n(r.incrementoNetoPagar))}`],
    ],
    columnStyles: { 0: { cellWidth: 78, fontStyle: 'bold', halign: 'right' }, 1: { cellWidth: 26, fontStyle: 'bold', halign: 'right' } },
  });
  const letrasY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? resumenY + 20;
  doc.rect(left + 46, letrasY + 2, width - 46, 7);
  doc.setFontSize(6.2);
  doc.text(`Monto a pagar: ${montoEnLetras(n(r.incrementoNetoPagar))}`, left + 48, letrasY + 6.5);
  doc.text('El presente certificado tiene carácter de declaración jurada', left + width / 2, letrasY + 13, { align: 'center' });
  return doc;
}

export async function descargarReadecuacionPdf(data: ReadecuacionPdfData): Promise<void> {
  (await crearReadecuacionPdf(data)).save(`readecuacion-certificado-${String(data.numero).padStart(2, '0')}.pdf`);
}
