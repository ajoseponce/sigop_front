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
  inversionRealAcumulada: number;
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
  expediente?: string | null;
  anioEmision?: number | null;
  numeroCertificado?: number | null;
  periodoCertificado?: string | null;
  plazoObraDias?: number | null;
  localidad?: string | null;
  ubicacion?: string | null;
  empresa?: string | null;
  empresaCuit?: string | null;
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

function formatoPeriodo(value?: string | null): string {
  if (!value) return '—';
  const fecha = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(fecha);
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
  doc.setFontSize(8);
  doc.rect(left, inicio, width, 7);
  doc.text(titulo.toLocaleUpperCase('es-AR'), left + width / 2, inicio + 4.7, { align: 'center' });
  doc.rect(left, inicio + 8.5, width, 7);
  doc.text(`Obra: ${data.nombreObra || '—'}`, left + 2, inicio + 13.2);

  const datosY = inicio + 17;
  const col1 = left + width / 3;
  const col2 = left + width * 2 / 3;
  doc.rect(left, datosY, col1 - left, 31);
  doc.rect(col1, datosY, col2 - col1, 31);
  doc.rect(col2, datosY, left + width - col2, 31);
  doc.setFontSize(5.7);
  const fecha = (value?: string | null) => value ? value.slice(0, 10).split('-').reverse().join('-') : '—';
  const fila = (label: string, value: string, x: number, y: number, ancho: number) => {
    doc.text(label, x, y);
    doc.text(doc.splitTextToSize(value, ancho)[0] ?? '—', x + 30, y);
  };
  fila('Organismo otorgante', 'Municipalidad de Posadas', left + 2, datosY + 4.5, col1 - left - 34);
  fila('Expediente madre N°', `${data.expediente ?? '—'}${data.anioEmision ? ` / ${data.anioEmision}` : ''}`, left + 2, datosY + 8.6, col1 - left - 34);
  fila('Programa', 'Municipal', left + 2, datosY + 12.7, col1 - left - 34);
  fila('Localidad', data.localidad ?? 'Posadas - Misiones', left + 2, datosY + 16.8, col1 - left - 34);
  fila('Ubicación', data.ubicacion ?? '—', left + 2, datosY + 20.9, col1 - left - 34);
  fila('Monto total', formatoMonto(data.totalContrato), col1 + 2, datosY + 4.5, col2 - col1 - 34);
  fila('Monto municipio', formatoMonto(data.totalContrato), col1 + 2, datosY + 8.6, col2 - col1 - 34);
  fila('Modo de ejecución', data.numeroContrato ? `Concurso ${data.numeroContrato}` : 'Concurso', col1 + 2, datosY + 12.7, col2 - col1 - 34);
  fila('Empresa', data.empresa ?? '—', col1 + 2, datosY + 16.8, col2 - col1 - 34);
  fila('CUIT', data.empresaCuit ?? '—', col1 + 2, datosY + 20.9, col2 - col1 - 34);
  fila('Certificado N°', data.numeroCertificado ? String(data.numeroCertificado) : '—', col2 + 2, datosY + 4.5, left + width - col2 - 34);
  fila('Fecha de replanteo', fecha(data.fechaInicio), col2 + 2, datosY + 8.6, left + width - col2 - 34);
  fila('Plazo de ejecución', data.plazoObraDias ? `${data.plazoObraDias} días` : '—', col2 + 2, datosY + 12.7, left + width - col2 - 34);
  fila('Período', formatoPeriodo(data.periodoCertificado), col2 + 2, datosY + 16.8, left + width - col2 - 34);
  return inicio + 50;
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
      filaResumen('Anticipo financiero', grupo.map((fila) => fila.mes === 1 && data.anticipoFinanciero > 0 ? formatoMonto(data.anticipoFinanciero) : '')),
      filaResumen('Inversión mensual real a precio base', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.realMontoParcial) : '')),
      filaResumen('Deducción anticipo financiero', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.deduccionesParcial) : '')),
      filaResumen('Inversión real acumulada a precios base', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.inversionRealAcumuladaBase) : '')),
      filaResumen('Readecuaciones emitidas', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.readecuacionesAcumuladas) : '')),
      filaResumen('Inversión real acumulada', grupo.map((fila) => fila.realDisponible ? formatoMonto(fila.inversionRealAcumulada) : ''), true),
    );
    const anchoTabla = doc.internal.pageSize.getWidth() - 20;
    const anchoColumnasFijas = 12 + 60 + 25 + 12 + 20;
    const anchoMes = (anchoTabla - anchoColumnasFijas) / grupo.length;
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
        1: { cellWidth: 60, halign: 'left' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 12, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
        ...Object.fromEntries(grupo.map((_, posicion) => [posicion + 5, { cellWidth: anchoMes, halign: 'right' as const }])),
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
