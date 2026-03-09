import { Router } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Get all quotes
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT q.*, u.display_name as creator_name 
      FROM quotes q
      JOIN users u ON q.user_id = u.id
    `;
    const params = [];
    
    if (req.user.role !== 'admin') {
      // Ventas solo ve sus cotizaciones
      query += ` WHERE q.user_id = ?`;
      params.push(req.user.id);
    }
    
    query += ` ORDER BY q.created_at DESC`;
    
    const quotes = await db.prepare(query).all(...params);
    res.json(quotes);
  } catch (err) {
    console.error('Error fetching quotes:', err);
    res.status(500).json({ error: 'Error al obtener cotizaciones' });
  }
});

// Get a single quote
router.get('/:id', async (req, res) => {
  try {
    const quote = await db.prepare(`
      SELECT q.*, u.display_name as creator_name 
      FROM quotes q
      JOIN users u ON q.user_id = u.id
      WHERE q.id = ?
    `).get(req.params.id);
    
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    
    // Check permissions
    if (req.user.role !== 'admin' && quote.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cotización' });
  }
});

// Create a new quote
router.post('/', async (req, res) => {
  try {
    const {
      client_type, client_name, client_rut, client_address, client_phone, client_email,
      services_details, subtotal, iva, total, terms_conditions,
      scope_covered, technical_scope, payment_modalities, expiration_days
    } = req.body;
    
    const cType = client_type === 'COMERCIAL' ? 'COMERCIAL' : 'RESIDENCIAL';
    
    const result = await db.prepare(`
      INSERT INTO quotes (
        user_id, client_type, client_name, client_rut, client_address, client_phone, client_email,
        services_details, subtotal, iva, total, terms_conditions,
        scope_covered, technical_scope, payment_modalities, expiration_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_revision')
    `).run(
      req.user.id, cType, client_name, client_rut || '', client_address || '', client_phone || '', client_email || '',
      JSON.stringify(services_details || []), subtotal || 0, iva || 0, total || 0, terms_conditions || '',
      scope_covered || '', technical_scope || '', payment_modalities || '', expiration_days || 15
    );
    
    const newId = result.lastInsertRowid;
    const number = 390 + newId;
    const folioPrefix = cType === 'COMERCIAL' ? 'CC' : 'CR';
    const folioStr = `${folioPrefix}-0${number}`;
    
    await db.prepare('UPDATE quotes SET folio = ? WHERE id = ?').run(folioStr, newId);
    
    res.status(201).json({ id: newId, folio: folioStr, message: 'Cotización creada' });
  } catch (err) {
    console.error('Error creating quote:', err);
    res.status(500).json({ error: 'Error al crear cotización' });
  }
});

// Update a quote (only if not approved or by admin)
router.put('/:id', async (req, res) => {
  try {
    const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    
    if (req.user.role !== 'admin' && quote.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    if (req.user.role !== 'admin' && quote.status === 'aprobada') {
      return res.status(400).json({ error: 'No se puede editar una cotización aprobada' });
    }
    
    const {
      client_type, client_name, client_rut, client_address, client_phone, client_email,
      services_details, subtotal, iva, total, terms_conditions,
      scope_covered, technical_scope, payment_modalities, expiration_days
    } = req.body;
    
    const cType = client_type === 'COMERCIAL' ? 'COMERCIAL' : 'RESIDENCIAL';
    
    // Si edita el vendedor, vuelve a pendiente de revisión
    const newStatus = req.user.role === 'admin' ? quote.status : 'pendiente_revision';
    
    // Si cambia el tipo de cliente, podríamos querer cambiar el prefijo del folio
    let folioStr = quote.folio;
    if (quote.client_type !== cType) {
      const number = 390 + quote.id;
      const folioPrefix = cType === 'COMERCIAL' ? 'CC' : 'CR';
      folioStr = `${folioPrefix}-0${number}`;
    }
    
    await db.prepare(`
      UPDATE quotes SET 
        client_type = ?, folio = ?, client_name = ?, client_rut = ?, client_address = ?, client_phone = ?, client_email = ?,
        services_details = ?, subtotal = ?, iva = ?, total = ?, terms_conditions = ?,
        scope_covered = ?, technical_scope = ?, payment_modalities = ?, expiration_days = ?,
        status = ?, updated_at = NOW()
      WHERE id = ?
    `).run(
      cType, folioStr, client_name, client_rut || '', client_address || '', client_phone || '', client_email || '',
      JSON.stringify(services_details || []), subtotal || 0, iva || 0, total || 0, terms_conditions || '',
      scope_covered || '', technical_scope || '', payment_modalities || '', expiration_days || 15,
      newStatus, req.params.id
    );
    
    res.json({ message: 'Cotización actualizada' });
  } catch (err) {
    console.error('Error updating quote:', err);
    res.status(500).json({ error: 'Error al actualizar cotización' });
  }
});

// Admin endpoints
router.put('/:id/status', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  
  try {
    const { status, admin_notes } = req.body;
    
    if (!['aprobada', 'correccion', 'declinada', 'pendiente_revision'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    await db.prepare(`
      UPDATE quotes SET status = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?
    `).run(status, admin_notes || '', req.params.id);
    
    res.json({ message: 'Estado actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

router.post('/:id/convert-work-order', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  
  try {
    const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    
    if (quote.status !== 'aprobada') {
      return res.status(400).json({ error: 'Solo cotizaciones aprobadas pueden ser convertidas a OT' });
    }
    
    if (quote.work_order_id) {
      return res.status(400).json({ error: 'Esta cotización ya fue convertida a OT' });
    }
    
    const { technician_id } = req.body;
    if (!technician_id) return res.status(400).json({ error: 'Se requiere asignar a un técnico' });
    
    // Parse services details to construct background text
    let servicesText = '';
    try {
      const details = JSON.parse(quote.services_details);
      servicesText = details.map(d => `- ${d.description} (Cant: ${d.quantity})`).join('\n');
    } catch (e) { }
    
    const backgroundText = `Origen: Cotización #${quote.id}\nServicios cotizados:\n${servicesText}\n\nNotas Admin: ${quote.admin_notes}`;
    
    // Crear OT (work_order)
    // El frontend requiere service_type_id y attention_type
    // Asignaremos un tipo de servicio de atención genérico o lo buscaremos
    // "cotizacion" es un attention_type que agregamos en el otro lado
    
    const wost = await db.prepare('SELECT id FROM work_order_service_types LIMIT 1').get();
    const serviceTypeId = wost ? wost.id : null;
    
    const result = await db.prepare(`
      INSERT INTO work_orders (
        created_by, client_name, address, background_info, contact_phone, 
        attention_type, status, service_type_id, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, 
      quote.client_name, 
      quote.client_address, 
      backgroundText, 
      quote.client_phone,
      'cotizacion',
      'asignada',
      serviceTypeId,
      null, null
    );
    
    const workOrderId = result.lastInsertRowid;
    
    // Asignar al técnico
    await db.prepare(`
      INSERT INTO work_order_assignments (work_order_id, technician_id) VALUES (?, ?)
    `).run(workOrderId, technician_id);
    
    // Actualizar cotizacion con el id de la OT
    await db.prepare('UPDATE quotes SET work_order_id = ? WHERE id = ?').run(workOrderId, quote.id);
    
    // Notify technician
    try {
      await db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES (?, 'OT_ASIGNADA', 'Nueva Orden de Trabajo', ?, NOW())
      `).run(technician_id, `Se le ha asignado la OT #${workOrderId} proveniente de una cotización para ${quote.client_name}.`);
    } catch (_) {}
    
    res.json({ message: 'Convertida a Orden de Trabajo exitosamente', work_order_id: workOrderId });
  } catch (err) {
    console.error('Convert to WO error:', err);
    res.status(500).json({ error: 'Error al convertir a Orden de Trabajo' });
  }
});

export default router;