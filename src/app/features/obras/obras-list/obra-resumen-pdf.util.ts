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

const fecha = (valor: string | null | undefined): string => {
  if (!valor) return '—';
  const resultado = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
  return Number.isNaN(resultado.getTime()) ? '—' : new Intl.DateTimeFormat('es-AR').format(resultado);
};

const texto = (valor: unknown): string => valor === null || valor === undefined || valor === '' ? '—' : String(valor);

const ubicacionCompleta = (obra: any): string => {
  const partes = [obra.calles, obra.localidad, obra.municipio, obra.departamento]
    .filter((parte) => parte !== null && parte !== undefined && String(parte).trim() !== '')
    .map((parte) => String(parte).trim());
  return partes.length ? partes.join(' - ') : '—';
};

const totalizar = (valores: any[], selector: (valor: any) => unknown): number =>
  valores.reduce((total, valor) => total + numero(selector(valor)), 0);

const finalTabla = (doc: jsPDF, alternativo: number): number =>
  (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? alternativo;

function encabezadoSeccion(doc: jsPDF, titulo: string, y: number, left: number, width: number): number {
  doc.setFillColor(22, 62, 80);
  doc.rect(left, y, width, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(titulo, left + 2, y + 4.7);
  doc.setTextColor(17, 24, 39);
  return y + 9;
}

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
  const certificadosBasicos = certificados
    .filter((certificado) => certificado.tipo === 'OBRA')
    .sort((a, b) => a.numero - b.numero);
  const aprobados = certificadosBasicos.filter((certificado) => certificado.estado === 'APROBADO');
  const certificadosRedeterminados = certificadosBasicos.filter((certificado) => certificado.readecuacion?.estado === 'APROBADO');
  const brutoAcumulado = totalizar(aprobados, certificado => certificado.montoBruto);
  const netoAcumulado = totalizar(aprobados, certificado => certificado.montoFinal);
  const anticipoOtorgado = totalizar(
    certificados.filter((certificado) => certificado.tipo === 'ANTICIPO_FINANCIERO' && certificado.estado === 'APROBADO'),
    certificado => certificado.montoBruto,
  );
  const anticipoDeducido = totalizar(aprobados, certificado => certificado.deduccionAnticipo);
  const fondoReparo = totalizar(aprobados, certificado => certificado.deduccionFondoReparo);
  const redeterminadoBruto = totalizar(certificadosRedeterminados, certificado => certificado.readecuacion?.incremento);
  const redeterminadoNeto = totalizar(certificadosRedeterminados, certificado => certificado.readecuacion?.incrementoNetoPagar);
  const redeterminadoFondoReparo = totalizar(certificadosRedeterminados, certificado => certificado.readecuacion?.deduccionFondoReparo);
  const fisico = avanceFisico(contrato, certificados);
  const financiero = total > 0 ? brutoAcumulado * 100 / total : 0;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const left = 8;
  const right = 8;
  const ancho = doc.internal.pageSize.getWidth();
  const width = ancho - left - right;
  const inicio = dibujarCabeceraInstitucional(doc, cabecera, left, right, 0.5) + 2;

  doc.setFillColor(22, 62, 80);
  doc.rect(left, inicio, width, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INFORME DE OBRA', left + 2, inicio + 5.4);
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(10.5);
  doc.text(`Obra: ${texto(obra.nombre)}`, left + 2, inicio + 14);

  let y = inicio + 17;
  autoTable(doc, {
    startY: y,
    margin: { left, right },
    theme: 'grid',
    styles: { fontSize: 5.7, cellPadding: 1.2, valign: 'middle', lineColor: [174, 185, 190] },
    headStyles: { fillColor: [232, 239, 241], textColor: [37, 54, 63], fontStyle: 'bold' },
    head: [['IDENTIFICACIÓN', 'CONTRATO Y PLAZOS', 'SITUACIÓN A LA FECHA']],
    body: [[
      [`Expediente madre: ${texto(obra.expediente)}${obra.anioEmision ? `/${obra.anioEmision}` : ''}`, `Contratista: ${texto(obra.empresa?.razonSocial)}`, `CUIT: ${texto(obra.empresa?.cuit)}`, `Ubicación: ${ubicacionCompleta(obra)}`, `Procedimiento: ${texto(obra.modalidadContratacion?.nombre ?? obra.referenciaContratacion)}`].join('\n'),
      [`Contrato: ${texto(contrato?.numeroContrato)}`, `Monto contractual: ${monto(total)}`, `Plazo original: ${contrato?.plazoObraDias ? `${contrato.plazoObraDias} días` : '—'} - Replanteo: ${fecha(obra.fechaInicio ?? contrato?.vigenciaDesde)}`, `Anticipo financiero: ${monto(anticipoOtorgado || obra.montoAnticipo)} (${texto(obra.porcentajeAnticipo)}%)`].join('\n'),
      [`Estado de obra: ${texto(obra.estadoSeguimiento?.nombre ?? obra.estadoActual ?? obra.estado)}`, `Avance físico: ${percent.format(fisico)}%`, `Bruto certificado: ${monto(brutoAcumulado + redeterminadoBruto)}`, `Neto certificado: ${monto(netoAcumulado + redeterminadoNeto)}`].join('\n'),
    ]],
  });

  y = encabezadoSeccion(doc, '01 | HITOS DE PLAZOS', finalTabla(doc, y) + 3, left, width);
  const hitos: string[][] = [];
  if (obra.fechaAmpliacionPlazo) hitos.push(['Ampliación de plazo', texto(obra.modificacion), fecha(obra.fechaAmpliacionPlazo), contrato?.plazoObraDias ? `${contrato.plazoObraDias} días contractuales` : '—']);
  if (obra.fechaNeutralizacion || obra.fechaReinicio) hitos.push(['Neutralización / reinicio', texto(obra.modificacion), `${fecha(obra.fechaNeutralizacion)} / ${fecha(obra.fechaReinicio)}`, 'Período informado en seguimiento']);
  autoTable(doc, {
    startY: y, margin: { left, right }, theme: 'grid', styles: { fontSize: 5.8, cellPadding: 1.3 },
    headStyles: { fillColor: [232, 239, 241], textColor: [37, 54, 63], fontStyle: 'bold' }, head: [['Hito', 'Acto / respaldo', 'Fecha efectiva', 'Plazo / efecto']],
    body: hitos.length ? hitos : [['Sin hitos de plazo informados', '—', '—', '—']],
  });

  y = encabezadoSeccion(doc, '02 | CERTIFICADOS BÁSICOS', finalTabla(doc, y) + 3, left, width);
  let brutoAcum = 0; let afAcum = 0; let frAcum = 0;
  const filasBasicos = certificadosBasicos.map((certificado) => {
    brutoAcum += numero(certificado.montoBruto); afAcum += numero(certificado.deduccionAnticipo); frAcum += numero(certificado.deduccionFondoReparo);
    return [`N° ${certificado.numero} / ${periodo(certificado.periodo)}`, texto(certificado.estado), monto(certificado.montoBruto), monto(brutoAcum), monto(certificado.deduccionAnticipo), monto(afAcum), monto(certificado.montoPostAnticipo), monto(certificado.deduccionFondoReparo), monto(frAcum), `${percent.format(financiero)}%`, 'Original', texto(certificado.nomenclaturaExpediente ?? certificado.numeroExpediente), '—'];
  });
  filasBasicos.push(['TOTAL BÁSICOS', '', monto(brutoAcum), '', monto(afAcum), '', monto(totalizar(certificadosBasicos, certificado => certificado.montoPostAnticipo)), monto(frAcum), '', '', '', '', '']);
  autoTable(doc, {
    startY: y, margin: { left, right }, theme: 'grid', styles: { fontSize: 4.55, cellPadding: 0.9, overflow: 'linebreak' },
    headStyles: { fillColor: [232, 239, 241], textColor: [37, 54, 63], fontStyle: 'bold', halign: 'center' },
    head: [['Cert. / período', 'Estado', 'Bruto', 'Bruto acum.', 'Deducción AF', 'AF deducido acum.', 'Neto cert.', 'Fondo reparo', 'FR acum.', 'Avance mes %', 'Etapa plazo', 'Expte. cert.', 'OP']], body: filasBasicos.length > 1 || certificadosBasicos.length ? filasBasicos : [['—', 'No hay certificados básicos cargados', '', '', '', '', '', '', '', '', '', '', '']],
  });

  y = encabezadoSeccion(doc, '03 | CERTIFICADOS REDETERMINADOS', finalTabla(doc, y) + 3, left, width);
  let redeterminadoAcum = 0; let redeterminadoFrAcum = 0;
  const filasRedeterminados = certificadosRedeterminados.map((certificado) => {
    const redeterminacion = certificado.readecuacion;
    redeterminadoAcum += numero(redeterminacion?.incremento); redeterminadoFrAcum += numero(redeterminacion?.deduccionFondoReparo);
    return [`N° ${certificado.numero} / ${periodo(certificado.periodo)}`, texto(certificado.estado), monto(redeterminacion?.incremento), monto(redeterminadoAcum), 'No aplica', 'No aplica', monto(redeterminacion?.incrementoNetoPagar), monto(redeterminacion?.deduccionFondoReparo), monto(redeterminadoFrAcum), 'No aplica', 'Original', texto(certificado.nomenclaturaExpediente ?? certificado.numeroExpediente), '—'];
  });
  filasRedeterminados.push(['TOTAL REDETERM.', '', monto(redeterminadoBruto), '', 'No aplica', 'No aplica', monto(redeterminadoNeto), monto(redeterminadoFondoReparo), '', 'No aplica', '', '', '']);
  autoTable(doc, {
    startY: y, margin: { left, right }, theme: 'grid', styles: { fontSize: 4.55, cellPadding: 0.9, overflow: 'linebreak' },
    headStyles: { fillColor: [232, 239, 241], textColor: [37, 54, 63], fontStyle: 'bold', halign: 'center' },
    head: [['Cert. / período', 'Estado', 'Bruto', 'Bruto acum.', 'Deducción AF', 'AF deducido acum.', 'Neto cert.', 'Fondo reparo', 'FR acum.', 'Avance mes %', 'Etapa plazo', 'Expte. cert.', 'OP']], body: certificadosRedeterminados.length ? filasRedeterminados : [['—', 'No hay certificados redeterminados cargados', '', '', '', '', '', '', '', '', '', '', '']],
  });

  y = encabezadoSeccion(doc, '04 | RESUMEN FINAL', finalTabla(doc, y) + 3, left, width);
  autoTable(doc, {
    startY: y, margin: { left, right }, theme: 'grid', styles: { fontSize: 6, cellPadding: 1.4, valign: 'middle' },
    headStyles: { fillColor: [232, 239, 241], textColor: [37, 54, 63], fontStyle: 'bold' },
    head: [['ANTICIPO Y SALDO DE OBRA A PRECIOS BASE', 'CERTIFICACIÓN Y RETENCIONES']],
    body: [[
      [`Anticipo financiero otorgado: ${monto(anticipoOtorgado || obra.montoAnticipo)}`, `Total deducido de AF: ${monto(anticipoDeducido)}`, `AF pendiente de deducción: ${monto(Math.max((anticipoOtorgado || numero(obra.montoAnticipo)) - anticipoDeducido, 0))}`, `Monto pendiente de ejecución a precios base: ${monto(Math.max(total - brutoAcumulado, 0))}`].join('\n'),
      [`Total bruto certificado (básicos + redeterminados): ${monto(brutoAcumulado + redeterminadoBruto)}`, `Total deducción de anticipo financiero: ${monto(anticipoDeducido)}`, `Total fondo de reparo retenido: ${monto(fondoReparo + redeterminadoFondoReparo)}`, `Total neto certificado (básicos + redeterminados): ${monto(netoAcumulado + redeterminadoNeto)}`].join('\n'),
    ]],
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
