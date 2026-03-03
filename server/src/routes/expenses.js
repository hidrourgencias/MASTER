import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `receipt_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext || mime);
  }
});

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    let query = 'SELECT e.*, u.display_name as user_name FROM expenses e JOIN users u ON e.user_id = u.id';
    const params = [];

    if (req.user.role !== 'admin') {
      query += ' WHERE e.user_id = ?';
      params.push(req.user.id);
    }
    query += ' ORDER BY e.created_at DESC';

    const expenses = await db.prepare(query).all(...params);
    res.json(expenses);
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;
    const whereClause = userId ? 'WHERE e.user_id = ?' : '';
    const params = userId ? [userId] : [];

    const total = await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses e ${whereClause}`
    ).get(...params);

    const paid = await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses e ${whereClause ? whereClause + ' AND' : 'WHERE'} e.paid = 1`
    ).get(...params);

    const pending = await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses e ${whereClause ? whereClause + ' AND' : 'WHERE'} e.paid = 0`
    ).get(...params);

    const count = await db.prepare(
      `SELECT COUNT(*) as count FROM expenses e ${whereClause}`
    ).get(...params);

    const pendingApproval = await db.prepare(
      `SELECT COUNT(*) as count FROM expenses e ${whereClause ? whereClause + ' AND' : 'WHERE'} e.status = 'pendiente'`
    ).get(...params);

    res.json({
      total: total.total,
      paid: paid.total,
      pending: pending.total,
      count: count.count,
      pendingApproval: pendingApproval.count
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const byService = await db.prepare(`
      SELECT service, SUM(amount) as total, COUNT(*) as count
      FROM expenses WHERE service != '' GROUP BY service ORDER BY total DESC LIMIT 10
    `).all();

    const byProvider = await db.prepare(`
      SELECT provider, SUM(amount) as total, COUNT(*) as count
      FROM expenses WHERE provider != '' GROUP BY provider ORDER BY total DESC LIMIT 10
    `).all();

    const byUser = await db.prepare(`
      SELECT u.display_name as name, SUM(e.amount) as total, COUNT(*) as count
      FROM expenses e JOIN users u ON e.user_id = u.id GROUP BY e.user_id, u.display_name ORDER BY total DESC
    `).all();

    const byMonth = await db.prepare(`
      SELECT LEFT(date, 7) as month, SUM(amount) as total, COUNT(*) as count
      FROM expenses GROUP BY LEFT(date, 7) ORDER BY month DESC LIMIT 12
    `).all();

    res.json({ byService, byProvider, byUser, byMonth });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

router.post('/', upload.single('receipt'), async (req, res) => {
  try {
    const { date, amount, provider, provider_rut, service, description, document_type, document_number, collaborators, ocr_raw } = req.body;

    if (!date || !amount) {
      return res.status(400).json({ error: 'Fecha y monto son requeridos' });
    }

    const imagePath = req.file ? req.file.filename : '';
    const collabs = collaborators || '[]';

    const result = await db.prepare(`
      INSERT INTO expenses (user_id, date, amount, provider, provider_rut, service, description, document_type, document_number, image_path, collaborators, ocr_raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `).run(
      req.user.id,
      date,
      parseFloat(amount),
      provider || '',
      provider_rut || '',
      service || '',
      description || '',
      document_type || 'boleta',
      document_number || '',
      imagePath,
      collabs,
      ocr_raw || ''
    );

    if (provider_rut && provider) {
      const existing = await db.prepare('SELECT * FROM frequent_ruts WHERE rut = ?').get(provider_rut);
      if (existing) {
        await db.prepare('UPDATE frequent_ruts SET usage_count = usage_count + 1 WHERE id = ?').run(existing.id);
      } else {
        await db.prepare('INSERT INTO frequent_ruts (rut, name) VALUES (?, ?)').run(provider_rut, provider);
      }
    }

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'CREATE_EXPENSE', `Gasto creado: $${amount} - ${provider || 'Sin proveedor'}`);

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(expense);
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

router.put('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['aprobado', 'rechazado'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    await db.prepare(`
      UPDATE expenses SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?
    `).run(status, req.user.id, id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'APPROVE_EXPENSE', `Gasto #${id} ${status}`);

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar gasto' });
  }
});

router.put('/:id/pay', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare(`
      UPDATE expenses SET paid = 1, paid_at = NOW(), updated_at = NOW() WHERE id = ?
    `).run(id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'PAY_EXPENSE', `Gasto #${id} marcado como pagado`);

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Error al pagar gasto' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);

    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' });
    if (req.user.role !== 'admin' && expense.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    await db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'DELETE_EXPENSE', `Gasto #${id} eliminado`);

    res.json({ message: 'Gasto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

export default router;
