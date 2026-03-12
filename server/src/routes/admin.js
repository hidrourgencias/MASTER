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

router.get('/payment-methods', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM payment_methods WHERE active = 1 ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener métodos de pago' });
  }
});

router.post('/payment-methods', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    await db.prepare('INSERT INTO payment_methods (name) VALUES (?)').run(name.trim());
    const row = await db.prepare('SELECT * FROM payment_methods ORDER BY id DESC LIMIT 1').get();
    res.status(201).json(row);
  } catch (err) {
    if (err.message?.includes('unique') || err.code === '23505') return res.status(400).json({ error: 'El método ya existe' });
    res.status(500).json({ error: 'Error al crear' });
  }
});

router.delete('/payment-methods/:id', async (req, res) => {
  try {
    await db.prepare('UPDATE payment_methods SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Método desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

router.get('/export-contable', async (req, res) => {
  try {
    const { from, to } = req.query;
    const jobParams = [];
    let jobWhere = '(j.is_garantia IS NULL OR j.is_garantia = 0) AND j.amount > 0';
    if (from) { jobWhere += ' AND j.date >= ?'; jobParams.push(from); }
    if (to) { jobWhere += ' AND j.date <= ?'; jobParams.push(to); }

    const ingresosData = (await db.prepare(`
      SELECT j.id, j.date, j.client_name, j.client_rut, js.name as service_name,
        j.amount, j.client_type, j.admin_payment_method
      FROM service_jobs j
      LEFT JOIN job_services js ON j.job_service_id = js.id
      WHERE ${jobWhere}
      ORDER BY j.date ASC
    `).all(...jobParams)).map(r => {
      const isFactura = r.client_type === 'COMERCIAL' || r.client_type === 'EMPRESA';
      const total = Number(r.amount);
      const neto = isFactura ? Math.round(total / 1.19) : total;
      const iva = isFactura ? Math.round(total - neto) : 0;
      return {
        Tipo: 'Ingreso', Fecha: r.date, Descripcion: r.service_name || 'Servicio', RUT: r.client_rut || '',
        Razon_Social: r.client_name, Monto_Neto: neto, IVA: iva, Monto_Total: total,
        Metodo_Pago: r.admin_payment_method || '', Tipo_Doc: isFactura ? 'Factura' : 'Boleta', Origen: `Ticket #${r.id}`
      };
    });

    const expParams = [];
    let expWhere = "e.status IN ('aprobado','pagado')";
    if (from) { expWhere += ' AND e.date >= ?'; expParams.push(from); }
    if (to) { expWhere += ' AND e.date <= ?'; expParams.push(to); }
    const egresosGastos = (await db.prepare(`
      SELECT e.id, e.date, e.provider, e.provider_rut, e.service, e.amount, e.document_type
      FROM expenses e
      WHERE ${expWhere}
      ORDER BY e.date ASC
    `).all(...expParams)).map(r => {
      const isFactura = String(r.document_type || '').toLowerCase() === 'factura';
      const total = Number(r.amount);
      const neto = isFactura ? Math.round(total / 1.19) : total;
      const iva = isFactura ? Math.round(total - neto) : 0;
      return {
        Tipo: 'Egreso', Fecha: r.date, Descripcion: r.service || 'Gasto', RUT: r.provider_rut || '',
        Razon_Social: r.provider || 'Proveedor', Monto_Neto: neto, IVA: iva, Monto_Total: total,
        Metodo_Pago: '', Tipo_Doc: r.document_type || 'boleta', Origen: `Gasto #${r.id}`
      };
    });

    const pagParams = [];
    let pagWhere = 'j.technician_paid = 1 AND j.technician_payment > 0';
    if (from) { pagWhere += ' AND j.date >= ?'; pagParams.push(from); }
    if (to) { pagWhere += ' AND j.date <= ?'; pagParams.push(to); }
    const egresosPagos = (await db.prepare(`
      SELECT j.id, j.date, u.display_name, j.technician_payment, j.admin_payment_method
      FROM service_jobs j JOIN users u ON j.technician_id = u.id
      WHERE ${pagWhere}
      ORDER BY j.date ASC
    `).all(...pagParams)).map(r => ({
      Tipo: 'Egreso', Fecha: r.date, Descripcion: 'Pago a técnico', RUT: '',
      Razon_Social: r.display_name, Monto_Neto: Number(r.technician_payment), IVA: 0,
      Monto_Total: Number(r.technician_payment), Metodo_Pago: r.admin_payment_method || '',
      Tipo_Doc: 'Honorarios', Origen: `Ticket #${r.id}`
    }));

    const all = [...ingresosData, ...egresosGastos, ...egresosPagos].sort((a, b) => a.Fecha.localeCompare(b.Fecha));
    const headers = ['Tipo', 'Fecha', 'Descripcion', 'RUT', 'Razon_Social', 'Monto_Neto', 'IVA', 'Monto_Total', 'Metodo_Pago', 'Tipo_Doc', 'Origen'];

    let totalIngresos = 0, totalEgresos = 0;
    all.forEach(r => {
      if (r.Tipo === 'Ingreso') totalIngresos += r.Monto_Total;
      else totalEgresos += r.Monto_Total;
    });

    const resumenData = [
      ['Concepto', 'Monto'],
      ['Total Ingresos', totalIngresos],
      ['Total Egresos (Gastos + Pagos)', totalEgresos],
      ['Beneficio Neto', totalIngresos - totalEgresos]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...all.map(r => headers.map(h => r[h] || ''))]);
    XLSX.utils.book_append_sheet(wb, ws, 'Planilla SII');
    
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Contable');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=planilla_contable_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Export contable error:', err);
    res.status(500).json({ error: 'Error al exportar planilla contable' });
  }
});

router.get('/export-payments', async (req, res) => {
  try {
    const { from, to, user_id, status } = req.query;
    let query = `
      SELECT j.id as "ID", j.date as "Fecha", u.display_name as "Técnico", js.name as "Servicio",
      j.client_name as "Cliente", j.client_type as "Tipo_Cliente", j.address_street as "Calle",
      j.address_number as "Número", j.address_comuna as "Comuna", j.amount as "Cobro_Cliente",
      j.technician_payment as "Pago_Técnico", j.admin_payment_method as "Método_Pago",
      j.admin_payment_schedule as "Estado_Pago_Admin", j.admin_payment_notes as "Observaciones_Pago",
      j.ticket_status as "Estado", CASE WHEN j.technician_paid = 1 THEN 'Pagado' ELSE 'Pendiente' END as "Pago_Técnico_Estado",
      j.created_at as "Fecha_Registro"
      FROM service_jobs j
      LEFT JOIN users u ON j.technician_id = u.id
      LEFT JOIN job_services js ON j.job_service_id = js.id
      WHERE 1=1
    `;
    const params = [];
    if (from) { query += ' AND j.date >= ?'; params.push(from); }
    if (to) { query += ' AND j.date <= ?'; params.push(to); }
    if (user_id) { query += ' AND j.technician_id = ?'; params.push(parseInt(user_id)); }
    if (status) { query += ' AND j.ticket_status = ?'; params.push(status); }
    query += ' ORDER BY j.date DESC';
    const data = await db.prepare(query).all(...params);

    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=pagos_tickets_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Export payments error:', err);
    res.status(500).json({ error: 'Error al exportar' });
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

// Equipment (maquinaria / EPP / materiales)
router.get('/equipment', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM equipment_catalog WHERE active = 1 ORDER BY category, name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener equipos' });
  }
});

router.post('/equipment', async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const cat = (category || 'maquinaria').trim();
    await db.prepare('INSERT INTO equipment_catalog (name, category) VALUES (?, ?)').run(name.trim(), cat);
    const row = await db.prepare('SELECT * FROM equipment_catalog ORDER BY id DESC LIMIT 1').get();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear equipo' });
  }
});

router.delete('/equipment/:id', async (req, res) => {
  try {
    await db.prepare('UPDATE equipment_catalog SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Equipo desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

export default router;
