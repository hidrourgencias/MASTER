import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './src/db/database.js';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runBackup() {
  console.log('Iniciando proceso de copia de seguridad...');
  
  try {
    const backupDir = path.join(__dirname, '..', 'Copias_de_Seguridad');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const zipFilename = path.join(backupDir, `Respaldo_Hidrourgencias_${dateStr}.zip`);
    const zip = new AdmZip();

    console.log('1. Exportando base de datos a JSON...');
    // List of tables to export
    const tables = [
      'users', 'expenses', 'services', 'job_services', 'service_jobs',
      'service_job_materials', 'service_job_photos', 'audit_log',
      'frequent_ruts', 'settings', 'work_order_service_types',
      'work_orders', 'work_order_assignments', 'notifications', 'quotes'
    ];

    const dbExport = {};
    for (const table of tables) {
      try {
        const rows = await db.prepare(`SELECT * FROM ${table}`).all();
        dbExport[table] = rows;
      } catch (err) {
        console.warn(`[Advertencia] No se pudo exportar la tabla ${table} (podría no existir aún). Error: ${err.message}`);
      }
    }

    const dbJsonStr = JSON.stringify(dbExport, null, 2);
    zip.addFile('database_backup.json', Buffer.from(dbJsonStr, 'utf8'));

    console.log('2. Añadiendo archivos de imágenes (uploads)...');
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      zip.addLocalFolder(uploadsDir, 'uploads');
    }

    console.log('3. Creando archivo comprimido ZIP...');
    zip.writeZip(zipFilename);

    console.log('\n=========================================');
    console.log('¡COPIA DE SEGURIDAD COMPLETADA CON ÉXITO!');
    console.log(`Archivo guardado en:\n${zipFilename}`);
    console.log('=========================================\n');
    process.exit(0);

  } catch (error) {
    console.error('Error durante la copia de seguridad:', error);
    process.exit(1);
  }
}

runBackup();