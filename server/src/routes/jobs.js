import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import db from '../db/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { saveJobPdf } from '../utils/generateJobPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads', 'jobs'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `job_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext || mime);
  }
});

const router = Router();
router.use(authMiddleware);

function ensureJobsUploadDir() {
  const dir = path.join(__dirname, '..', '..', 'uploads', 'jobs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getBaseUrl() {
  return process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'https://hidrourgencias.onrender.com';
}

async function generatePdfAndNotifyUrl(jobId, job, photos, technicianName) {
  try {
    await saveJobPdf(jobId, job, photos, technicianName);
    const token = crypto.randomBytes(16).toString('hex');
    await db.prepare('UPDATE service_jobs SET pdf_token = ? WHERE id = ?').run(token, jobId);
    const base = getBaseUrl();
    const pdfUrl = `${base}/api/public/ticket-pdf/${jobId}?token=${token}`;
    const settings = await db.prepare('SELECT value FROM settings WHERE key = ?').get('whatsapp_number');
    const adminPhone = (settings?.value || '').replace(/\D/g, '') || '56940918672';
    const num = adminPhone.startsWith('56') ? adminPhone : '56' + adminPhone;
    const estadoPago = job.client_status === 'pagado' ? 'Cliente ya pagó' : 'Pendiente de pago';
    const msg = `Nuevo ticket #${jobId} ejecutado - ${job.client_name} - ${job.job_service_name || 'Servicio'}.\nEstado pago: ${estadoPago}.\nDescargar PDF: ${pdfUrl}`;
    return { pdfUrl, whatsappNotifyUrl: `https://wa.me/${num}?text=${encodeURIComponent(msg)}` };
  } catch (err) {
    console.error('PDF generation error:', err);
    return null;
  }
}

router.get('/job-services', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM job_services WHERE active = 1 ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

router.get('/admin/job-services', adminMiddleware, async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM job_services ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

router.post('/admin/job-services', adminMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    await db.prepare('INSERT INTO job_services (name) VALUES (?)').run(name.trim());
    const row = await db.prepare('SELECT * FROM job_services ORDER BY id DESC LIMIT 1').get();
    res.status(201).json(row);
  } catch (err) {
    if (err.message?.includes('unique')) return res.status(400).json({ error: 'El servicio ya existe' });
    res.status(500).json({ error: 'Error al crear' });
  }
});

router.delete('/admin/job-services/:id', adminMiddleware, async (req, res) => {
  try {
    await db.prepare('UPDATE job_services SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Servicio desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;
    const whereClause = userId ? 'WHERE j.technician_id = ?' : '';
    const params = userId ? [userId] : [];

    const total = await db.prepare(`SELECT COALESCE(SUM(technician_payment), 0) as total FROM service_jobs j ${whereClause}`).get(...params);
    const paid = await db.prepare(`SELECT COALESCE(SUM(technician_payment), 0) as total FROM service_jobs j ${whereClause ? whereClause + ' AND' : 'WHERE'} j.technician_paid = 1`).get(...params);
    const pending = await db.prepare(`SELECT COALESCE(SUM(technician_payment), 0) as total FROM service_jobs j ${whereClause ? whereClause + ' AND' : 'WHERE'} j.technician_paid = 0 AND j.technician_payment > 0`).get(...params);
    const count = await db.prepare(`SELECT COUNT(*) as count FROM service_jobs j ${whereClause}`).get(...params);
    const pendingApproval = await db.prepare(`SELECT COUNT(*) as count FROM service_jobs j ${whereClause ? whereClause + ' AND' : 'WHERE'} j.ticket_status = 'pendiente'`).get(...params);

    res.json({
      total: total.total, paid: paid.total, pending: pending.total, count: count.count,
      myTicketsCount: count.count, pendingApprovalCount: pendingApproval.count, pendingApproval: pendingApproval.count
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

function sanitizeJobForTechnician(job) {
  if (!job) return job;
  const { amount, technician_payment, admin_payment_method, admin_payment_schedule, admin_payment_notes, ...rest } = job;
  return rest;
}

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await db.prepare(`
      SELECT j.*, js.name as job_service_name, u.display_name as technician_name
      FROM service_jobs j LEFT JOIN job_services js ON j.job_service_id = js.id
      LEFT JOIN users u ON j.technician_id = u.id WHERE j.id = ?
    `).get(id);
    if (!job) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && job.technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(id);
    const out = req.user.role === 'admin' ? { ...job, photos } : { ...sanitizeJobForTechnician(job), photos };
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT j.*, js.name as job_service_name, u.display_name as technician_name
      FROM service_jobs j
      LEFT JOIN job_services js ON j.job_service_id = js.id
      LEFT JOIN users u ON j.technician_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ' AND j.technician_id = ?';
      params.push(req.user.id);
    }
    query += ' ORDER BY j.created_at DESC';

    const jobs = await db.prepare(query).all(...params);

    const withPhotos = await Promise.all(jobs.map(async (j) => {
      const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(j.id);
      const row = { ...j, photos };
      return req.user.role === 'admin' ? row : { ...sanitizeJobForTechnician(j), photos };
    }));

    res.json(withPhotos);
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: 'Error al obtener trabajos' });
  }
});

router.post('/', upload.array('photos', 10), async (req, res) => {
  try {
    ensureJobsUploadDir();

    const {
      client_type, client_name, client_rut, address_street, address_number, address_comuna, client_phone,
      job_service_id, payment_type, payment_method, client_status, amount, date, notes, is_garantia
    } = req.body;

    if (!client_type || !client_name || !job_service_id || !payment_type || !date) {
      return res.status(400).json({ error: 'Cliente, servicio, tipo de pago y fecha son requeridos' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({
        error: 'La fotografía del servicio es obligatoria. Sin fotos no se genera cobro.'
      });
    }

    const result = await db.prepare(`
      INSERT INTO service_jobs (technician_id, client_type, client_name, client_rut, address_street,
        address_number, address_comuna, client_phone, job_service_id, payment_type, payment_method,
        client_status, amount, date, notes, is_garantia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `).run(
      req.user.id,
      client_type,
      client_name,
      client_rut || '',
      address_street || '',
      address_number || '',
      address_comuna || '',
      client_phone || '',
      job_service_id,
      payment_type,
      payment_method || '',
      client_status || 'pendiente_pago',
      parseFloat(amount || 0),
      date,
      notes || '',
      is_garantia === '1' ? 1 : 0
    );

    const jobId = result.lastInsertRowid;
    for (const f of files) {
      await db.prepare('INSERT INTO service_job_photos (service_job_id, image_path) VALUES (?, ?)')
        .run(jobId, f.filename);
    }

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'CREATE_JOB', `Servicio creado: ${client_name} - ${date}`);

    const job = await db.prepare(`
      SELECT j.*, js.name as job_service_name FROM service_jobs j
      LEFT JOIN job_services js ON j.job_service_id = js.id WHERE j.id = ?
    `).get(jobId);
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(jobId);
    const techRow = await db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
    const notify = await generatePdfAndNotifyUrl(jobId, job, photos, techRow?.display_name || '');
    res.status(201).json({ ...job, photos, pdfNotify: notify });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: err.message || 'Error al crear servicio' });
  }
});

router.put('/:id', upload.array('photos', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const job = await db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
    if (req.user.role !== 'admin' && job.technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    if (job.technician_paid) {
      return res.status(400).json({ error: 'No se puede editar un trabajo ya pagado al técnico' });
    }

    const {
      client_type, client_name, client_rut, address_street, address_number, address_comuna, client_phone,
      job_service_id, payment_type, payment_method, client_status, amount, date, notes, is_garantia
    } = req.body;

    const photosCount = await db.prepare('SELECT COUNT(*) as c FROM service_job_photos WHERE service_job_id = ?').get(id);
    const existingCount = Number(photosCount?.c ?? 0);
    const newFiles = req.files || [];
    if (existingCount + newFiles.length === 0) {
      return res.status(400).json({
        error: 'Debe haber al menos una fotografía del servicio'
      });
    }

    ensureJobsUploadDir();
    for (const f of newFiles) {
      await db.prepare('INSERT INTO service_job_photos (service_job_id, image_path) VALUES (?, ?)')
        .run(id, f.filename);
    }

    await db.prepare(`
      UPDATE service_jobs SET client_type = ?, client_name = ?, client_rut = ?, address_street = ?,
        address_number = ?, address_comuna = ?, client_phone = ?, job_service_id = ?, payment_type = ?,
        payment_method = ?, client_status = ?, amount = ?, date = ?, notes = ?, is_garantia = ?, updated_at = NOW()
      WHERE id = ?
    `).run(
      client_type || job.client_type,
      client_name || job.client_name,
      client_rut ?? job.client_rut,
      address_street ?? job.address_street,
      address_number ?? job.address_number,
      address_comuna ?? job.address_comuna,
      client_phone ?? job.client_phone,
      job_service_id || job.job_service_id,
      payment_type || job.payment_type,
      payment_method ?? job.payment_method,
      client_status ?? job.client_status,
      parseFloat(amount ?? job.amount),
      date || job.date,
      notes ?? job.notes,
      is_garantia !== undefined ? (is_garantia === '1' || is_garantia === true || is_garantia === 1 ? 1 : 0) : job.is_garantia,
      id
    );

    const updated = await db.prepare(`
      SELECT j.*, js.name as job_service_name FROM service_jobs j
      LEFT JOIN job_services js ON j.job_service_id = js.id WHERE j.id = ?
    `).get(id);
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(id);
    const techRow2 = await db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
    const notify2 = await generatePdfAndNotifyUrl(Number(id), updated, photos, techRow2?.display_name || '');
    res.json({ ...updated, photos, pdfNotify: notify2 });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

async function sendPaymentNotification(db, technicianId, job, payAmount, scheduleLabel) {
  try {
    const msg = payAmount === 0
      ? `Servicio de ${job.job_service_name || 'destape'} en "${job.client_name}". Modalidad: No pago por garantía. Estado: Por pagar.`
      : `Servicio de ${job.job_service_name || 'destape'} en "${job.client_name}". Ha obtenido ingresos: $${Number(payAmount).toLocaleString('es-CL')}. Modalidad: ${scheduleLabel}. Estado: Por pagar.`;
    await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, created_at)
      VALUES (?, 'PAGO_ASIGNADO', 'Pago asignado', ?, NOW())
    `).run(technicianId, msg);
  } catch (_) { /* tabla notifications puede no existir */ }
}

const VALID_PAYMENT_SCHEDULES = ['1_dia', '5_dias', '15_dias', '30_dias', '45_dias', 'inmediato_transferencia', 'inmediato_efectivo', 'garantia'];

function sanitizePaymentSchedule(v) {
  return (v && VALID_PAYMENT_SCHEDULES.includes(String(v))) ? String(v) : '1_dia';
}

const PAYMENT_SCHEDULE_LABELS = {
  '1_dia': '1 día', '5_dias': '5 días', '15_dias': '15 días', '30_dias': '30 días', '45_dias': '45 días',
  'inmediato_transferencia': 'Pago inmediato (transferencia)', 'inmediato_efectivo': 'Pago inmediato (efectivo)',
  'garantia': 'No pago por garantía'
};

router.put('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, technician_payment, admin_payment_method, admin_payment_schedule, admin_payment_notes } = req.body;
    const schedule = sanitizePaymentSchedule(admin_payment_schedule);
    const job = await db.prepare(`
      SELECT j.*, js.name as job_service_name FROM service_jobs j
      LEFT JOIN job_services js ON j.job_service_id = js.id WHERE j.id = ?
    `).get(id);
    if (!job) return res.status(404).json({ error: 'No encontrado' });

    const isGarantia = job.is_garantia === 1 || schedule === 'garantia';
    const payAmount = isGarantia ? 0 : (parseFloat(technician_payment) || 0);
    const amt = amount != null ? parseFloat(amount) : job.amount;

    await db.prepare(`
      UPDATE service_jobs SET amount = ?, technician_payment = ?, ticket_status = 'aprobado',
        admin_payment_method = ?, admin_payment_schedule = ?, admin_payment_notes = ?, updated_at = NOW()
      WHERE id = ?
    `).run(amt, payAmount, admin_payment_method || null, schedule, admin_payment_notes || null, id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'APPROVE_JOB', `Ticket #${id} aprobado. Pago técnico: $${payAmount}`);

    if (job.technician_id) {
      const label = PAYMENT_SCHEDULE_LABELS[schedule] || schedule || '';
      await sendPaymentNotification(db, job.technician_id, job, payAmount, label);
    }

    const updated = await db.prepare(`
      SELECT j.*, js.name as job_service_name, u.display_name as technician_name
      FROM service_jobs j LEFT JOIN job_services js ON j.job_service_id = js.id
      LEFT JOIN users u ON j.technician_id = u.id WHERE j.id = ?
    `).get(id);
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(id);
    res.json({ ...updated, photos });
  } catch (err) {
    console.error('Approve job error:', err);
    res.status(500).json({ error: err.message || 'Error al aprobar' });
  }
});

router.put('/:id/set-payment', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_payment, admin_payment_method, admin_payment_schedule, admin_payment_notes } = req.body;
    const schedule = sanitizePaymentSchedule(admin_payment_schedule);
    const job = await db.prepare(`
      SELECT j.*, js.name as job_service_name FROM service_jobs j
      LEFT JOIN job_services js ON j.job_service_id = js.id WHERE j.id = ?
    `).get(id);
    if (!job) return res.status(404).json({ error: 'No encontrado' });

    const isGarantia = job.is_garantia === 1 || schedule === 'garantia';
    const payAmount = isGarantia ? 0 : (parseFloat(technician_payment) ?? job.technician_payment ?? 0);
    if (!isGarantia && (isNaN(payAmount) || payAmount < 0)) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    await db.prepare(`
      UPDATE service_jobs SET technician_payment = ?, admin_payment_method = ?,
        admin_payment_schedule = ?, admin_payment_notes = ?, updated_at = NOW()
      WHERE id = ?
    `).run(payAmount, admin_payment_method || null, schedule, admin_payment_notes || null, id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'SET_JOB_PAYMENT', `Pago técnico #${id}: $${payAmount}`);

    if (job.technician_id) {
      const label = PAYMENT_SCHEDULE_LABELS[schedule] || schedule || '';
      await sendPaymentNotification(db, job.technician_id, job, payAmount, label);
    }

    const updated = await db.prepare(`
      SELECT j.*, js.name as job_service_name, u.display_name as technician_name
      FROM service_jobs j LEFT JOIN job_services js ON j.job_service_id = js.id
      LEFT JOIN users u ON j.technician_id = u.id WHERE j.id = ?
    `).get(id);
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(id);
    res.json({ ...updated, photos });
  } catch (err) {
    console.error('Set payment error:', err);
    res.status(500).json({ error: err.message || 'Error al asignar pago' });
  }
});

router.put('/:id/mark-paid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_payment_method } = req.body;
    const method = ['Efectivo', 'Transferencia', 'efectivo', 'transferencia'].includes(String(admin_payment_method || ''))
      ? (String(admin_payment_method).toLowerCase() === 'efectivo' ? 'Efectivo' : 'Transferencia')
      : (admin_payment_method || null);

    await db.prepare(`
      UPDATE service_jobs SET technician_paid = 1, technician_paid_at = NOW(),
        admin_payment_method = COALESCE(?, admin_payment_method), updated_at = NOW()
      WHERE id = ?
    `).run(method, id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'PAY_TECHNICIAN', `Técnico pagado #${id}`);

    const job = await db.prepare(`
      SELECT j.*, js.name as job_service_name, u.display_name as technician_name
      FROM service_jobs j LEFT JOIN job_services js ON j.job_service_id = js.id
      LEFT JOIN users u ON j.technician_id = u.id WHERE j.id = ?
    `).get(id);
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(id);
    res.json({ ...job, photos });
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar como pagado' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
    if (req.user.role !== 'admin' && job.technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    if (job.technician_paid) {
      return res.status(400).json({ error: 'No se puede eliminar un trabajo ya pagado' });
    }

    await db.prepare('DELETE FROM service_job_photos WHERE service_job_id = ?').run(id);
    await db.prepare('DELETE FROM service_jobs WHERE id = ?').run(id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'DELETE_JOB', `Servicio #${id} eliminado`);

    res.json({ message: 'Servicio eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

router.post('/:id/postventa', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await db.prepare(`
      SELECT j.*, js.name as job_service_name, u.display_name as technician_name
      FROM service_jobs j 
      LEFT JOIN job_services js ON j.job_service_id = js.id
      LEFT JOIN users u ON j.technician_id = u.id 
      WHERE j.id = ?
    `).get(id);

    if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });

    // Date calculations: +5 business days
    const startDate = new Date(job.date);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Fecha de servicio inválida' });
    }

    let daysAdded = 0;
    let reminderDate = new Date(startDate);
    while (daysAdded < 5) {
      reminderDate.setDate(reminderDate.getDate() + 1);
      if (reminderDate.getDay() !== 0 && reminderDate.getDay() !== 6) { // Skip Sunday and Saturday
        daysAdded++;
      }
    }
    const isoDateStr = reminderDate.toISOString().split('T')[0];

    // Check if reminder already exists
    const existing = await db.prepare('SELECT id FROM postventa_reminders WHERE service_job_id = ?').get(id);
    if (existing) {
      // Update
      await db.prepare('UPDATE postventa_reminders SET scheduled_date = ? WHERE id = ?').run(isoDateStr, existing.id);
    } else {
      // Insert
      await db.prepare(`
        INSERT INTO postventa_reminders (service_job_id, scheduled_date) VALUES (?, ?)
      `).run(id, isoDateStr);
    }

    // Generate Google Calendar Link
    // Format YYYYMMDD
    const calDateStr = isoDateStr.replace(/-/g, '');
    const startTime = `${calDateStr}T090000Z`; // 09:00 UTC
    const endTime = `${calDateStr}T100000Z`; // 10:00 UTC
    
    const title = encodeURIComponent(`Postventa: ${job.client_name}`);
    const details = encodeURIComponent(`
=========================================
RECORDATORIO DE POSTVENTA HIDROURGENCIAS SpA
=========================================

DATOS DEL CLIENTE:
- Cliente: ${job.client_name}
- Fono Contacto / WhatsApp: ${job.client_phone || '___'}
- Dirección: ${job.address_street} ${job.address_number}, ${job.address_comuna}

SERVICIO EJECUTADO:
- Servicio: ${job.job_service_name || 'No especificado'}
- Día de ejecución: ${job.date}
- Técnico: ${job.technician_name}
- Observaciones técnicas de la visita: ${job.notes || 'Sin observaciones'}

=========================================
GUÍA DE COMUNICACIÓN (POSTVENTA)
=========================================

1. CONSULTA INICIAL:
"Hola, le escribimos de Hidrourgencias SpA para consultar cómo ha funcionado la red o el trabajo ejecutado tras nuestro servicio de ${job.job_service_name || 'destape/mantención'} ejecutado hace unos días."

2. RECOMENDACIÓN TÉCNICA (MODIFICAR SEGÚN CASO):
Recomendar los servicios de mantención de redes con sistema hidrojet, maquinaria o inspecciones.
Ejemplo: "Se recomienda mantención preventiva de redes de alcantarillado o desagües periódicamente al año o año y medio en casas particulares para evitar obstrucciones severas y preservar el sistema sanitario en óptimas condiciones."

3. ACCIÓN PARA ESTE EVENTO DE GOOGLE CALENDAR:
- Editar la fecha de este recordatorio (ej. programar para 6 meses o 1 año más).
- Así, en el futuro enviará el mensaje: "Ya es tiempo de su mantención periódica al cliente ${job.client_name}".

=========================================
ESTRATEGIA: TRIÁNGULO DE SERVICIOS SANITARIOS
=========================================
Objetivo: Generar trazabilidad de cliente para pasar de emergencias a contratos de servicios.

1. EMERGENCIA (La puerta de entrada):
- El destape resuelve el síntoma.
- Características: urgencia alta, pago inmediato, cliente estresado, decisión rápida.
- Ejemplos: destape de alcantarillado, rebalse, retorno, inundación.

2. DIAGNÓSTICO (Servicio técnico especializado):
- Después de resolver la emergencia se ofrece el diagnóstico para detectar problemas estructurales antes de un nuevo colapso.
- Servicios: videoinspección CCTV, evaluación de colectores, inspección de cámaras.

3. MANTENIMIENTO (Ingreso recurrente):
- La verdadera estabilidad del negocio.
- Servicios: limpieza preventiva de colectores, lavado hidrojet programado.
- Explicar al cliente qué riesgo existe si no se mantiene y qué intervención preventiva lo evita.

PIRÁMIDE DE CLIENTES SANITARIOS:
- Nivel 1 (Emergencia ocasional): Llaman solo cuando el sistema colapsa (casas, deptos).
- Nivel 2 (Recurrentes): Ya conocen el servicio y repiten cuando ocurre otra falla.
- Nivel 3 (Mantenimiento preventivo): Aceptan recomendaciones técnicas y programan limpiezas.
- Nivel 4 (Estratégicos): Contratos de mantenimiento, múltiples instalaciones (cadenas, industrias, grandes condominios).

Tu objetivo en esta postventa es subir al cliente al Nivel 2 o 3 de la pirámide mediante el Triángulo de Servicios.
`.trim());

    const location = encodeURIComponent(`${job.address_street} ${job.address_number}, ${job.address_comuna}`);

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&location=${location}`;

    res.json({ message: 'Recordatorio programado', googleCalendarUrl: gcalUrl, scheduled_date: isoDateStr });

  } catch (err) {
    console.error('Postventa error:', err);
    res.status(500).json({ error: 'Error al programar postventa' });
  }
});

export default router;
