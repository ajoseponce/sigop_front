import { jsPDF } from 'jspdf';
import { RowInput, autoTable } from 'jspdf-autotable';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../../shared/pdf/pdf-header.util';

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
  ubicacion?: string;
  responsableInstitucional?: string;
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
}

const quantity = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const money = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function periodoTexto(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(value)).toUpperCase()
    : 'SIN PERÍODO';
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
  const finCabecera = dibujarCabeceraInstitucional(doc, cabecera, left, right);
  const y = finCabecera + 3;

  doc.setDrawColor(30);
  doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.rect(left, y, width, 10);
  doc.text(
    `FOJA DE MEDICIÓN - Período: ${periodoTexto(data.periodo)} - Fecha de Medición: ${fechaTexto(data.fechaMedicion)}`,
    left + 2,
    y + 6.3,
  );

  doc.rect(left, y + 12, width, 9);
  doc.text(`Obra: ${data.nombreObra || '—'}`, left + 2, y + 17.7);

  doc.rect(left, y + 23, splitX - left, 43);
  doc.rect(splitX, y + 23, pageWidth - right - splitX, 43);
  doc.setFontSize(7.2);

  const labelX = left + 2;
  const valueX = left + 39;
  const rowsLeft = [
    ['Organismo Otorgante', 'MUNICIPALIDAD DE POSADAS'],
    ['Convenio/Proyecto N°', `${data.expediente ?? '—'}${data.anioEmision ? `-${data.anioEmision}` : ''}`],
    ['Programa', 'MUNICIPAL'],
    ['Modo de Ejecución', data.numeroContrato ? `Concurso de Precios ${data.numeroContrato}` : 'Concurso de Precios'],
    ['Ubicación', data.ubicacion || '—'],
    ['Responsable Institucional', data.responsableInstitucional || '—'],
  ];
  rowsLeft.forEach(([label, value], index) => {
    const rowY = y + 29 + index * 6;
    doc.text(label, labelX, rowY);
    doc.text(doc.splitTextToSize(value, splitX - valueX - 3)[0] ?? '', valueX, rowY);
  });

  const rightLabelX = splitX + 2;
  const rightValueX = splitX + 29;
  const rowsRight = [
    ['Certificado', `Certificado N° ${data.numero}`],
    ['Monto Contrato', `$ ${money.format(totalContrato(data))}`],
    ['Monto Total', `$ ${money.format(n(data.montoBruto))}`],
    ['Anticipo Financiero', `$ ${money.format(n(data.deduccionAnticipo))}`],
  ];
  rowsRight.forEach(([label, value], index) => {
    const rowY = y + 29 + index * 6;
    doc.text(label, rightLabelX, rowY);
    doc.text(value, rightValueX, rowY);
  });
  doc.text('Empresa:', rightLabelX, y + 54);
  doc.text(
    doc.splitTextToSize(
      `${data.empresa ?? '—'}${data.empresaCuit ? ` - CUIT: ${data.empresaCuit}` : ''}`,
      pageWidth - right - rightLabelX - 3,
    ),
    rightLabelX,
    y + 60,
  );

  return y + 69;
}

function encabezadoCertificado(doc: jsPDF, data: MedicionPdfData, cabecera: string): number {
  const finCabecera = dibujarCabeceraInstitucional(doc, cabecera);
  const ancho = doc.internal.pageSize.getWidth();
  const left = 10;
  const right = 10;
  const width = ancho - left - right;
  const col1 = left + 94;
  const col2 = col1 + 96;
  const y = finCabecera + 3;

  doc.setDrawColor(30);
  doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.rect(left, y, width - 28, 9);
  doc.rect(ancho - right - 28, y, 28, 9);
  doc.text(
    `CERTIFICADO BÁSICO DE OBRA N° ${data.numero} / (${periodoTexto(data.periodo)})`,
    left + 2,
    y + 5.8,
  );
  doc.text('ANEXO I', ancho - right - 14, y + 5.8, { align: 'center' });

  doc.rect(left, y + 11, width, 9);
  doc.text(`Obra: ${data.nombreObra || '—'}`, left + 2, y + 16.8);

  doc.rect(left, y + 22, col1 - left, 44);
  doc.rect(col1, y + 22, col2 - col1, 44);
  doc.rect(col2, y + 22, ancho - right - col2, 44);
  doc.setFontSize(6.6);

  const drawRows = (
    rows: Array<[string, string]>,
    labelX: number,
    valueX: number,
    maxWidth: number,
    startY = y + 28,
  ) => rows.forEach(([label, value], index) => {
    const rowY = startY + index * 5.2;
    doc.text(label, labelX, rowY);
    doc.text(doc.splitTextToSize(value, maxWidth)[0] ?? '', valueX, rowY);
  });

  drawRows([
    ['Organismo Otorgante', 'MUNICIPALIDAD DE POSADAS'],
    ['Convenio/Proyecto N°', `${data.expediente ?? '—'}${data.anioEmision ? `-${data.anioEmision}` : ''}`],
    ['Aprobación', data.aprobacion || '—'],
    ['Programa', 'MUNICIPAL'],
    ['Localidad', data.localidad || 'Posadas - Misiones'],
    ['Responsable Institucional', data.responsableInstitucional || '—'],
    ['Responsable Técnico', '—'],
  ], left + 2, left + 33, col1 - left - 36);

  drawRows([
    ['Monto Total', `$ ${money.format(totalContrato(data))}`],
    ['Monto Provincia / Nación', '—'],
    ['Monto Municipio', `$ ${money.format(totalContrato(data))}`],
    ['Modo de Ejecución', data.numeroContrato ? `Concurso de Precios ${data.numeroContrato}` : 'Concurso de Precios'],
    ['Empresa', data.empresa || '—'],
    ['CUIT', data.empresaCuit || '—'],
    ['Monto Contrato Original', `$ ${money.format(totalContrato(data))}`],
    ['Monto Total Actualizado', `$ ${money.format(totalContrato(data))}`],
  ], col1 + 2, col1 + 36, col2 - col1 - 39);

  doc.text(`CERTIFICADO BÁSICO DE OBRA N° ${data.numero}`, col2 + 2, y + 28);
  doc.line(col2, y + 31, ancho - right, y + 31);
  drawRows([
    ['Período', periodoTexto(data.periodo)],
    ['Fecha de Medición', fechaTexto(data.fechaMedicion)],
    ['Fecha de Inicio', fechaTexto(data.fechaInicio)],
    ['Plazo de Ejecución', data.plazoObraDias ? `${data.plazoObraDias} días` : '—'],
    ['Expediente de la Obra', `${data.expediente ?? '—'}${data.anioEmision ? ` / ${data.anioEmision}` : ''}`],
    ['Expediente del Certificado', '—'],
  ], col2 + 2, col2 + 34, ancho - right - col2 - 37, y + 36);

  return y + 69;
}

function totalContrato(data: MedicionPdfData): number {
  return data.rubros.flatMap((rubro) => rubro.items)
    .reduce((total, item) => total + n(item.cantidad) * n(item.precioUnitario), 0);
}

function bodyConRubros(data: MedicionPdfData, certificado: boolean): RowInput[] {
  const detallePorItem = new Map(data.detalles.map((detalle) => [detalle.itemId, detalle]));
  const rows: RowInput[] = [];

  data.rubros.slice().sort((a, b) => a.orden - b.orden).forEach((rubro) => {
    const columnas = certificado ? 12 : 7;
    rows.push([{ content: `${rubro.rubroRef}  ${rubro.nombre.toUpperCase()}`, colSpan: columnas, styles: {
      fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [17, 24, 39],
    } }]);
    rubro.items.forEach((item) => {
      const detalle = detallePorItem.get(item.id);
      const actual = n(detalle?.cantidadPeriodo);
      const acumulado = n(detalle?.cantidadAcumulada);
      const anterior = Math.max(0, acumulado - actual);
      const precio = n(item.precioUnitario);
      const base = [
        item.itemRef, item.nombre, item.unidad,
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
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, halign: 'center' },
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
    margin: { top: inicioTabla },
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
      0: { cellWidth: 12 }, 1: { cellWidth: 67 }, 2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' }, 4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' }, 6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 17, halign: 'right', fillColor: [219, 234, 254] },
      8: { cellWidth: 18, halign: 'right' }, 9: { cellWidth: 25, halign: 'right' },
      10: { cellWidth: 25, halign: 'right' }, 11: { cellWidth: 25, halign: 'right' },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) encabezadoCertificado(doc, data, cabecera);
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  const y = Math.min(finalY + 6, 179);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`TOTAL CONTRATO  $ ${money.format(totalContrato(data))}`, 145, y, { align: 'right' });
  doc.text(`TOTAL GENERAL  $ ${money.format(n(data.montoBruto))}`, 284, y, { align: 'right' });
  doc.text(`ANTICIPO FINANCIERO ${money.format(n(data.porcentajeAnticipo))}%  - $ ${money.format(n(data.deduccionAnticipo))}`, 284, y + 6, { align: 'right' });
  doc.text(`FONDO DE REPARO 6%  - $ ${money.format(n(data.deduccionFondoReparo))}`, 284, y + 12, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`SUMA A PAGAR EN EL PRESENTE CERTIFICADO  $ ${money.format(n(data.montoFinal))}`, 284, y + 20, { align: 'right' });
  return doc;
}

export async function descargarCertificadoPdf(data: MedicionPdfData): Promise<void> {
  (await crearCertificadoPdf(data)).save(`certificado-${String(data.numero).padStart(2, '0')}.pdf`);
}
