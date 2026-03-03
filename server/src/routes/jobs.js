import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../db/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

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

    res.json({ total: total.total, paid: paid.total, pending: pending.total, count: count.count });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

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
    res.json({ ...job, photos });
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
      return { ...j, photos };
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
      client_type, client_name, client_rut, address_street, address_number, address_comuna,
      job_service_id, payment_type, payment_method, client_status, amount, date, notes
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
        address_number, address_comuna, job_service_id, payment_type, payment_method,
        client_status, amount, date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `).run(
      req.user.id,
      client_type,
      client_name,
      client_rut || '',
      address_street || '',
      address_number || '',
      address_comuna || '',
      job_service_id,
      payment_type,
      payment_method || '',
      client_status || 'pendiente_pago',
      parseFloat(amount || 0),
      date,
      notes || ''
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
    res.status(201).json({ ...job, photos });
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
      client_type, client_name, client_rut, address_street, address_number, address_comuna,
      job_service_id, payment_type, payment_method, client_status, amount, date, notes
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
        address_number = ?, address_comuna = ?, job_service_id = ?, payment_type = ?,
        payment_method = ?, client_status = ?, amount = ?, date = ?, notes = ?, updated_at = NOW()
      WHERE id = ?
    `).run(
      client_type || job.client_type,
      client_name || job.client_name,
      client_rut ?? job.client_rut,
      address_street ?? job.address_street,
      address_number ?? job.address_number,
      address_comuna ?? job.address_comuna,
      job_service_id || job.job_service_id,
      payment_type || job.payment_type,
      payment_method ?? job.payment_method,
      client_status ?? job.client_status,
      parseFloat(amount ?? job.amount),
      date || job.date,
      notes ?? job.notes,
      id
    );

    const updated = await db.prepare(`
      SELECT j.*, js.name as job_service_name FROM service_jobs j
      LEFT JOIN job_services js ON j.job_service_id = js.id WHERE j.id = ?
    `).get(id);
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(id);
    res.json({ ...updated, photos });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

router.put('/:id/set-payment', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_payment } = req.body;
    const amount = parseFloat(technician_payment);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    await db.prepare('UPDATE service_jobs SET technician_payment = ?, updated_at = NOW() WHERE id = ?').run(amount, id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'SET_JOB_PAYMENT', `Pago técnico #${id}: $${amount}`);

    const job = await db.prepare(`
      SELECT j.*, js.name as job_service_name, u.display_name as technician_name
      FROM service_jobs j LEFT JOIN job_services js ON j.job_service_id = js.id
      LEFT JOIN users u ON j.technician_id = u.id WHERE j.id = ?
    `).get(id);
    const photos = await db.prepare('SELECT * FROM service_job_photos WHERE service_job_id = ?').all(id);
    res.json({ ...job, photos });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar pago' });
  }
});

router.put('/:id/mark-paid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await db.prepare('UPDATE service_jobs SET technician_paid = 1, technician_paid_at = NOW(), updated_at = NOW() WHERE id = ?').run(id);

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

export default router;
