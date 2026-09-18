import { jsPDF } from 'jspdf';
import { cargarCabeceraInstitucional, dibujarCabeceraInstitucional } from '../../../shared/pdf/pdf-header.util';

export interface HallazgoInforme {
  estado: 'APROBADO' | 'A_CORREGIR' | 'A_ACLARAR';
  texto: string;
  referencias: string[];
}

export interface InformeTecnico {
  fechaInforme: string;
  obra: string;
  empresa: string;
  montoOfertado: number | null;
  presupuestoOficial: number | null;
  computoPresupuesto: HallazgoInforme[];
  planTrabajo: HallazgoInforme[];
  analisisPrecios: HallazgoInforme[];
  conclusion: string;
}

const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

export async function descargarInformeTecnico(informe: InformeTecnico): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cabecera = await cargarCabeceraInstitucional();
  const margen = 20;
  const ancho = doc.internal.pageSize.getWidth() - margen * 2;
  let y = dibujarCabeceraInstitucional(doc, cabecera, margen, margen, 0.5) + 9;

  const nuevaPagina = () => {
    doc.addPage();
    y = dibujarCabeceraInstitucional(doc, cabecera, margen, margen, 0.5) + 9;
  };
  const asegurar = (alto: number) => { if (y + alto > 277) nuevaPagina(); };
  const texto = (valor: string, options: { bold?: boolean; size?: number; indent?: number } = {}) => {
    const indent = options.indent ?? 0;
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(options.size ?? 10);
    const lineas = doc.splitTextToSize(valor, ancho - indent);
    asegurar(lineas.length * 5 + 2);
    doc.text(lineas, margen + indent, y);
    y += lineas.length * 5 + 2;
  };
  const seccion = (titulo: string, hallazgos: HallazgoInforme[]) => {
    asegurar(13);
    y += 3;
    texto(titulo, { bold: true, size: 12 });
    hallazgos.forEach((hallazgo) => {
      texto(`• ${hallazgo.estado.replace('_', ' ')}: ${hallazgo.texto}`, { indent: 3 });
      if (hallazgo.referencias?.length) texto(`Referencia: ${hallazgo.referencias.join('; ')}`, { indent: 8, size: 8 });
    });
  };

  doc.setProperties({ title: `Informe técnico - ${informe.obra}`, creator: 'SIGOP' });
  texto(informe.fechaInforme || new Date().toLocaleDateString('es-AR'), { bold: true });
  y += 2;
  texto(`Obra: ${informe.obra}`, { bold: true });
  texto(`Empresa: ${informe.empresa}`, { bold: true });
  texto(`Monto ofertado: ${informe.montoOfertado == null ? 'No determinado' : moneda.format(informe.montoOfertado)}`);
  texto(`Presupuesto oficial: ${informe.presupuestoOficial == null ? 'No determinado' : moneda.format(informe.presupuestoOficial)}`);
  seccion('Cómputo y presupuesto', informe.computoPresupuesto);
  seccion('Plan de trabajo y curva de inversión', informe.planTrabajo);
  seccion('Análisis de precios', informe.analisisPrecios);
  y += 3;
  texto('Conclusión', { bold: true, size: 12 });
  texto(informe.conclusion);
  doc.save(`informe-tecnico-${slug(informe.obra)}.pdf`);
}

function slug(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}
