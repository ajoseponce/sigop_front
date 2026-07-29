import { jsPDF } from 'jspdf';
import { RowInput, autoTable } from 'jspdf-autotable';

export interface ComputoPdfItem {
  itemRef: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
}

export interface ComputoPdfRubro {
  rubroRef: string;
  nombre: string;
  orden: number;
  items: ComputoPdfItem[];
}

export interface ComputoPdfData {
  nombreObra: string;
  rubros: ComputoPdfRubro[];
}

const moneyFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function money(value: number): string {
  return `$ ${moneyFormatter.format(value)}`;
}

function totalRubro(rubro: ComputoPdfRubro): number {
  return rubro.items.reduce(
    (total, item) => total + item.cantidad * item.precioUnitario,
    0,
  );
}

function sanitizeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function crearComputoPdf(data: ComputoPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totalGeneral = data.rubros.reduce(
    (total, rubro) => total + totalRubro(rubro),
    0,
  );
  const body: RowInput[] = [];

  data.rubros
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .forEach((rubro) => {
      const rubroTotal = totalRubro(rubro);
      const incidencia = totalGeneral > 0
        ? (rubroTotal / totalGeneral) * 100
        : 0;

      body.push([
        {
          content: rubro.rubroRef,
          styles: { fontStyle: 'bold', fillColor: [226, 230, 234] },
        },
        {
          content: rubro.nombre.toUpperCase(),
          styles: { fontStyle: 'bold', fillColor: [226, 230, 234] },
        },
        { content: '', styles: { fillColor: [226, 230, 234] } },
        { content: '', styles: { fillColor: [226, 230, 234] } },
        { content: '', styles: { fillColor: [226, 230, 234] } },
        { content: '', styles: { fillColor: [226, 230, 234] } },
        {
          content: money(rubroTotal),
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fillColor: [226, 230, 234],
          },
        },
        {
          content: `${moneyFormatter.format(incidencia)}%`,
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fillColor: [226, 230, 234],
          },
        },
      ]);

      rubro.items.forEach((item) => {
        body.push([
          item.itemRef,
          item.nombre,
          item.unidad,
          {
            content: quantityFormatter.format(item.cantidad),
            styles: { halign: 'right' },
          },
          {
            content: money(item.precioUnitario),
            styles: { halign: 'right' },
          },
          {
            content: money(item.cantidad * item.precioUnitario),
            styles: { halign: 'right' },
          },
          '',
          '',
        ]);
      });
    });

  body.push([
    {
      content: 'PRECIO TOTAL',
      colSpan: 6,
      styles: {
        halign: 'center',
        fontStyle: 'bold',
        fontSize: 10,
        fillColor: [245, 246, 247],
      },
    },
    {
      content: money(totalGeneral),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 9,
        fillColor: [245, 246, 247],
      },
    },
    {
      content: '100,00%',
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 9,
        fillColor: [245, 246, 247],
      },
    },
  ]);

  doc.setProperties({
    title: `Cómputo y presupuesto - ${data.nombreObra}`,
    subject: 'Cómputo y presupuesto de obra',
    creator: 'SIGOP',
  });

  autoTable(doc, {
    startY: 28,
    margin: { top: 28, right: 10, bottom: 13, left: 10 },
    head: [[
      'ÍTEM',
      'RUBRO',
      'UNID.',
      'CANT.',
      'PRECIO\nUNITARIO',
      'PARCIAL\nÍTEM',
      'TOTAL P/\nRUBRO',
      '% INCID.',
    ]],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 5.8,
      cellPadding: 1.2,
      lineColor: [53, 59, 67],
      lineWidth: 0.25,
      textColor: [25, 29, 34],
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [238, 240, 242],
      textColor: [25, 29, 34],
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.35,
      fontSize: 6,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 64 },
      2: { cellWidth: 11, halign: 'center' },
      3: { cellWidth: 15 },
      4: { cellWidth: 24 },
      5: { cellWidth: 24 },
      6: { cellWidth: 25 },
      7: { cellWidth: 17 },
    },
    rowPageBreak: 'avoid',
    didDrawPage: () => {
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setDrawColor(45, 52, 61);
      doc.setLineWidth(0.35);
      doc.rect(10, 7, pageWidth - 20, 9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(data.nombreObra.toUpperCase(), pageWidth / 2, 12.7, {
        align: 'center',
      });
      doc.setFontSize(9);
      doc.text('CÓMPUTO Y PRESUPUESTO', pageWidth / 2, 21.5, {
        align: 'center',
      });
      doc.line(10, 24, pageWidth - 10, 24);
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 104);
    doc.text(
      `SIGOP - Página ${page} de ${pages}`,
      doc.internal.pageSize.getWidth() - 10,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'right' },
    );
  }

  return doc;
}

export function descargarComputoPdf(data: ComputoPdfData): void {
  const filename = sanitizeFilename(data.nombreObra) || 'obra';
  crearComputoPdf(data).save(`computo-presupuesto-${filename}.pdf`);
}
