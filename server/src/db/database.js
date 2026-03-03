import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool, types } = pg;

types.setTypeParser(20, val => parseInt(val, 10));
types.setTypeParser(1700, val => parseFloat(val));
types.setTypeParser(1114, str => str);
types.setTypeParser(1184, str => str);

const isLocal = !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

class DbWrapper {
  prepare(sql) {
    const pgSql = convertPlaceholders(sql);
    return {
      get: async (...params) => {
        const result = await pool.query(pgSql, params);
        return result.rows[0] || undefined;
      },
      all: async (...params) => {
        const result = await pool.query(pgSql, params);
        return result.rows;
      },
      run: async (...params) => {
        const result = await pool.query(pgSql, params);
        return {
          lastInsertRowid: result.rows?.[0]?.id,
          changes: result.rowCount
        };
      }
    };
  }

  async exec(sql) {
    await pool.query(sql);
  }
}

const dbWrapper = new DbWrapper();
export default dbWrapper;

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'tecnico',
      rut TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_account_type TEXT DEFAULT '',
      bank_account_number TEXT DEFAULT '',
      must_change_password INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      provider TEXT DEFAULT '',
      provider_rut TEXT DEFAULT '',
      service TEXT DEFAULT '',
      description TEXT DEFAULT '',
      document_type TEXT DEFAULT 'boleta',
      document_number TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      status TEXT DEFAULT 'pendiente',
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      paid INTEGER DEFAULT 0,
      paid_at TIMESTAMP,
      collaborators TEXT DEFAULT '[]',
      ocr_raw TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS frequent_ruts (
      id SERIAL PRIMARY KEY,
      rut TEXT NOT NULL,
      name TEXT NOT NULL,
      usage_count INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_services (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_jobs (
      id SERIAL PRIMARY KEY,
      technician_id INTEGER NOT NULL REFERENCES users(id),
      client_type TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_rut TEXT DEFAULT '',
      address_street TEXT DEFAULT '',
      address_number TEXT DEFAULT '',
      address_comuna TEXT DEFAULT '',
      job_service_id INTEGER REFERENCES job_services(id),
      payment_type TEXT NOT NULL,
      payment_method TEXT DEFAULT '',
      client_status TEXT DEFAULT 'pendiente_pago',
      amount NUMERIC(12,2) DEFAULT 0,
      technician_payment NUMERIC(12,2) DEFAULT 0,
      technician_paid INTEGER DEFAULT 0,
      technician_paid_at TIMESTAMP,
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_job_photos (
      id SERIAL PRIMARY KEY,
      service_job_id INTEGER NOT NULL REFERENCES service_jobs(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const userCount = await pool.query("SELECT COUNT(*) as count FROM users");
  if (parseInt(userCount.rows[0].count) === 0) {
    const hashedAdmin = bcrypt.hashSync('administración', 10);
    const hashedTech = bcrypt.hashSync('Hidro2026', 10);

    await pool.query(
      "INSERT INTO users (username, password, display_name, role, must_change_password) VALUES ($1, $2, $3, $4, $5)",
      ['administración', hashedAdmin, 'Administrador', 'admin', 0]
    );

    const technicians = [
      ['german', 'German'], ['donar', 'Donar'], ['marelyn', 'Marelyn'],
      ['susana', 'Susana'], ['invitado', 'Invitado']
    ];
    for (const [username, displayName] of technicians) {
      await pool.query(
        "INSERT INTO users (username, password, display_name, role, must_change_password) VALUES ($1, $2, $3, $4, $5)",
        [username, hashedTech, displayName, 'tecnico', 1]
      );
    }
    console.log('Usuarios iniciales creados.');
  }

  const svcCount = await pool.query("SELECT COUNT(*) as count FROM services");
  if (parseInt(svcCount.rows[0].count) === 0) {
    const defaultServices = [
      'Destape de cañerías', 'Reparación de filtraciones', 'Instalación sanitaria',
      'Mantención general', 'Emergencia', 'Inspección técnica', 'Otro'
    ];
    for (const s of defaultServices) {
      await pool.query("INSERT INTO services (name) VALUES ($1)", [s]);
    }
    console.log('Servicios iniciales creados.');
  }

  const jobSvcCount = await pool.query("SELECT COUNT(*) as count FROM job_services");
  if (parseInt(jobSvcCount.rows[0].count) === 0) {
    const defaultJobServices = [
      'Destape de alcantarillado', 'Destape de desagüe', 'Destape de WC',
      'Destape de cañerías', 'Reparación de filtraciones', 'Instalación sanitaria',
      'Mantención general', 'Emergencia', 'Inspección técnica', 'Otro'
    ];
    for (const s of defaultJobServices) {
      try {
        await pool.query("INSERT INTO job_services (name) VALUES ($1)", [s]);
      } catch { /* unique constraint */ }
    }
    console.log('Servicios de trabajo iniciales creados.');
  }

  const defaultSettings = [
    ['ocr_brightness', '0'],
    ['ocr_auto_brightness', '1'],
    ['ocr_confidence_threshold', '0.7'],
    ['company_name', 'Hidrourgencias SpA'],
    ['whatsapp_number', '+56940918672']
  ];
  for (const [key, value] of defaultSettings) {
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
      [key, value]
    );
  }

  console.log('Base de datos PostgreSQL inicializada.');
}
