/**
 * Servicio de flujo de caja. Registra ingresos y egresos.
 */
import db from '../db/database.js';

export async function registrarIngresoServicio(ticketId, monto, descripcion = '', usuarioId = null) {
  if (!monto || monto <= 0) return;
  const exist = await db.prepare('SELECT 1 FROM flujo_caja WHERE ticket_id = ? AND origen = ?').get(ticketId, 'servicio');
  if (exist) return;
  await db.prepare(`
    INSERT INTO flujo_caja (tipo_movimiento, categoria, descripcion, monto, ticket_id, usuario_id, origen)
    VALUES ('ingreso', 'servicio', ?, ?, ?, ?, 'servicio')
  `).run(descripcion || `Ticket #${ticketId}`, parseFloat(monto), ticketId, usuarioId);
}

export async function registrarEgresoPagoTecnico(ticketId, monto, descripcion = '', usuarioId = null) {
  if (!monto || monto < 0) return;
  const amt = Math.abs(parseFloat(monto));
  if (amt === 0) return;
  const exist = await db.prepare('SELECT 1 FROM flujo_caja WHERE ticket_id = ? AND origen = ?').get(ticketId, 'pago_tecnico');
  if (exist) return;
  await db.prepare(`
    INSERT INTO flujo_caja (tipo_movimiento, categoria, descripcion, monto, ticket_id, usuario_id, origen)
    VALUES ('egreso', 'pago_tecnico', ?, ?, ?, ?, 'pago_tecnico')
  `).run(descripcion || `Pago técnico Ticket #${ticketId}`, amt, ticketId, usuarioId);
}

export async function registrarEgresoGasto(expenseId, monto, categoria = 'otros', descripcion = '', ticketId = null, usuarioId = null) {
  if (!monto || monto <= 0) return;
  const exist = await db.prepare('SELECT 1 FROM flujo_caja WHERE expense_id = ? AND origen = ?').get(expenseId, 'gasto');
  if (exist) return;
  const amt = parseFloat(monto);
  await db.prepare(`
    INSERT INTO flujo_caja (tipo_movimiento, categoria, descripcion, monto, ticket_id, expense_id, usuario_id, origen)
    VALUES ('egreso', ?, ?, ?, ?, ?, ?, 'gasto')
  `).run(categoria, descripcion || `Gasto #${expenseId}`, amt, ticketId || null, expenseId, usuarioId);
}

export async function obtenerFlujoCaja(fechaDesde, fechaHasta) {
  const rows = await db.prepare(`
    SELECT * FROM flujo_caja
    WHERE fecha >= ? AND fecha <= ?
    ORDER BY fecha ASC
  `).all(fechaDesde, fechaHasta);
  return rows || [];
}

export async function obtenerTotalesPorPeriodo(fechaDesde, fechaHasta) {
  const rows = await db.prepare(`
    SELECT tipo_movimiento, SUM(monto) as total
    FROM flujo_caja
    WHERE fecha >= ? AND fecha <= ?
    GROUP BY tipo_movimiento
  `).all(fechaDesde, fechaHasta);
  const r = { ingresos: 0, egresos: 0 };
  for (const x of rows || []) {
    if (x.tipo_movimiento === 'ingreso') r.ingresos = parseFloat(x.total) || 0;
    else r.egresos += parseFloat(x.total) || 0;
  }
  r.utilidad = r.ingresos - r.egresos;
  return r;
}
