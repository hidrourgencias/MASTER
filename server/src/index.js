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
app.use('/api/jobs', jobsRoutes);

// PDF del ticket (público con token, para link en WhatsApp)
app.get('/api/jobs/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token || '';
    const job = await db.prepare('SELECT id, pdf_token FROM service_jobs WHERE id = ?').get(id);
    if (!job || !job.pdf_token || job.pdf_token !== token) {
      return res.status(404).send('Enlace no válido o expirado');
    }
    const filepath = path.join(__dirname, '..', 'uploads', 'jobs', 'pdfs', `ticket_${id}.pdf`);
    if (!fs.existsSync(filepath)) return res.status(404).send('PDF no encontrado');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ticket_${id}.pdf"`);
    res.sendFile(filepath);
  } catch (err) {
    res.status(500).send('Error');
  }
});
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

async function start() {
  await initDatabase();
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
