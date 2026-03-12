import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDFS_DIR = path.join(__dirname, '..', '..', 'uploads', 'jobs', 'pdfs');

function ensurePdfDir() {
  if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true });
}

const METODO_PAGO_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  contado: 'Contado',
  pagado: 'Pagado',
  por_pagar: 'Por pagar'
};

const ESTADO_PAGO_LABELS = {
  recepcionado: 'Recepcionado',
  pendiente: 'Pendiente de pago'
};

/**
 * Genera PDF comprobante de pago por servicio.
 * @param {object} job - Datos del trabajo con job_service_name
 * @param {string} technicianName
 * @param {string} companyName
 * @returns {Buffer} PDF en bytes
 */
export async function generateComprobantePdf(job, technicianName, companyName = 'Hidrourgencias SpA') {
  ensurePdfDir();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const lineHeight = 14;
  let y = pageHeight - margin;

  const addText = (text, bold = false, size = 11, x = margin) => {
    const f = bold ? fontBold : font;
    page.drawText(text, {
      x,
      y,
      size,
      font: f,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= lineHeight;
  };

  const addLine = (label, value) => {
    addText(`${label}: `, true, 10);
    const labelWidth = fontBold.widthOfTextAtSize(`${label}: `, 10);
    page.drawText(String(value || '-'), {
      x: margin + labelWidth,
      y: y + lineHeight,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2)
    });
    y -= lineHeight;
  };

  const page = doc.addPage([pageWidth, pageHeight]);
  y = pageHeight - margin;

  // ENCABEZADO
  addText('COMPROBANTE DE PAGO POR SERVICIO', true, 16);
  addText(companyName, true, 12);
  addText(`Fecha de emisión: ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, false, 10);
  addText(`N° Comprobante: COMP-${String(job.id).padStart(6, '0')}`, false, 10);
  y -= lineHeight;

  // DATOS DEL SERVICIO
  addText('── DATOS DEL SERVICIO ──', true, 11);
  addLine('Ticket ID', job.id);
  addLine('Cliente', job.client_name);
  const dir = [job.address_street, job.address_number, job.address_comuna].filter(Boolean).join(', ') || '-';
  addLine('Dirección servicio', dir);
  addLine('Descripción del trabajo', job.job_service_name || job.notes || '-');
  addLine('Fecha del servicio', job.date);
  y -= lineHeight;

  // DATOS DEL TÉCNICO
  addText('── DATOS DEL TÉCNICO ──', true, 11);
  addLine('Nombre', technicianName);
  addLine('ID Técnico', job.technician_id);
  y -= lineHeight;

  // DETALLE DE PAGO
  addText('── DETALLE DE PAGO ──', true, 11);
  addLine('Monto pagado al técnico', job.technician_payment ? `$${Number(job.technician_payment).toLocaleString('es-CL')}` : '$0');
  const metodoKey = (job.admin_payment_method || 'por_pagar').toLowerCase().replace(/\s/g, '_');
  addLine('Método de pago', METODO_PAGO_LABELS[metodoKey] || job.admin_payment_method || 'Por pagar');
  const estadoKey = (job.estado_pago_tecnico || 'pendiente').toLowerCase();
  addLine('Estado del pago', ESTADO_PAGO_LABELS[estadoKey] || 'Pendiente de pago');
  y -= lineHeight;

  // Destaque del estado
  addText('Estado del pago:', true, 11);
  const estadoLabel = ESTADO_PAGO_LABELS[estadoKey] || 'Pendiente de pago';
  addText(`  ${estadoLabel}`, true, 12, margin + 20);

  return Buffer.from(await doc.save());
}

/**
 * Genera el comprobante PDF, lo guarda en disco y retorna la ruta.
 */
export async function saveComprobantePdf(jobId, job, technicianName, companyName) {
  const pdfBytes = await generateComprobantePdf(job, technicianName, companyName);
  ensurePdfDir();
  const filename = `comprobante_${jobId}.pdf`;
  const filepath = path.join(PDFS_DIR, filename);
  fs.writeFileSync(filepath, pdfBytes);
  return filename;
}
