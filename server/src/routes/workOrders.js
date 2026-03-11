import { Router } from 'express';
import db from '../db/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { appendWorkOrderToExcel } from '../utils/workOrdersExcel.js';

const router = Router();
router.use(authMiddleware);

const ATTENTION_TYPES = [
  { value: 'urgencia_coordinar', label: 'Urgencia - Coordinar con cliente' },
  { value: 'cotizacion', label: 'Cotización' },
  { value: 'visita_tecnica', label: 'Visita técnica' }
];

router.get('/attention-types', (req, res) => res.json(ATTENTION_TYPES));

router.get('/service-types', adminMiddleware, async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM work_order_service_types WHERE active = 1 ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tipos' });
  }
});

router.post('/service-types', adminMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    await db.prepare('INSERT INTO work_order_service_types (name) VALUES (?)').run(name.trim());
    const row = await db.prepare('SELECT * FROM work_order_service_types ORDER BY id DESC LIMIT 1').get();
    res.status(201).json(row);
  } catch (err) {
    if (err.message?.includes('unique')) return res.status(400).json({ error: 'Ya existe' });
    res.status(500).json({ error: 'Error al crear' });
  }
});

router.delete('/service-types/:id', adminMiddleware, async (req, res) => {
  try {
    await db.prepare('UPDATE work_order_service_types SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
    const rows = await db.prepare(`
      SELECT id, type, title, message, read_at, created_at
      FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    try {
      res.json([]);
    } catch (_) {
      res.status(500).json([]);
    }
  }
});

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT wo.*, wost.name as service_type_name, u.display_name as created_by_name
      FROM work_orders wo
      LEFT JOIN work_order_service_types wost ON wo.service_type_id = wost.id
      LEFT JOIN users u ON wo.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ` AND EXISTS (SELECT 1 FROM work_order_assignments woa WHERE woa.work_order_id = wo.id AND woa.technician_id = ?)`;
      params.push(req.user.id);
    }
    query += ' ORDER BY wo.created_at DESC';
    const orders = await db.prepare(query).all(...params);

    const withAssignments = await Promise.all(orders.map(async (wo) => {
      const assignments = await db.prepare(`
        SELECT woa.*, u.display_name as technician_name, u.whatsapp_phone
        FROM work_order_assignments woa
        JOIN users u ON woa.technician_id = u.id
        WHERE woa.work_order_id = ?
      `).all(wo.id);
      return { ...wo, assignments };
    }));
    res.json(withAssignments);
  } catch (err) {
    console.error('Get work orders:', err);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const wo = await db.prepare(`
      SELECT wo.*, wost.name as service_type_name, u.display_name as created_by_name
      FROM work_orders wo
      LEFT JOIN work_order_service_types wost ON wo.service_type_id = wost.id
      LEFT JOIN users u ON wo.created_by = u.id
      WHERE wo.id = ?
    `).get(req.params.id);
    if (!wo) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin') {
      const assigned = await db.prepare('SELECT 1 FROM work_order_assignments WHERE work_order_id = ? AND technician_id = ?').get(wo.id, req.user.id);
      if (!assigned) return res.status(403).json({ error: 'Sin permisos' });
    }
    const assignments = await db.prepare(`
      SELECT woa.*, u.display_name as technician_name, u.whatsapp_phone
      FROM work_order_assignments woa
      JOIN users u ON woa.technician_id = u.id
      WHERE woa.work_order_id = ?
    `).all(wo.id);
    res.json({ ...wo, assignments });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { attention_type, service_type_id, client_name, client_phone, address, schedule, technician_ids } = req.body;
    if (!attention_type || !client_name?.trim()) {
      return res.status(400).json({ error: 'Tipo de atención y nombre del cliente son requeridos' });
    }
    let techIds = Array.isArray(technician_ids) ? technician_ids : (technician_ids ? [technician_ids] : []);
    techIds = techIds.filter(Boolean);

    const result = await db.prepare(`
      INSERT INTO work_orders (attention_type, service_type_id, client_name, client_phone, address, schedule, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
    `).run(
      attention_type,
      service_type_id || null,
      client_name.trim(),
      client_phone?.trim() || '',
      address?.trim() || '',
      schedule?.trim() || '',
      req.user.id
    );

    const woId = result.lastInsertRowid;
    for (const tid of techIds) {
      await db.prepare('INSERT INTO work_order_assignments (work_order_id, technician_id) VALUES (?, ?)').run(woId, tid);
    }

    appendWorkOrderToExcel(woId).catch(err => console.error('Excel append error:', err));

    const wo = await db.prepare(`
      SELECT wo.*, wost.name as service_type_name
      FROM work_orders wo
      LEFT JOIN work_order_service_types wost ON wo.service_type_id = wost.id
      WHERE wo.id = ?
    `).get(woId);
    const assignments = await db.prepare(`
      SELECT woa.*, u.display_name as technician_name, u.whatsapp_phone
      FROM work_order_assignments woa
      JOIN users u ON woa.technician_id = u.id
      WHERE woa.work_order_id = ?
    `).all(woId);
    res.status(201).json({ ...wo, assignments });
  } catch (err) {
    console.error('Create work order:', err);
    res.status(500).json({ error: err.message || 'Error al crear' });
  }
});

router.post('/:id/assign', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_id } = req.body;
    if (!technician_id) return res.status(400).json({ error: 'Se requiere technician_id' });
    const wo = await db.prepare('SELECT id FROM work_orders WHERE id = ?').get(id);
    if (!wo) return res.status(404).json({ error: 'Orden no encontrada' });
    await db.prepare('INSERT INTO work_order_assignments (work_order_id, technician_id) VALUES (?, ?)').run(id, technician_id);
    try {
      await db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES (?, 'OT_ASIGNADA', 'Nueva Orden de Trabajo', ?, NOW())
      `).run(technician_id, `Se le ha asignado la OT #${id}. Revise en la app.`);
    } catch (_) {}
    res.json({ message: 'Técnico asignado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar' });
  }
});

router.put('/:id/send', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('UPDATE work_order_assignments SET sent_at = NOW() WHERE work_order_id = ?').run(id);
    res.json({ message: 'Enviado' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/assignments/:assignmentId/receive', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const a = await db.prepare('SELECT * FROM work_order_assignments WHERE id = ?').get(assignmentId);
    if (!a) return res.status(404).json({ error: 'No encontrado' });
    if (a.technician_id !== req.user.id) return res.status(403).json({ error: 'Sin permisos' });

    await db.prepare('UPDATE work_order_assignments SET read_at = NOW() WHERE id = ?').run(assignmentId);
    const wo = await db.prepare(`
      SELECT wo.*, wost.name as service_type_name
      FROM work_orders wo
      LEFT JOIN work_order_service_types wost ON wo.service_type_id = wost.id
      WHERE wo.id = ?
    `).get(a.work_order_id);
    const assignments = await db.prepare(`
      SELECT woa.*, u.display_name as technician_name, u.whatsapp_phone
      FROM work_order_assignments woa
      JOIN users u ON woa.technician_id = u.id
      WHERE woa.work_order_id = ?
    `).all(a.work_order_id);
    res.json({ ...wo, assignments });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/assignments/:assignmentId/admin-approve', adminMiddleware, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { approved } = req.body;
    await db.prepare('UPDATE work_order_assignments SET admin_approved_at = ? WHERE id = ?')
      .run(approved ? new Date() : null, assignmentId);
    res.json({ message: approved ? 'Aprobado' : 'Rechazado' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/assignments/:assignmentId/escalate', adminMiddleware, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const a = await db.prepare('SELECT * FROM work_order_assignments WHERE id = ?').get(assignmentId);
    if (!a) return res.status(404).json({ error: 'No encontrado' });
    const level = (a.escalation_level || 0) + 1;
    await db.prepare('UPDATE work_order_assignments SET escalation_level = ?, reminder_sent_at = NOW() WHERE id = ?')
      .run(level, assignmentId);
    res.json({ message: 'Escalado', escalation_level: level });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
