import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import db from './db/database.js';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenses.js';
import userRoutes from './routes/users.js';
import ocrRoutes from './routes/ocr.js';
import adminRoutes from './routes/admin.js';
import jobsRoutes from './routes/jobs.js';
import workOrdersRoutes from './routes/workOrders.js';
import quotesRoutes from './routes/quotes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Crear carpetas de uploads si no existen (necesario en Render)
const uploadsBase = path.join(__dirname, '..', 'uploads');
['', 'jobs', 'jobs/pdfs', 'temp'].forEach(sub => {
  const dir = sub ? path.join(uploadsBase, sub) : uploadsBase;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
const datosDir = path.join(__dirname, '..', '..', 'datos');
if (!fs.existsSync(datosDir)) fs.mkdirSync(datosDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/admin', adminRoutes);

// Confirmar/rechazar orden vía WhatsApp (enlace seguro con token)
app.get('/api/public/orden-confirmar', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const action = String(req.query.action || '').toLowerCase();
    if (!token || !['aceptar', 'rechazar'].includes(action)) {
      return res.status(400).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Enlace inválido</title></head><body style="font-family:sans-serif;max-width:400px;margin:60px auto;padding:20px;text-align:center">
        <h2>Enlace inválido o expirado</h2>
        <p>Use el enlace completo que recibió por WhatsApp.</p></body></html>
      `);
    }
    const a = await db.prepare(`
      SELECT woa.*, wo.client_name FROM work_order_assignments woa
      JOIN work_orders wo ON woa.work_order_id = wo.id
      WHERE woa.confirm_token = ? AND (woa.token_expires_at IS NULL OR woa.token_expires_at > NOW())
    `).get(token);
    if (!a) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Enlace expirado</title></head><body style="font-family:sans-serif;max-width:400px;margin:60px auto;padding:20px;text-align:center">
        <h2>Este enlace ha expirado</h2>
        <p>Confirme desde la aplicación o solicite un nuevo enlace.</p></body></html>
      `);
    }
    const status = a.assignment_status || 'pendiente_confirmacion';
    if (status !== 'pendiente_confirmacion') {
      const msg = status === 'confirmada' ? 'Esta orden ya fue confirmada.' : status === 'rechazada' ? 'Esta orden ya fue rechazada.' : 'Esta orden ya fue procesada.';
      return res.send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Ya procesada</title></head><body style="font-family:sans-serif;max-width:400px;margin:60px auto;padding:20px;text-align:center">
        <h2>${msg}</h2>
        <p>Orden #${a.work_order_id} - ${a.client_name}</p></body></html>
      `);
    }
    const newStatus = action === 'aceptar' ? 'confirmada' : 'rechazada';
    await db.prepare(`
      UPDATE work_order_assignments SET assignment_status = ?, read_at = NOW(),
        fecha_confirmacion_tecnico = NOW(), metodo_confirmacion = 'whatsapp', confirm_token = ''
      WHERE id = ?
    `).run(newStatus, a.id);
    const title = action === 'aceptar' ? 'Orden confirmada' : 'Orden rechazada';
    const desc = action === 'aceptar' ? 'Has aceptado la orden de trabajo.' : 'Has rechazado la orden de trabajo.';
    const color = action === 'aceptar' ? '#22c55e' : '#ef4444';
    return res.send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${title}</title></head>
      <body style="font-family:sans-serif;max-width:400px;margin:60px auto;padding:20px;text-align:center">
      <h2 style="color:${color}">${title}</h2>
      <p>${desc}</p>
      <p><strong>Orden #${a.work_order_id}</strong> - ${a.client_name}</p>
      <p style="color:#666;font-size:14px">Puede cerrar esta ventana.</p></body></html>
    `);
  } catch (err) {
    console.error('Orden confirmar:', err);
    res.status(500).send('<h2>Error al procesar</h2>');
  }
});

// PDF del ticket: ruta pública separada (SIN auth) - evita conflicto con jobs router
app.get('/api/public/ticket-pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const token = String(req.query.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Falta el token en la URL. Use el enlace completo que recibió por WhatsApp.' });
    const job = await db.prepare('SELECT id, pdf_token FROM service_jobs WHERE id = ?').get(id);
    if (!job || !job.pdf_token || job.pdf_token !== token) {
      return res.status(404).json({ error: 'Enlace no válido o expirado' });
    }
    const filepath = path.join(__dirname, '..', 'uploads', 'jobs', 'pdfs', `ticket_${id}.pdf`);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'PDF no encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ticket_${id}.pdf"`);
    res.sendFile(filepath);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

app.use('/api/jobs', jobsRoutes);
app.use('/api/work-orders', workOrdersRoutes);
app.use('/api/quotes', quotesRoutes);

// Health check para Render (verifica que el servidor esté listo)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await db.prepare("SELECT * FROM services WHERE active = 1 ORDER BY name").all();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

import { startWorkOrderCron } from './services/workOrderCron.js';

async function start() {
  await initDatabase();
  startWorkOrderCron();
  // 0.0.0.0 para aceptar conexiones en Render y otros PaaS
  const host = process.env.HOST || '0.0.0.0';
  app.listen(PORT, host, () => {
    console.log(`Servidor Hidrourgencias corriendo en http://${host}:${PORT}`);
  });
}

start().catch(err => {
  console.error('Error al iniciar servidor:', err);
  process.exit(1);
});
