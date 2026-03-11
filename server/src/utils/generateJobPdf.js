import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_JOBS = path.join(__dirname, '..', '..', 'uploads', 'jobs');
const PDFS_DIR = path.join(__dirname, '..', '..', 'uploads', 'jobs', 'pdfs');

function ensurePdfDir() {
  if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true });
}

function isJpeg(buf) {
  return buf[0] === 0xff && buf[1] === 0xd8;
}

function isPng(buf) {
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return pngSig.every((b, i) => buf[i] === b);
}

/**
 * Genera PDF del ticket de servicio con datos y fotos.
 * @param {object} job - Datos del trabajo
 * @param {array} photos - [{ image_path }]
 * @param {string} technicianName
 * @returns {Buffer} PDF en bytes
 */
export async function generateJobPdf(job, photos, technicianName) {
  ensurePdfDir();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const lineHeight = 14;
  let y = pageHeight - margin;

  const drawOnPage = () => page;
  const addText = (text, bold = false, size = 11) => {
    const f = bold ? fontBold : font;
    return drawOnPage().drawText(text, {
      x: margin,
      y,
      size,
      font: f,
      color: rgb(0.1, 0.1, 0.1)
    });
  };

  const addLine = (label, value) => {
    addText(`${label}: `, true, 10);
    const labelWidth = fontBold.widthOfTextAtSize(`${label}: `, 10);
    drawOnPage().drawText(String(value || '-'), {
      x: margin + labelWidth,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2)
    });
    y -= lineHeight;
  };

  let page = doc.addPage([pageWidth, pageHeight]);
  y = pageHeight - margin;

  page.drawText('TICKET DE SERVICIO - Hidrourgencias SpA', {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0, 0.2, 0.5)
  });
  y -= lineHeight * 1.5;

  addLine('Ticket #', job.id);
  addLine('Fecha', job.date);
  addLine('Técnico', technicianName);
  addLine('Cliente', job.client_name);
  addLine('Tipo cliente', job.client_type);
  addLine('RUT', job.client_rut || '-');
  addLine('Teléfono', job.client_phone || '-');
  addLine('Dirección', `${job.address_street || ''} ${job.address_number || ''}`.trim() || '-');
  addLine('Comuna', job.address_comuna || '-');
  addLine('Servicio', job.job_service_name || '-');
  addLine('Tipo pago', job.payment_type);
  addLine('Cobro cliente', job.amount ? `$${Number(job.amount).toLocaleString('es-CL')}` : '-');
  if (job.notes) {
    addLine('Notas', job.notes);
  }
  if (job.is_garantia === 1) {
    addLine('Garantía', 'Sí');
  }
  y -= lineHeight;

  // Fotos
  if (photos && photos.length > 0) {
    const photoLabels = ['Inicial', 'Durante', 'Final'];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const imgPath = path.join(UPLOADS_JOBS, photo.image_path);
      if (!fs.existsSync(imgPath)) continue;

      const buf = fs.readFileSync(imgPath);
      let img;
      try {
        if (isJpeg(buf)) {
          img = await doc.embedJpg(buf);
        } else if (isPng(buf)) {
          img = await doc.embedPng(buf);
        } else {
          continue;
        }
      } catch (_) {
        continue;
      }

      if (y < 150) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      const label = photoLabels[i] || `Foto ${i + 1}`;
      page.drawText(label, {
        x: margin,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2)
      });
      y -= 12;

      const maxW = pageWidth - margin * 2;
      const maxH = 180;
      const dims = img.scaleToFit(maxW, maxH);
      page.drawImage(img, {
        x: margin,
        y: y - dims.height,
        width: dims.width,
        height: dims.height
      });
      y -= dims.height + 20;
    }
  }

  return Buffer.from(await doc.save());
}

/**
 * Genera el PDF, lo guarda en disco y retorna la ruta.
 */
export async function saveJobPdf(jobId, job, photos, technicianName) {
  const pdfBytes = await generateJobPdf(job, photos, technicianName);
  ensurePdfDir();
  const filename = `ticket_${jobId}.pdf`;
  const filepath = path.join(PDFS_DIR, filename);
  fs.writeFileSync(filepath, pdfBytes);
  return filename;
}
