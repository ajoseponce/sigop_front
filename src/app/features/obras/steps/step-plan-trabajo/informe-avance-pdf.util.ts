import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../../shared/pdf/pdf-header.util';

export interface InformeAvancePdfFila {
  mes: number;
  proyectadoParcial: number;
  proyectadoAcumulado: number;
  proyectadoMontoAcumulado: number;
  realAcumulado: number;
  realMontoAcumulado: number;
  realDisponible: boolean;
}

export interface InformeAvancePdfData {
  nombreObra: string;
  numeroContrato?: string;
  filas: InformeAvancePdfFila[];
}

const money = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatoMonto(value: number): string {
  return `$ ${money.format(value)}`;
}

function punto(indice: number, avance: number, total: number, left: number, top: number, width: number, height: number) {
  return {
    x: left + width * (indice + 1) / total,
    y: top + height - height * avance / 100,
  };
}

export async function descargarInformeAvancePdf(data: InformeAvancePdfData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 12;
  const right = 12;
  const width = pageWidth - left - right;
  const inicio = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.5) + 3;

  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.rect(left, inicio, width, 9);
  doc.text('Informe de avance de obra', left + width / 2, inicio + 5.8, { align: 'center' });
  doc.setFontSize(7.2);
  doc.rect(left, inicio + 10.5, width, 12);
  doc.text(`Obra: ${data.nombreObra || '—'}`, left + 2, inicio + 15.3);
  doc.text(`Contrato: ${data.numeroContrato || '—'}`, left + 2, inicio + 20);

  const chartLeft = 20;
  const chartTop = inicio + 30;
  const chartWidth = pageWidth - 40;
  const chartHeight = 95;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  [0, 25, 50, 75, 100].forEach((value) => {
    const y = chartTop + chartHeight - chartHeight * value / 100;
    doc.setDrawColor(220, 224, 230);
    doc.line(chartLeft, y, chartLeft + chartWidth, y);
    doc.setTextColor(75, 85, 99);
    doc.text(`${value}%`, chartLeft - 3, y + 1.8, { align: 'right' });
  });
  doc.setDrawColor(100, 116, 139);
  doc.line(chartLeft, chartTop, chartLeft, chartTop + chartHeight);
  doc.line(chartLeft, chartTop + chartHeight, chartLeft + chartWidth, chartTop + chartHeight);

  const dibujarCurva = (tipo: 'proyectado' | 'real', color: [number, number, number]) => {
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(0.75);
    let anterior = { x: chartLeft, y: chartTop + chartHeight };
    data.filas.forEach((fila, indice) => {
      if (tipo === 'real' && !fila.realDisponible) return;
      const avance = tipo === 'proyectado' ? fila.proyectadoAcumulado : fila.realAcumulado;
      const actual = punto(indice, avance, data.filas.length, chartLeft, chartTop, chartWidth, chartHeight);
      doc.line(anterior.x, anterior.y, actual.x, actual.y);
      doc.circle(actual.x, actual.y, 1.3, 'F');
      const monto = tipo === 'proyectado' ? fila.proyectadoMontoAcumulado : fila.realMontoAcumulado;
      if (tipo === 'proyectado' || fila.realDisponible) {
        doc.setTextColor(...color);
        doc.setFontSize(5.6);
        doc.text(`${formatoMonto(monto)}\n${percent.format(avance)}%`, actual.x, Math.max(chartTop + 3, actual.y + (tipo === 'proyectado' ? -5 : 8)), { align: 'center' });
      }
      anterior = actual;
    });
  };

  dibujarCurva('proyectado', [37, 99, 235]);
  dibujarCurva('real', [22, 163, 74]);
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(6.5);
  data.filas.forEach((fila, indice) => {
    const x = punto(indice, 0, data.filas.length, chartLeft, chartTop, chartWidth, chartHeight).x;
    doc.text(`Mes ${fila.mes}`, x, chartTop + chartHeight + 5, { align: 'center' });
  });
  doc.setFillColor(37, 99, 235);
  doc.rect(pageWidth / 2 - 28, chartTop + chartHeight + 12, 5, 1.3, 'F');
  doc.text('Proyectado', pageWidth / 2 - 21, chartTop + chartHeight + 13.3);
  doc.setFillColor(22, 163, 74);
  doc.rect(pageWidth / 2 + 7, chartTop + chartHeight + 12, 5, 1.3, 'F');
  doc.text('Real', pageWidth / 2 + 14, chartTop + chartHeight + 13.3);

  autoTable(doc, {
    startY: chartTop + chartHeight + 20,
    margin: { left, right },
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'right' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, halign: 'center' },
    head: [['Período', 'Proyectado parcial', 'Proyectado acumulado', 'Real acumulado', 'Financiero proyectado', 'Financiero real']],
    body: data.filas.map((fila) => [
      `Mes ${fila.mes}`,
      `${percent.format(fila.proyectadoParcial)}%`,
      `${percent.format(fila.proyectadoAcumulado)}%`,
      fila.realDisponible ? `${percent.format(fila.realAcumulado)}%` : '—',
      formatoMonto(fila.proyectadoMontoAcumulado),
      fila.realDisponible ? formatoMonto(fila.realMontoAcumulado) : '—',
    ]),
  });
  doc.save('informe-avance-obra.pdf');
}
