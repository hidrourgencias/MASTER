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
      payment_type TEXT DEFAULT 'contado',
      payment_method TEXT DEFAULT '',
      client_status TEXT DEFAULT 'pendiente_pago',
      amount NUMERIC(12,2) DEFAULT 0,
      technician_payment NUMERIC(12,2) DEFAULT 0,
      technician_paid INTEGER DEFAULT 0,
      technician_paid_at TIMESTAMP,
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      ticket_status TEXT DEFAULT 'pendiente',
      admin_payment_method TEXT DEFAULT '',
      admin_payment_schedule TEXT DEFAULT '',
      admin_payment_notes TEXT DEFAULT '',
      is_garantia INTEGER DEFAULT 0,
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'PAGO_ASIGNADO',
      title TEXT DEFAULT '',
      message TEXT DEFAULT '',
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      client_name TEXT NOT NULL,
      client_rut TEXT DEFAULT '',
      client_address TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      services_details TEXT DEFAULT '[]',
      subtotal NUMERIC(12,2) DEFAULT 0,
      iva NUMERIC(12,2) DEFAULT 0,
      total NUMERIC(12,2) DEFAULT 0,
      terms_conditions TEXT DEFAULT '',
      status TEXT DEFAULT 'pendiente_revision',
      admin_notes TEXT DEFAULT '',
      work_order_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_service_types (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id SERIAL PRIMARY KEY,
      created_by INTEGER NOT NULL REFERENCES users(id),
      client_name TEXT NOT NULL,
      address TEXT NOT NULL,
      background_info TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      attention_type TEXT NOT NULL,
      service_type_id INTEGER REFERENCES work_order_service_types(id),
      latitude NUMERIC(10, 6),
      longitude NUMERIC(10, 6),
      status TEXT DEFAULT 'asignada',
      admin_notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_assignments (
      id SERIAL PRIMARY KEY,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      technician_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'pendiente',
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const addCol = async (table, col, def) => {
    try {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    } catch (_) {}
  };
  await addCol('service_jobs', 'ticket_status', "TEXT DEFAULT 'pendiente'");
  await addCol('service_jobs', 'admin_payment_method', 'TEXT DEFAULT \'\'');
  await addCol('service_jobs', 'admin_payment_schedule', 'TEXT DEFAULT \'\'');
  await addCol('service_jobs', 'admin_payment_notes', 'TEXT DEFAULT \'\'');
  await addCol('service_jobs', 'is_garantia', 'INTEGER DEFAULT 0');
  await addCol('service_jobs', 'client_phone', 'TEXT DEFAULT \'\'');
  await addCol('service_jobs', 'payment_type', "TEXT DEFAULT 'contado'");

  await addCol('quotes', 'folio', "TEXT DEFAULT ''");
  await addCol('quotes', 'client_type', "TEXT DEFAULT 'RESIDENCIAL'");
  await addCol('quotes', 'scope_covered', "TEXT DEFAULT ''");
  await addCol('quotes', 'technical_scope', "TEXT DEFAULT ''");
  await addCol('quotes', 'payment_modalities', "TEXT DEFAULT ''");
  await addCol('quotes', 'expiration_days', "INTEGER DEFAULT 15");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS postventa_reminders (
      id SERIAL PRIMARY KEY,
      service_job_id INTEGER NOT NULL REFERENCES service_jobs(id) ON DELETE CASCADE,
      scheduled_date TEXT NOT NULL,
      status TEXT DEFAULT 'pendiente',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const userCount = await pool.query("SELECT COUNT(*) as count FROM users");
  if (parseInt(userCount.rows[0].count) === 0) {
    const hashedAdmin = bcrypt.hashSync('administracion', 10);
    const hashedTech = bcrypt.hashSync('Hidro2026', 10);

    await pool.query(
      "INSERT INTO users (username, password, display_name, role, must_change_password) VALUES ($1, $2, $3, $4, $5)",
      ['administracion', hashedAdmin, 'Administrador', 'admin', 0]
    );

    const technicians = [
      ['german', 'German', 'tecnico'], ['donar', 'Donar', 'tecnico'], ['marelyn', 'Marelyn', 'tecnico'],
      ['susana', 'Susana', 'tecnico'], ['invitado', 'Invitado', 'tecnico'],
      ['ventas', 'Vendedor', 'ventas']
    ];
    for (const [username, displayName, role] of technicians) {
      await pool.query(
        "INSERT INTO users (username, password, display_name, role, must_change_password) VALUES ($1, $2, $3, $4, $5)",
        [username, hashedTech, displayName, role || 'tecnico', 1]
      );
    }
    console.log('Usuarios iniciales creados.');
  }

  const svcCount = await pool.query("SELECT COUNT(*) as count FROM services");
  if (parseInt(svcCount.rows[0].count) === 0) {
    const defaultServices = [
      'Destape de canerias', 'Reparacion de filtraciones', 'Instalacion sanitaria',
      'Mantencion general', 'Emergencia', 'Inspeccion tecnica', 'Otro'
    ];
    for (const s of defaultServices) {
      await pool.query("INSERT INTO services (name) VALUES ($1)", [s]);
    }
    console.log('Servicios iniciales creados.');
  }

  const jobSvcCount = await pool.query("SELECT COUNT(*) as count FROM job_services");
  if (parseInt(jobSvcCount.rows[0].count) === 0) {
    const defaultJobServices = [
      'Destape de alcantarillado', 'Destape de desague', 'Destape de WC',
      'Destape de canerias', 'Reparacion de filtraciones', 'Instalacion sanitaria',
      'Mantencion general', 'Emergencia', 'Inspeccion tecnica', 'Otro'
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
