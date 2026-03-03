import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
router.use(authMiddleware);

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads', 'temp'),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/scan', upload.single('image'), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'API Key de Gemini no configurada. Configure GEMINI_API_KEY en el archivo .env del servidor.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imageData = fs.readFileSync(req.file.path);
    const base64Image = imageData.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    const prompt = `Analiza esta imagen de una boleta o factura chilena y extrae los siguientes datos en formato JSON estricto.
Si no puedes identificar un campo, usa una cadena vacía "".
Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.

{
  "fecha": "DD/MM/YYYY",
  "monto": "número sin puntos ni símbolos, solo dígitos",
  "rut_proveedor": "RUT del proveedor con formato XX.XXX.XXX-X",
  "nombre_proveedor": "Nombre o razón social del proveedor",
  "tipo_documento": "boleta o factura",
  "numero_documento": "número del documento"
}`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } }
    ]);

    const responseText = result.response.text();
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    const finalPath = path.join(__dirname, '..', '..', 'uploads', `receipt_${Date.now()}${path.extname(req.file.originalname)}`);
    fs.renameSync(req.file.path, finalPath);

    res.json({
      data: {
        date: parsed.fecha || '',
        amount: parsed.monto || '',
        provider_rut: parsed.rut_proveedor || '',
        provider: parsed.nombre_proveedor || '',
        document_type: parsed.tipo_documento || 'boleta',
        document_number: parsed.numero_documento || ''
      },
      raw: responseText,
      image_filename: path.basename(finalPath)
    });
  } catch (err) {
    console.error('OCR Error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error al procesar imagen con OCR' });
  }
});

router.get('/frequent-ruts', async (req, res) => {
  try {
    const ruts = await db.prepare('SELECT * FROM frequent_ruts ORDER BY usage_count DESC LIMIT 20').all();
    res.json(ruts);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener RUTs frecuentes' });
  }
});

export default router;
