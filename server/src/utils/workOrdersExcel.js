import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATOS_DIR = path.join(__dirname, '..', '..', '..', 'datos');
const EXCEL_PATH = path.join(DATOS_DIR, 'ordenes_trabajo.xlsx');
const SHEET_NAME = 'Órdenes de Trabajo';

const HEADERS = ['ID', 'Fecha', 'Cliente', 'Teléfono', 'Dirección', 'Tipo Atención', 'Servicio', 'Estado', 'Origen Cotización'];

function ensureDatosDir() {
  if (!fs.existsSync(DATOS_DIR)) fs.mkdirSync(DATOS_DIR, { recursive: true });
}

async function getWorkOrderRow(woId) {
  const wo = await db.prepare(`
    SELECT wo.*, wost.name as service_type_name
    FROM work_orders wo
    LEFT JOIN work_order_service_types wost ON wo.service_type_id = wost.id
    WHERE wo.id = ?
  `).get(woId);
  if (!wo) return null;
  const quote = await db.prepare('SELECT id, folio FROM quotes WHERE work_order_id = ?').get(woId);
  const origen = quote ? `Cotización #${quote.folio || quote.id}` : 'Manual';
  return [
    wo.id,
    (wo.created_at || '').toString().slice(0, 19),
    wo.client_name || '',
    wo.client_phone || wo.contact_phone || '',
    wo.address || '',
    wo.attention_type || '',
    wo.service_type_name || '',
    wo.status || '',
    origen
  ];
}

export async function appendWorkOrderToExcel(woId) {
  ensureDatosDir();
  const row = await getWorkOrderRow(woId);
  if (!row) return;

  let wb;
  let ws;
  if (fs.existsSync(EXCEL_PATH)) {
    wb = XLSX.readFile(EXCEL_PATH);
    ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      ws = XLSX.utils.aoa_to_sheet([HEADERS]);
      XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
    }
  } else {
    wb = XLSX.utils.book_new();
    ws = XLSX.utils.aoa_to_sheet([HEADERS]);
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  data.push(row);
  const newWs = XLSX.utils.aoa_to_sheet(data);
  wb.Sheets[SHEET_NAME] = newWs;
  if (wb.SheetNames[0] !== SHEET_NAME) {
    wb.SheetNames = [SHEET_NAME, ...wb.SheetNames.filter(n => n !== SHEET_NAME)];
  }
  XLSX.writeFile(wb, EXCEL_PATH);
}
