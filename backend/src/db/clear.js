/**
 * Script untuk mengosongkan data dari database.
 * TIDAK menghapus: admin_config, app_settings
 * Akan menghapus: attendance, employees, locations, shifts
 *
 * Jalankan: node src/db/clear.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function clearData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'presensi_giat',
  });

  try {
    console.log('🧹 Mengosongkan data...\n');

    // Disable foreign key checks (jaga-jaga jika ada FK)
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Hapus data attendance
    const [att] = await connection.query('DELETE FROM attendance');
    console.log(`✅ attendance dikosongkan (${att.affectedRows} baris dihapus)`);

    // Hapus data employees
    const [emp] = await connection.query('DELETE FROM employees');
    console.log(`✅ employees dikosongkan (${emp.affectedRows} baris dihapus)`);

    // Hapus data locations
    const [loc] = await connection.query('DELETE FROM locations');
    console.log(`✅ locations dikosongkan (${loc.affectedRows} baris dihapus)`);

    // Hapus data shifts
    const [sh] = await connection.query('DELETE FROM shifts');
    console.log(`✅ shifts dikosongkan (${sh.affectedRows} baris dihapus)`);

    // Reset auto-increment agar ID mulai dari 1 lagi
    await connection.query('ALTER TABLE attendance AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE employees AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE locations AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE shifts AUTO_INCREMENT = 1');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Cek bahwa admin & settings masih ada
    const [admins] = await connection.query('SELECT COUNT(*) as count FROM admin_config');
    const [settings] = await connection.query('SELECT COUNT(*) as count FROM app_settings');

    console.log('\n📌 Data yang DIPERTAHANKAN:');
    console.log(`   • admin_config: ${admins[0].count} record`);
    console.log(`   • app_settings: ${settings[0].count} record`);

    console.log('\n🎉 Database berhasil dikosongkan.');
  } catch (error) {
    console.error('❌ Gagal mengosongkan database:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

clearData();
