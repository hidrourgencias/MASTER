import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const users = await db.prepare(
      'SELECT id, username, display_name, role, rut, bank_name, bank_account_type, bank_account_number, must_change_password, active, created_at FROM users ORDER BY display_name'
    ).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.get('/technicians', async (req, res) => {
  try {
    const techs = await db.prepare(
      "SELECT id, display_name FROM users WHERE role = 'tecnico' AND active = 1 ORDER BY display_name"
    ).all();
    res.json(techs);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener técnicos' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const { rut, bank_name, bank_account_type, bank_account_number, display_name } = req.body;
    await db.prepare(`
      UPDATE users SET rut = ?, bank_name = ?, bank_account_type = ?, bank_account_number = ?, display_name = COALESCE(?, display_name), updated_at = NOW()
      WHERE id = ?
    `).run(rut || '', bank_name || '', bank_account_type || '', bank_account_number || '', display_name, req.user.id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'UPDATE_PROFILE', 'Perfil actualizado');

    const user = await db.prepare('SELECT id, username, display_name, role, rut, bank_name, bank_account_type, bank_account_number, must_change_password, active FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

router.put('/:id/reset-password', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const newPassword = bcrypt.hashSync('Hidro2026', 10);
    await db.prepare('UPDATE users SET password = ?, must_change_password = 1, updated_at = NOW() WHERE id = ?')
      .run(newPassword, id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'RESET_PASSWORD', `Contraseña reseteada para usuario #${id}`);

    res.json({ message: 'Contraseña reseteada a Hidro2026' });
  } catch (err) {
    res.status(500).json({ error: 'Error al resetear contraseña' });
  }
});

router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, role, active, rut, bank_name, bank_account_type, bank_account_number } = req.body;

    await db.prepare(`
      UPDATE users SET display_name = COALESCE(?, display_name), role = COALESCE(?, role), active = COALESCE(?, active),
      rut = COALESCE(?, rut), bank_name = COALESCE(?, bank_name), bank_account_type = COALESCE(?, bank_account_type),
      bank_account_number = COALESCE(?, bank_account_number), updated_at = NOW() WHERE id = ?
    `).run(display_name, role, active, rut, bank_name, bank_account_type, bank_account_number, id);

    await db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'UPDATE_USER', `Usuario #${id} actualizado`);

    const user = await db.prepare('SELECT id, username, display_name, role, rut, bank_name, bank_account_type, bank_account_number, must_change_password, active FROM users WHERE id = ?').get(id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

export default router;
