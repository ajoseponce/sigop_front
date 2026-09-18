import { jsPDF } from 'jspdf';
import { RowInput, autoTable } from 'jspdf-autotable';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../../shared/pdf/pdf-header.util';

export interface ErrorImportacionComputo {
  rubroRef: string;
  itemRef: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  parcialSistema: number;
  parcialArchivo: number;
  diferencia: number;
}

interface ReporteErroresImportacionData {
  nombreObra: string;
  archivo: string;
  errores: ErrorImportacionComputo[];
  totalSistema: number;
  totalArchivo: number;
}

const moneda = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numero = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function importe(value: number): string {
  return `$ ${moneda.format(value)}`;
}

function nombreArchivo(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'obra';
}

export async function descargarReporteErroresImportacion(
  data: ReporteErroresImportacionData,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const diferenciaTotal = data.totalArchivo - data.totalSistema;
  const body: RowInput[] = data.errores.map((error) => [
    error.rubroRef,
    error.itemRef,
    error.descripcion,
    error.unidad,
    { content: numero.format(error.cantidad), styles: { halign: 'right' } },
    { content: importe(error.precioUnitario), styles: { halign: 'right' } },
    { content: importe(error.parcialSistema), styles: { halign: 'right' } },
    { content: importe(error.parcialArchivo), styles: { halign: 'right' } },
    { content: importe(error.diferencia), styles: { halign: 'right', fontStyle: 'bold' } },
  ]);

  doc.setProperties({
    title: `Errores de importación - ${data.nombreObra}`,
    subject: 'Diferencias entre el cómputo de SIGOP y el archivo importado',
    creator: 'SIGOP',
  });

  autoTable(doc, {
    startY: 36,
    margin: { top: 36, right: 15, bottom: 14, left: 15 },
    head: [[
      'RUBRO', 'ÍTEM', 'DESCRIPCIÓN', 'UN.', 'CANTIDAD', 'PRECIO UNIT.',
      'PARCIAL SIGOP', 'PARCIAL ARCHIVO', 'DIFERENCIA',
    ]],
    body,
    foot: [[
      {
        content: 'TOTALES',
        colSpan: 6,
        styles: { halign: 'right', fontStyle: 'bold' },
      },
      { content: importe(data.totalSistema), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: importe(data.totalArchivo), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: importe(diferenciaTotal), styles: { halign: 'right', fontStyle: 'bold' } },
    ]],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [105, 105, 105],
      lineWidth: 0.25,
      fillColor: [245, 245, 245],
      textColor: [25, 25, 25],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [65, 65, 65],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: [215, 215, 215],
      textColor: [20, 20, 20],
      lineColor: [65, 65, 65],
      lineWidth: 0.35,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 88 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 20 },
      5: { cellWidth: 29 },
      6: { cellWidth: 29 },
      7: { cellWidth: 29 },
      8: { cellWidth: 27 },
    },
    didDrawPage: () => {
      const finCabecera = dibujarCabeceraInstitucional(doc, cabecera, 15, 15, 0.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(25, 25, 25);
      doc.text(
        'REPORTE DE DIFERENCIAS DE IMPORTACIÓN',
        doc.internal.pageSize.getWidth() / 2,
        finCabecera + 8,
        { align: 'center' },
      );
    },
  });

  doc.save(`errores-importacion-${nombreArchivo(data.nombreObra)}.pdf`);
}
