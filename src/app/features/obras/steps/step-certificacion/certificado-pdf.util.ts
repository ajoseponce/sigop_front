import { jsPDF } from 'jspdf';
import { RowInput, autoTable } from 'jspdf-autotable';

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
  nombreObra: string;
  expediente?: string;
  anioEmision?: number;
  empresa?: string;
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

function encabezado(doc: jsPDF, data: MedicionPdfData, titulo: string): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titulo, 148.5, 13, { align: 'center' });
  doc.setDrawColor(60);
  doc.rect(10, 18, 277, 25);
  doc.setFontSize(9);
  doc.text(`OBRA: ${data.nombreObra || '—'}`, 13, 24);
  doc.text(`EXPEDIENTE: ${data.expediente ?? '—'}${data.anioEmision ? `-${data.anioEmision}` : ''}`, 13, 30);
  doc.text(`FOJA DE MEDICIÓN N° ${String(data.numeroFoja).padStart(2, '0')} - ${periodoTexto(data.periodo)}`, 13, 36);
  doc.text(`EMPRESA: ${data.empresa ?? '—'}`, 284, 24, { align: 'right' });
  doc.text(`MONTO DE CONTRATO: $ ${money.format(totalContrato(data))}`, 284, 30, { align: 'right' });
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

export function crearFojaPdf(data: MedicionPdfData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`FOJA DE MEDICIÓN N° ${String(data.numeroFoja).padStart(2, '0')}`, 105, 13, { align: 'center' });
  doc.setDrawColor(60);
  doc.rect(10, 18, 190, 27);
  doc.setFontSize(8);
  doc.text(`OBRA: ${data.nombreObra || '—'}`, 13, 24);
  doc.text(`EXPEDIENTE: ${data.expediente ?? '—'}${data.anioEmision ? `-${data.anioEmision}` : ''}`, 13, 30);
  doc.text(`PERÍODO: ${periodoTexto(data.periodo)}`, 13, 36);
  doc.text(`EMPRESA: ${data.empresa ?? '—'}`, 197, 24, { align: 'right' });
  doc.text(`MONTO DE CONTRATO: $ ${money.format(totalContrato(data))}`, 197, 30, { align: 'right' });
  autoTable(doc, {
    startY: 47,
    head: [['Ítem', 'Designación', 'Un.', 'Cant.', 'Anterior', 'Actual', 'Acumulado']],
    body: bodyConRubros(data, false),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 14 }, 1: { cellWidth: 85 }, 2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' }, 4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right', fillColor: [219, 234, 254] },
      6: { cellWidth: 20, halign: 'right' },
    },
  });
  return doc;
}

export function descargarFojaPdf(data: MedicionPdfData): void {
  crearFojaPdf(data).save(`foja-medicion-${String(data.numeroFoja).padStart(2, '0')}.pdf`);
}

export function crearCertificadoPdf(data: MedicionPdfData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  encabezado(doc, data, `CERTIFICADO N° ${String(data.numero).padStart(2, '0')}`);
  autoTable(doc, {
    startY: 47,
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
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  const y = Math.min(finalY + 6, 179);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`TOTAL CONTRATO  $ ${money.format(totalContrato(data))}`, 145, y, { align: 'right' });
  doc.text(`TOTAL GENERAL  $ ${money.format(n(data.montoBruto))}`, 284, y, { align: 'right' });
  doc.text(`FONDO DE REPARO 6%  $ ${money.format(n(data.montoBruto) * 0.06)}`, 284, y + 6, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`SUMA A PAGAR EN EL PRESENTE CERTIFICADO  $ ${money.format(n(data.montoFinal))}`, 284, y + 14, { align: 'right' });
  return doc;
}

export function descargarCertificadoPdf(data: MedicionPdfData): void {
  crearCertificadoPdf(data).save(`certificado-${String(data.numero).padStart(2, '0')}.pdf`);
}
