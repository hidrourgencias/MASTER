import { Router } from 'express';
import XLSX from 'xlsx';
import db from '../db/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/audit-log', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const logs = await db.prepare(`
      SELECT a.*, u.display_name as user_name
      FROM audit_log a LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit), parseInt(offset));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { from, to, user_id, status } = req.query;
    let query = `
      SELECT e.id, e.date as "Fecha", u.display_name as "Trabajador", e.amount as "Monto",
      e.provider as "Proveedor", e.provider_rut as "RUT_Proveedor", e.service as "Servicio",
      e.description as "Descripcion", e.document_type as "Tipo_Documento", e.document_number as "Num_Documento",
      e.status as "Estado", CASE WHEN e.paid = 1 THEN 'Pagado' ELSE 'Pendiente' END as "Pago",
      e.created_at as "Fecha_Registro"
      FROM expenses e JOIN users u ON e.user_id = u.id WHERE 1=1
    `;
    const params = [];

    if (from) { query += ' AND e.date >= ?'; params.push(from); }
    if (to) { query += ' AND e.date <= ?'; params.push(to); }
    if (user_id) { query += ' AND e.user_id = ?'; params.push(parseInt(user_id)); }
    if (status) { query += ' AND e.status = ?'; params.push(status); }

    query += ' ORDER BY e.date DESC';
    const data = await db.prepare(query).all(...params);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Rendiciones');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rendiciones_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Error al exportar' });
  }
});

router.get('/services', async (req, res) => {
  try {
    const services = await db.prepare('SELECT * FROM services ORDER BY name').all();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

router.post('/services', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    await db.prepare('INSERT INTO services (name) VALUES (?)').run(name);
    res.status(201).json({ message: 'Servicio creado' });
  } catch (err) {
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return res.status(400).json({ error: 'El servicio ya existe' });
    }
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

router.delete('/services/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ message: 'Servicio eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await db.prepare('SELECT * FROM settings').all();
    const obj = {};
    for (const s of settings) obj[s.key] = s.value;
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value');
    for (const [key, value] of Object.entries(req.body)) {
      await upsert.run(key, String(value));
    }
    res.json({ message: 'Configuración actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

export default router;
