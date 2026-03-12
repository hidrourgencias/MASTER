/**
 * Cron job de supervisión de órdenes de trabajo.
 * Ejecuta cada minuto:
 * - Recordatorio (5 min): notifica al admin para enviar WhatsApp si no hay respuesta
 * - Escalamiento: SOLO manual (el admin debe hacer clic en Escalar)
 */
import db from '../db/database.js';
import crypto from 'crypto';

const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'https://hidrourgencias.onrender.com';

function getBaseUrl() {
  return BASE_URL.replace(/\/$/, '');
}

async function getSettings() {
  const rows = await db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all('tiempo_recordatorio_minutos', 'tiempo_escalamiento_minutos');
  const s = {};
  for (const r of rows || []) s[r.key] = parseInt(r.value, 10) || 5;
  return {
    tiempoRecordatorio: s.tiempo_recordatorio_minutos || 5,
    tiempoEscalamiento: s.tiempo_escalamiento_minutos || 10
  };
}

function buildConfirmLinks(assignmentId, token) {
  const base = getBaseUrl();
  return {
    aceptar: `${base}/api/public/orden-confirmar?token=${token}&action=aceptar`,
    rechazar: `${base}/api/public/orden-confirmar?token=${token}&action=rechazar`
  };
}

async function sendWhatsAppReminder(assignment, wo, technicianPhone, links) {
  const msg = `Recordatorio: tienes una orden de trabajo pendiente de confirmación.\n\nOrden: ${wo.id}\nCliente: ${wo.client_name}\nDirección: ${wo.address || '-'}\n\nConfirma aquí:\n[ACEPTAR] ${links.aceptar}\n[RECHAZAR] ${links.rechazar}`;
  const p = String(technicianPhone || '').replace(/\D/g, '');
  const num = p.startsWith('56') ? p : '56' + p;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

async function runCron() {
  try {
    const { tiempoRecordatorio } = await getSettings();
    const now = new Date();
    const nowMs = now.getTime();

    const pending = await db.prepare(`
      SELECT woa.*, wo.client_name, wo.address, wo.attention_type, wo.schedule,
        wost.name as service_type_name, u.display_name as technician_name, u.whatsapp_phone
      FROM work_order_assignments woa
      JOIN work_orders wo ON woa.work_order_id = wo.id
      LEFT JOIN work_order_service_types wost ON wo.service_type_id = wost.id
      JOIN users u ON woa.technician_id = u.id
      WHERE COALESCE(woa.assignment_status, 'pendiente_confirmacion') = 'pendiente_confirmacion'
        AND woa.sent_at IS NOT NULL
    `).all();

    for (const a of pending || []) {
      const refTime = a.sent_at || a.created_at;
      if (!refTime) continue;
      const elapsedMin = (nowMs - new Date(refTime).getTime()) / 60000;
      const wo = { id: a.work_order_id, client_name: a.client_name, address: a.address };

      if (elapsedMin >= tiempoRecordatorio) {
        const lastReminder = a.last_reminder_at ? new Date(a.last_reminder_at).getTime() : 0;
        const minSinceReminder = lastReminder ? (nowMs - lastReminder) / 60000 : 999;
        if (minSinceReminder < 4) continue;

        const token = a.confirm_token || crypto.randomBytes(24).toString('hex');
        if (!a.confirm_token) {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await db.prepare(`
            UPDATE work_order_assignments SET confirm_token = ?, token_expires_at = ?
            WHERE id = ?
          `).run(token, expiresAt, a.id).catch(() => {});
        }
        const links = buildConfirmLinks(a.id, token);
        const waUrl = await sendWhatsAppReminder(a, wo, a.whatsapp_phone, links);
        await db.prepare('UPDATE work_order_assignments SET last_reminder_at = NOW(), reminder_sent_at = NOW() WHERE id = ?').run(a.id);
        const admins = await db.prepare('SELECT id FROM users WHERE role = ? AND active = 1').all('admin');
        for (const ad of admins || []) {
          try {
            await db.prepare(`
              INSERT INTO notifications (user_id, type, title, message, ref_id, created_at)
              VALUES (?, 'OT_RECORDATORIO', 'Recordatorio pendiente', ?, ?, NOW())
            `).run(ad.id, `Orden #${a.work_order_id} - Técnico ${a.technician_name} sin confirmar (${Math.floor(elapsedMin)} min). Ir a órdenes para enviar recordatorio.`, a.work_order_id);
          } catch (_) { /* tabla notifications puede no existir o sin ref_id */ }
        }
        console.log(`[Cron] Recordatorio preparado orden #${a.work_order_id} técnico ${a.technician_name}`);
      }
    }
  } catch (err) {
    console.error('[Cron work orders]', err);
  }
}

let intervalId = null;

export function startWorkOrderCron() {
  if (intervalId) return;
  runCron();
  intervalId = setInterval(runCron, 60 * 1000);
  console.log('[Cron] Supervisión de órdenes de trabajo iniciada (cada 1 min)');
}

export function stopWorkOrderCron() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
