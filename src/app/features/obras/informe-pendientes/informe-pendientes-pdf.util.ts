import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../shared/pdf/pdf-header.util';

export interface InformePendienteFila {
  anio: number | null; contratacion: string; obra: string; empresa: string; estadoActual: string;
  avanceFisicoAcumulado: number; avanceFinancieroAcumulado: number; montoAnticipoCertificado: number; deudaAnticipoFinanciero: number; montoPendiente: number; avancePendiente: number; observaciones: string;
}
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
export async function crearInformePendientesPdf(filas: InformePendienteFila[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const startY = dibujarCabeceraInstitucional(doc, cabecera, 10, 10, .5) + 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('INFORME · OBRAS PENDIENTES DE EJECUCIÓN', doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
  autoTable(doc, { startY: startY + 4, margin: { left: 8, right: 8 }, theme: 'grid', styles: { fontSize: 6, cellPadding: 1.4, valign: 'middle' },
    head: [['Año', 'Forma de contratación', 'Nombre de la obra', 'Empresa', 'Evolución de la obra', 'Monto pendiente', 'Avance pendiente', 'Observaciones']],
    body: filas.map(fila => [fila.anio ?? '—', fila.contratacion, fila.obra, fila.empresa, `1. Avance físico acumulado: ${fila.avanceFisicoAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}%\n2. Avance financiero acumulado: ${money.format(fila.avanceFinancieroAcumulado)}\n3. Anticipo certificado: ${money.format(fila.montoAnticipoCertificado)}\n4. Deuda de anticipo: ${money.format(fila.deudaAnticipoFinanciero)}\n5. Estado actual: ${fila.estadoActual}`, money.format(fila.montoPendiente), `${fila.avancePendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}%`, fila.observaciones || '—']),
    foot: [['', '', '', '', 'TOTAL FINANCIAMIENTO PENDIENTE', money.format(filas.reduce((total, fila) => total + fila.montoPendiente, 0)), '', '']],
    headStyles: { fillColor: [224, 224, 224], textColor: [0, 0, 0], fontStyle: 'bold' }, footStyles: { fillColor: [224, 224, 224], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 29 }, 2: { cellWidth: 33 }, 3: { cellWidth: 27 }, 4: { cellWidth: 52 }, 5: { cellWidth: 29 }, 6: { cellWidth: 22 }, 7: { cellWidth: 55 } },
  });
  return doc;
}
