import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../shared/pdf/pdf-header.util';

export interface ObraResumenPdfData {
  obra: any;
  certificados: any[];
}

const money = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const numero = (valor: unknown): number => {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
};

const monto = (valor: unknown): string => `$ ${money.format(numero(valor))}`;

const periodo = (valor: string | null | undefined): string => {
  if (!valor) return '—';
  const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);
  return Number.isNaN(fecha.getTime()) ? '—' : new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(fecha);
};

function contratoVigente(obra: any): any {
  return obra.contratos?.find((contrato: any) => contrato.tipo === 'ORIGINAL') ?? obra.contratos?.[0];
}

function totalContrato(contrato: any): number {
  return (contrato?.rubros ?? []).flatMap((rubro: any) => rubro.items ?? [])
    .reduce((total: number, item: any) => total + numero(item.cantidad) * numero(item.precioUnitario), 0);
}

function avanceFisico(contrato: any, certificados: any[]): number {
  const certificado = certificados
    .filter((item) => item.tipo === 'OBRA' && item.estado === 'APROBADO')
    .sort((a, b) => b.numero - a.numero)[0];
  if (!certificado) return 0;
  const detallePorItem = new Map<number, any>((certificado.detalles ?? []).map((detalle: any) => [detalle.itemId, detalle]));
  const items = (contrato?.rubros ?? []).flatMap((rubro: any) => rubro.items ?? []);
  const total = totalContrato(contrato);
  if (!total) return 0;
  return items.reduce((avance: number, item: any) => {
    const detalle = detallePorItem.get(item.id);
    const proporcion = numero(item.cantidad) > 0 ? Math.min(numero(detalle?.cantidadAcumulada) / numero(item.cantidad), 1) : 0;
    return avance + proporcion * numero(item.cantidad) * numero(item.precioUnitario);
  }, 0) * 100 / total;
}

export async function crearResumenObraPdf(data: ObraResumenPdfData): Promise<jsPDF> {
  const { obra, certificados } = data;
  const contrato = contratoVigente(obra);
  const total = totalContrato(contrato);
  const certificadosObra = certificados
    .filter((certificado) => certificado.tipo === 'OBRA')
    .sort((a, b) => a.numero - b.numero);
  const aprobados = certificadosObra.filter((certificado) => certificado.estado === 'APROBADO');
  const brutoAcumulado = aprobados.reduce((suma, certificado) => suma + numero(certificado.montoBruto), 0);
  const netoAcumulado = aprobados.reduce((suma, certificado) => suma + numero(certificado.montoFinal), 0);
  const fisico = avanceFisico(contrato, certificados);
  const financiero = total > 0 ? brutoAcumulado * 100 / total : 0;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const left = 10;
  const right = 10;
  const ancho = doc.internal.pageSize.getWidth();
  const width = ancho - left - right;
  const inicio = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.5) + 2;

  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.rect(left, inicio, width, 8);
  doc.text('INFORME RESUMIDO DE OBRA', left + width / 2, inicio + 5.3, { align: 'center' });
  doc.setFontSize(7.4);
  doc.rect(left, inicio + 9.5, width, 8);
  doc.text(`Obra: ${obra.nombre ?? '—'}`, left + 2, inicio + 14.7);

  const datosY = inicio + 19;
  const columna = width / 3;
  doc.rect(left, datosY, columna, 27);
  doc.rect(left + columna, datosY, columna, 27);
  doc.rect(left + columna * 2, datosY, columna, 27);
  doc.setFontSize(6.1);
  const fila = (etiqueta: string, valor: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(etiqueta, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(valor, columna - 37)[0] ?? '—', x + 32, y);
  };
  fila('Expediente', `${obra.expediente ?? '—'}${obra.anioEmision ? ` / ${obra.anioEmision}` : ''}`, left + 2, datosY + 4.5);
  fila('Empresa', obra.empresa?.razonSocial ?? '—', left + 2, datosY + 9);
  fila('CUIT', obra.empresa?.cuit ?? '—', left + 2, datosY + 13.5);
  fila('Localidad', obra.localidad ?? '—', left + 2, datosY + 18);
  fila('Contrato', contrato?.numeroContrato ?? '—', left + columna + 2, datosY + 4.5);
  fila('Monto contrato', monto(total), left + columna + 2, datosY + 9);
  fila('Plazo de obra', contrato?.plazoObraDias ? `${contrato.plazoObraDias} días` : '—', left + columna + 2, datosY + 13.5);
  fila('Estado', obra.estadoSeguimiento?.nombre ?? obra.estado ?? '—', left + columna + 2, datosY + 18);
  fila('Avance físico', `${percent.format(fisico)}%`, left + columna * 2 + 2, datosY + 4.5);
  fila('Avance financiero', `${percent.format(financiero)}%`, left + columna * 2 + 2, datosY + 9);
  fila('Bruto certificado', monto(brutoAcumulado), left + columna * 2 + 2, datosY + 13.5);
  fila('Neto a pagar', monto(netoAcumulado), left + columna * 2 + 2, datosY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Certificados cargados', left, datosY + 34);
  autoTable(doc, {
    startY: datosY + 36,
    margin: { left, right },
    theme: 'grid',
    styles: { fontSize: 5.6, cellPadding: 1.2, valign: 'middle' },
    headStyles: { fillColor: [226, 232, 240], textColor: [17, 24, 39], fontStyle: 'bold', halign: 'center' },
    head: [['Certificado', 'Período', 'Estado', 'Bruto', 'Anticipo', 'Fondo reparo', 'Neto']],
    body: certificadosObra.length
      ? certificadosObra.map((certificado) => [
        `N° ${certificado.numero}`,
        periodo(certificado.periodo),
        certificado.estado,
        monto(certificado.montoBruto),
        `- ${monto(certificado.deduccionAnticipo)}`,
        `- ${monto(certificado.deduccionFondoReparo)}`,
        monto(certificado.montoFinal),
      ])
      : [['—', 'No hay certificados de obra cargados', '—', '—', '—', '—', '—']],
    columnStyles: {
      0: { halign: 'center', cellWidth: 21 },
      1: { cellWidth: 28 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 29 },
      4: { halign: 'right', cellWidth: 29 },
      5: { halign: 'right', cellWidth: 29 },
      6: { halign: 'right', cellWidth: 29 },
    },
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(`SIGOP - Informe emitido el ${new Intl.DateTimeFormat('es-AR').format(new Date())}`, left, doc.internal.pageSize.getHeight() - 7);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - right, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
  }
  return doc;
}

export async function descargarResumenObraPdf(data: ObraResumenPdfData): Promise<void> {
  const doc = await crearResumenObraPdf(data);
  const nombre = String(data.obra.nombre ?? 'obra').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'obra';
  doc.save(`informe-resumen-${nombre}.pdf`);
}
