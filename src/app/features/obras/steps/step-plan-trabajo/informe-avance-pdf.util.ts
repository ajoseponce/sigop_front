import { jsPDF } from 'jspdf';
import { RowInput, autoTable } from 'jspdf-autotable';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../../shared/pdf/pdf-header.util';

export interface InformeAvancePdfFila {
  mes: number;
  proyectadoParcial: number;
  proyectadoAcumulado: number;
  proyectadoMontoParcial: number;
  proyectadoMontoAcumulado: number;
  realParcial: number;
  realAcumulado: number;
  realMontoParcial: number;
  realMontoAcumulado: number;
  deduccionesParcial: number;
  deduccionesAcumuladas: number;
  deduccionAnticipoAcumulada: number;
  inversionRealAcumuladaBase: number;
  readecuacionesParcial: number;
  readecuacionesAcumuladas: number;
  pagoAcumulado: number;
  realDisponible: boolean;
}

export interface InformeAvancePdfRubro {
  rubroRef: string;
  nombre: string;
  monto: number;
  incidencia: number;
  porcentajes: number[];
  reales: number[];
}

export interface InformeAvancePdfData {
  nombreObra: string;
  numeroContrato?: string;
  fechaInicio?: string | null;
  totalContrato: number;
  anticipoFinanciero: number;
  rubros: InformeAvancePdfRubro[];
  filas: InformeAvancePdfFila[];
}

const money = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatoMonto(value: number): string {
  return `$ ${money.format(value)}`;
}

function encabezado(doc: jsPDF, cabecera: string, data: InformeAvancePdfData, titulo: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 10;
  const right = 10;
  const width = pageWidth - left - right;
  const inicio = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.5) + 2;
  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.rect(left, inicio, width, 8);
  doc.text(titulo.toLocaleUpperCase('es-AR'), left + width / 2, inicio + 5.3, { align: 'center' });

  // Misma composición compacta de los imprimibles de certificación.
  const datosY = inicio + 9.5;
  doc.setFontSize(6.8);
  doc.rect(left, datosY, width, 14);
  const obra = (data.nombreObra || '—').toLocaleUpperCase('es-AR');
  const inicioObra = data.fechaInicio ? data.fechaInicio.slice(0, 10).split('-').reverse().join('-') : '—';
  doc.text(`Obra: ${obra}`, left + 2, datosY + 4.7, { maxWidth: width * 0.62 });
  doc.text(`Concurso N°: ${data.numeroContrato || '—'}`, left + 2, datosY + 9.4);
  doc.text(`Inicio: ${inicioObra}`, left + width - 2, datosY + 4.7, { align: 'right' });
  doc.text(`Monto contrato: ${formatoMonto(data.totalContrato)}`, left + width - 2, datosY + 9.4, { align: 'right' });
  return inicio + 27;
}

function pie(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 10;
  const right = 10;
  const cargos = [
    'Representante legal',
    'Representante técnico',
    'Inspector de obra',
    'Directora de Construcciones',
    'Secretario de Obras y Servicios Públicos',
  ];
  const anchoFirma = (pageWidth - left - right) / cargos.length;
  const pieY = pageHeight - 24;
  doc.setDrawColor(55, 65, 81);
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  cargos.forEach((cargo, index) => {
    const x = left + anchoFirma * index;
    const centro = x + anchoFirma / 2;
    doc.line(x + 3, pieY, x + anchoFirma - 3, pieY);
    doc.text(doc.splitTextToSize(cargo, anchoFirma - 5), centro, pieY + 4, { align: 'center' });
  });
  doc.setFontSize(6.5);
  doc.setTextColor(55, 65, 81);
  doc.text(['INSPECCIÓN DE OBRAS', 'DIRECCIÓN DE CONSTRUCCIONES'], 12, pageHeight - 12);
  doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 12, pageHeight - 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

export async function crearInformeAvancePdf(data: InformeAvancePdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const maxMesesPorPagina = 9;
  const gruposMeses = Array.from(
    { length: Math.ceil(data.filas.length / maxMesesPorPagina) || 1 },
    (_, indice) => data.filas.slice(indice * maxMesesPorPagina, (indice + 1) * maxMesesPorPagina),
  );

  gruposMeses.forEach((grupo, indiceGrupo) => {
    if (indiceGrupo > 0) doc.addPage();
    const tablaY = encabezado(doc, cabecera, data, 'PLAN DE TRABAJO');
    const head = [['Rubro', 'Descripción', 'Monto', '%', 'Real / Proy.', ...grupo.map((fila) => `Mes ${fila.mes}`)]];
    const body: RowInput[] = data.rubros.flatMap((rubro) => [
      [
        rubro.rubroRef,
        rubro.nombre,
        formatoMonto(rubro.monto),
        `${percent.format(rubro.incidencia)}%`,
        'REAL',
        ...grupo.map((fila) => {
          const valor = rubro.reales[fila.mes - 1] ?? 0;
          return valor > 0 ? `${percent.format(valor)}%` : '';
        }),
      ],
      [
        '', '', '', '', 'PROYECTADO',
        ...grupo.map((fila) => `${percent.format(rubro.porcentajes[fila.mes - 1] ?? 0)}%`),
      ],
    ]);
    body.push([
      { content: 'TOTAL OBRA', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: '100,00%', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: 'PROYECTADO', styles: { fontStyle: 'bold', halign: 'center' } },
      ...grupo.map((fila) => ({ content: `${percent.format(fila.proyectadoParcial)}%`, styles: { fontStyle: 'bold' as const, halign: 'right' as const } })),
    ]);
    // Separa el plan por rubro del resumen físico-financiero.
    body.push([{ content: '', colSpan: 5 + grupo.length, styles: { minCellHeight: 10, lineWidth: 0 } }]);
    const filaResumen = (etiqueta: string, valores: string[], destacado = false): RowInput => [
      { content: etiqueta, colSpan: 3, styles: { fontStyle: destacado ? 'bold' as const : 'normal' as const, halign: destacado ? 'center' as const : 'left' as const, fillColor: destacado ? [226, 232, 240] as [number, number, number] : undefined } },
      { content: '', styles: { fillColor: destacado ? [226, 232, 240] as [number, number, number] : undefined } },
      { content: '', styles: { fillColor: destacado ? [226, 232, 240] as [number, number, number] : undefined } },
      ...valores.map((valor) => ({ content: valor, styles: { halign: 'right' as const, fontStyle: destacado ? 'bold' as const : 'normal' as const, fillColor: destacado ? [226, 232, 240] as [number, number, number] : undefined } })),
    ];
    body.push(
      filaResumen('Avance mensual proyectado', grupo.map((fila) => `${percent.format(fila.proyectadoParcial)}%`)),
      filaResumen('Avance mensual acumulado proyectado', grupo.map((fila) => `${percent.format(fila.proyectadoAcumulado)}%`)),
      filaResumen('Inversión mensual proyectada', grupo.map((fila) => formatoMonto(fila.proyectadoMontoParcial))),
      filaResumen('Inversión mensual acumulada proyectada', grupo.map((fila) => formatoMonto(fila.proyectadoMontoAcumulado))),
      filaResumen('Avance mensual real', grupo.map((fila) => fila.realDisponible ? `${percent.format(fila.realParcial)}%` : '')),
      filaResumen('Avance mensual acumulado real', grupo.map((fila) => fila.realDisponible ? `${percent.format(fila.realAcumulado)}%` : '')),
      filaResumen('INVERSIONES', grupo.map(() => ''), true),
      filaResumen('Anticipo financiero', grupo.map((fila) => fila.mes === 1 && data.anticipoFinanciero > 0 ? formatoMonto(data.anticipoFinanciero) : ''), true),
      filaResumen('Inversión mensual real a precio base', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.realMontoParcial) : '')),
      filaResumen('Deducciones legales (anticipo financiero + fondo de reparo)', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.deduccionesParcial) : '')),
      filaResumen('Inversión real acumulada (certificados básicos)', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.realMontoAcumulado) : '')),
      filaResumen('Readecuaciones de precios', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.readecuacionesParcial) : '')),
      filaResumen('Inversión real acumulada a precios base', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.inversionRealAcumuladaBase) : '')),
      filaResumen('Inversión real acumulada neta', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.pagoAcumulado) : ''), true),
    );
    autoTable(doc, {
      startY: tablaY,
      // Reservar la cabecera y el pie con firmas también en las páginas de continuación.
      margin: { top: tablaY, left: 10, right: 10, bottom: 42 },
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 5.4, cellPadding: 1, valign: 'middle' },
      headStyles: { fillColor: [255, 255, 255], textColor: [17, 24, 39], lineColor: [31, 41, 55], lineWidth: 0.3, halign: 'center', fontStyle: 'bold' },
      bodyStyles: { lineColor: [75, 85, 99], lineWidth: 0.18 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 48, halign: 'left' },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 12, halign: 'right' },
        4: { cellWidth: 22, halign: 'center' },
        ...Object.fromEntries(grupo.map((_, posicion) => [posicion + 5, { cellWidth: 16, halign: 'right' as const }])),
      },
      didDrawPage: ({ pageNumber }) => {
        if (pageNumber > 1) encabezado(doc, cabecera, data, 'PLAN DE TRABAJO');
        pie(doc);
      },
    });
  });

  doc.addPage();
  const chartTop = encabezado(doc, cabecera, data, 'CURVA DE INVERSIÓN');
  const pageWidth = doc.internal.pageSize.getWidth();
  const chartLeft = 25;
  const chartWidth = pageWidth - 50;
  const chartHeight = 105;
  const montoMaximo = Math.max(data.totalContrato, ...data.filas.map((fila) => Math.max(fila.proyectadoMontoAcumulado, fila.realMontoAcumulado)), 1);
  const escala = (valor: number) => chartTop + chartHeight - chartHeight * valor / montoMaximo;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  for (let division = 0; division <= 5; division += 1) {
    const monto = montoMaximo * division / 5;
    const y = escala(monto);
    doc.setDrawColor(220, 224, 230);
    doc.line(chartLeft, y, chartLeft + chartWidth, y);
    doc.setTextColor(75, 85, 99);
    doc.text(formatoMonto(monto), chartLeft - 3, y + 1.8, { align: 'right' });
  }
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
      const monto = tipo === 'proyectado' ? fila.proyectadoMontoAcumulado : fila.realMontoAcumulado;
      const actual = { x: chartLeft + chartWidth * (indice + 1) / data.filas.length, y: escala(monto) };
      doc.line(anterior.x, anterior.y, actual.x, actual.y);
      doc.circle(actual.x, actual.y, 1.2, 'F');
      doc.setTextColor(...color);
      doc.setFontSize(5.3);
      doc.text(formatoMonto(monto), actual.x, Math.max(chartTop + 3, actual.y + (tipo === 'proyectado' ? -3.5 : 6)), { align: 'center' });
      anterior = actual;
    });
  };
  dibujarCurva('proyectado', [234, 88, 12]);
  dibujarCurva('real', [37, 99, 235]);

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(6.5);
  data.filas.forEach((fila, indice) => {
    const x = chartLeft + chartWidth * (indice + 1) / data.filas.length;
    doc.text(`Mes ${fila.mes}`, x, chartTop + chartHeight + 5, { align: 'center' });
  });
  doc.setFillColor(234, 88, 12);
  doc.rect(pageWidth / 2 - 34, chartTop + chartHeight + 12, 5, 1.3, 'F');
  doc.text('Proyectado', pageWidth / 2 - 27, chartTop + chartHeight + 13.3);
  doc.setFillColor(37, 99, 235);
  doc.rect(pageWidth / 2 + 9, chartTop + chartHeight + 12, 5, 1.3, 'F');
  doc.text('Real certificado', pageWidth / 2 + 16, chartTop + chartHeight + 13.3);

  pie(doc);
  return doc;
}

export async function descargarInformeAvancePdf(data: InformeAvancePdfData): Promise<void> {
  (await crearInformeAvancePdf(data)).save('plan-de-trabajo-y-curva-de-inversion.pdf');
}
