/**
 * Inisialisasi database otomatis saat server dijalankan.
 * Membuat database dan tabel jika belum ada, seed data default.
 */
const mysql = require('mysql2/promise');

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  try {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  } catch (e) {
    // Kolom sudah ada, ignore.
  }
}

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'presensi_giat';

  const connection = await mysql.createConnection({ host, port, user, password });

  try {
    // Buat database jika belum ada
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Database "${dbName}" siap.`);

    await connection.query(`USE \`${dbName}\``);

    // Tabel employees
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        qr_code VARCHAR(120) NOT NULL UNIQUE,
        qr_file_id VARCHAR(120) DEFAULT NULL,
        qr_url TEXT,
        photo_file_id VARCHAR(120) DEFAULT NULL,
        photo_url TEXT,
        status ENUM('AKTIF', 'CUTI', 'NONAKTIF') DEFAULT 'AKTIF',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await addColumnIfMissing(connection, 'employees', 'qr_code', 'VARCHAR(120) NULL UNIQUE');
    await addColumnIfMissing(connection, 'employees', 'qr_file_id', 'VARCHAR(120) DEFAULT NULL');
    await addColumnIfMissing(connection, 'employees', 'qr_url', 'TEXT');
    await addColumnIfMissing(connection, 'employees', 'photo_file_id', 'VARCHAR(120) DEFAULT NULL');
    await addColumnIfMissing(connection, 'employees', 'photo_url', 'TEXT');
    await connection.query("UPDATE employees SET qr_code = CONCAT('GIAT-EMP-', id, '-', REPLACE(UUID(), '-', '')) WHERE qr_code IS NULL OR qr_code = ''");
    await connection.query('ALTER TABLE employees MODIFY qr_code VARCHAR(120) NOT NULL');
    console.log('✅ Tabel "employees" siap.');

    // Tabel locations
    await connection.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabel "locations" siap.');

    // Tabel shifts
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        start_time VARCHAR(10) NOT NULL DEFAULT '08:00',
        end_time VARCHAR(10) NOT NULL DEFAULT '17:00',
        is_overtime BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Migrasi: tambah kolom end_time jika belum ada (untuk DB lama)
    try {
      await connection.query(`ALTER TABLE shifts ADD COLUMN end_time VARCHAR(10) NOT NULL DEFAULT '17:00'`);
    } catch (e) {
      // kolom sudah ada, ignore
    }
    // Migrasi: tambah kolom is_overtime jika belum ada
    try {
      await connection.query(`ALTER TABLE shifts ADD COLUMN is_overtime BOOLEAN DEFAULT FALSE`);
    } catch (e) {
      // kolom sudah ada, ignore
    }
    console.log('✅ Tabel "shifts" siap.');

    // Tabel app_settings (untuk barcode content, dll)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabel "app_settings" siap.');

    // Tabel attendance
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT PRIMARY KEY AUTO_INCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        date DATE NOT NULL,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(100) NOT NULL,
        shift VARCHAR(100) NOT NULL,
        time_in VARCHAR(10) DEFAULT NULL,
        time_out VARCHAR(10) DEFAULT NULL,
        status ENUM('Tepat Waktu', 'Terlambat') NOT NULL DEFAULT 'Tepat Waktu',
        note TEXT,
        check_in_photo_file_id VARCHAR(120) DEFAULT NULL,
        check_in_photo_url TEXT,
        check_in_latitude DECIMAL(10, 7) DEFAULT NULL,
        check_in_longitude DECIMAL(10, 7) DEFAULT NULL,
        check_out_photo_file_id VARCHAR(120) DEFAULT NULL,
        check_out_photo_url TEXT,
        check_out_latitude DECIMAL(10, 7) DEFAULT NULL,
        check_out_longitude DECIMAL(10, 7) DEFAULT NULL,
        INDEX idx_date_name (date, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await addColumnIfMissing(connection, 'attendance', 'check_in_photo_file_id', 'VARCHAR(120) DEFAULT NULL');
    await addColumnIfMissing(connection, 'attendance', 'check_in_photo_url', 'TEXT');
    await addColumnIfMissing(connection, 'attendance', 'check_in_latitude', 'DECIMAL(10, 7) DEFAULT NULL');
    await addColumnIfMissing(connection, 'attendance', 'check_in_longitude', 'DECIMAL(10, 7) DEFAULT NULL');
    await addColumnIfMissing(connection, 'attendance', 'check_out_photo_file_id', 'VARCHAR(120) DEFAULT NULL');
    await addColumnIfMissing(connection, 'attendance', 'check_out_photo_url', 'TEXT');
    await addColumnIfMissing(connection, 'attendance', 'check_out_latitude', 'DECIMAL(10, 7) DEFAULT NULL');
    await addColumnIfMissing(connection, 'attendance', 'check_out_longitude', 'DECIMAL(10, 7) DEFAULT NULL');
    console.log('✅ Tabel "attendance" siap.');

    // Tabel admin_config
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admin_id VARCHAR(50) NOT NULL DEFAULT 'admin',
        password VARCHAR(255) NOT NULL DEFAULT 'giat123',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabel "admin_config" siap.');

    // === SEED DATA (HANYA YANG ESSENTIAL) ===

    // Seed app_settings — wajib agar sistem bisa jalan
    const [settingsRows] = await connection.query('SELECT COUNT(*) as count FROM app_settings');
    if (settingsRows[0].count === 0) {
      await connection.query(
        "INSERT INTO app_settings (`key`, value) VALUES ('barcode_content', 'KOPERASI GIAT')"
      );
      await connection.query(
        "INSERT INTO app_settings (`key`, value) VALUES ('late_threshold_minutes', '6')"
      );
      console.log('✅ Default app_settings ditambahkan.');
    }

    // Seed admin_config — wajib agar admin bisa login pertama kali
    const [adminRows] = await connection.query('SELECT COUNT(*) as count FROM admin_config');
    if (adminRows[0].count === 0) {
      await connection.query(
        'INSERT INTO admin_config (admin_id, password) VALUES (?, ?)',
        ['admin', 'giat123']
      );
      console.log('✅ Default admin ditambahkan (id: admin, password: giat123).');
    }

    // Tabel employees, locations, shifts SENGAJA dibiarkan kosong.
    // Admin bisa menambahkan sendiri dari halaman Master Data.

    console.log('🎉 Inisialisasi database selesai.');
  } finally {
    await connection.end();
  }
}

module.exports = initDatabase;

// Jika dijalankan langsung via `node src/db/init.js`
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  initDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Gagal inisialisasi database:', err.message);
      process.exit(1);
    });
}
