import { jsPDF } from 'jspdf';

const HEADER_URL = 'assets/cabecera_informes.jpeg';
const HEADER_RATIO = 1600 / 190;
let headerPromise: Promise<string> | null = null;

export function cargarCabeceraInstitucional(): Promise<string> {
  if (!headerPromise) {
    headerPromise = fetch(HEADER_URL)
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar la cabecera institucional');
        return response.blob();
      })
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }));
  }
  return headerPromise;
}

export function dibujarCabeceraInstitucional(
  doc: jsPDF,
  image: string,
  left = 10,
  right = 10,
  scale = 1,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - left - right;
  const width = availableWidth * scale;
  const height = width / HEADER_RATIO;
  const x = left + (availableWidth - width) / 2;
  doc.addImage(image, 'JPEG', x, 5, width, height, undefined, 'FAST');
  return 5 + height;
}
